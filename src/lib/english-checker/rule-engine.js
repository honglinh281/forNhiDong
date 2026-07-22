import { ENGLISH_CHECK_STATUS } from '@/lib/english-checker/constants';
import { isGenericOnlyEnglishName } from '@/lib/english-checker/generic-name-rule';
import { normalizeEnglishCheckText } from '@/lib/english-checker/processing';
import { buildEnglishCheckReason } from '@/lib/english-checker/reason-builder';

function getConfidenceThreshold() {
  const configured = Number(process.env.RISK_CONFIDENCE_THRESHOLD);
  return Number.isFinite(configured) && configured >= 0 && configured <= 1 ? configured : 0.8;
}

export function isClearlyWrong(comparison) {
  return (
    comparison.identityRelation === 'different' ||
    comparison.partWhole === 'mismatch' ||
    comparison.setScope === 'mismatch' ||
    comparison.material === 'contradiction' ||
    comparison.function === 'contradiction' ||
    comparison.unsupportedClaims.length > 0
  );
}

export function needsRefinement(row, facts, comparison) {
  const confidenceThreshold = getConfidenceThreshold();

  return (
    ['broader', 'narrower', 'uncertain'].includes(comparison.identityRelation) ||
    ['partially_missing', 'critically_missing', 'uncertain'].includes(
      comparison.distinguishingCoverage
    ) ||
    ['uncertain'].includes(comparison.partWhole) ||
    ['uncertain'].includes(comparison.setScope) ||
    ['uncertain'].includes(comparison.material) ||
    ['uncertain'].includes(comparison.function) ||
    ['awkward', 'misleading', 'uncertain'].includes(comparison.terminology) ||
    comparison.missedImportantFacts.length > 0 ||
    comparison.confidence < confidenceThreshold ||
    facts.confidence < confidenceThreshold ||
    facts.unresolvedCriticalFacts.length > 0 ||
    isGenericOnlyEnglishName(row.productNameEn)
  );
}

export function isPotentialOK(row, facts, comparison) {
  const identityResolved = facts.productIdentity.value.trim().length > 0;
  const identityCompatible = ['exact', 'equivalent'].includes(comparison.identityRelation);
  const coverageResolved = ['complete', 'not_applicable'].includes(
    comparison.distinguishingCoverage
  );
  const dimensionsResolved =
    ['match', 'not_applicable'].includes(comparison.partWhole) &&
    ['match', 'not_applicable'].includes(comparison.setScope) &&
    ['match', 'omitted', 'not_applicable'].includes(comparison.material) &&
    ['match', 'omitted', 'not_applicable'].includes(comparison.function);
  const terminologySafe = ['natural', 'acceptable'].includes(comparison.terminology);

  return (
    identityResolved &&
    identityCompatible &&
    coverageResolved &&
    dimensionsResolved &&
    terminologySafe &&
    comparison.unsupportedClaims.length === 0 &&
    comparison.missedImportantFacts.length === 0 &&
    facts.unresolvedCriticalFacts.length === 0 &&
    comparison.confidence >= getConfidenceThreshold() &&
    facts.confidence >= getConfidenceThreshold() &&
    !isGenericOnlyEnglishName(row.productNameEn)
  );
}

export function getCandidateStatus(row, facts, comparison) {
  if (isClearlyWrong(comparison)) {
    return ENGLISH_CHECK_STATUS.WRONG;
  }

  if (needsRefinement(row, facts, comparison)) {
    return ENGLISH_CHECK_STATUS.CLOSE;
  }

  return isPotentialOK(row, facts, comparison)
    ? ENGLISH_CHECK_STATUS.OK
    : ENGLISH_CHECK_STATUS.CLOSE;
}

export function finalizeAuditResult({
  row,
  facts = null,
  comparison = null,
  verification = null,
  strictVerification = true,
  stageError = ''
}) {
  if (!normalizeEnglishCheckText(row.productNameVi)) {
    return {
      rowId: row.rowId,
      status: ENGLISH_CHECK_STATUS.MISSING,
      reason: 'Thiếu "Tên hàng hóa XNK".',
      suggestedName: ''
    };
  }

  if (!facts) {
    const status = normalizeEnglishCheckText(row.productNameEn)
      ? ENGLISH_CHECK_STATUS.CLOSE
      : ENGLISH_CHECK_STATUS.MISSING;
    return {
      rowId: row.rowId,
      status,
      reason: stageError || 'Không đủ độ tin cậy để xác nhận tên tiếng Anh.',
      suggestedName: ''
    };
  }

  if (!normalizeEnglishCheckText(row.productNameEn)) {
    return {
      rowId: row.rowId,
      status: ENGLISH_CHECK_STATUS.MISSING,
      reason: 'Thiếu "Tên TA".',
      suggestedName: facts.canonicalName.trim()
    };
  }

  if (!comparison) {
    const status = ENGLISH_CHECK_STATUS.CLOSE;
    return {
      rowId: row.rowId,
      status,
      reason: stageError || 'Không đủ độ tin cậy để xác nhận tên tiếng Anh.',
      suggestedName: facts.canonicalName.trim()
    };
  }

  let status = getCandidateStatus(row, facts, comparison);

  if (status === ENGLISH_CHECK_STATUS.OK && strictVerification) {
    const verifierConfirmed =
      verification?.verifiedOK === true &&
      verification.foundIssue === 'none' &&
      verification.severity === 'none';

    if (!verifierConfirmed) {
      status = verification?.severity === 'sai_ro'
        ? ENGLISH_CHECK_STATUS.WRONG
        : ENGLISH_CHECK_STATUS.CLOSE;
    }
  }

  return {
    rowId: row.rowId,
    status,
    reason: buildEnglishCheckReason({ row, facts, comparison, verification, status, stageError }),
    suggestedName: status === ENGLISH_CHECK_STATUS.OK ? '' : facts.canonicalName.trim()
  };
}
