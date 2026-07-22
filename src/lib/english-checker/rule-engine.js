import { ENGLISH_CHECK_STATUS } from '@/lib/english-checker/constants';
import { normalizeEnglishCheckText } from '@/lib/english-checker/processing';
import { buildEnglishCheckReason } from '@/lib/english-checker/reason-builder';
import { getSemanticRiskReasons } from '@/lib/english-checker/risk-detector';

function hasHardMismatch(checks) {
  return (
    checks.coreProduct === 'mismatch' ||
    checks.partWhole === 'mismatch' ||
    checks.setScope === 'mismatch' ||
    checks.function === 'mismatch' ||
    checks.material === 'contradiction' ||
    checks.terminology === 'wrong' ||
    checks.unsupportedInfo
  );
}

function hasExplicitUncertainty(checks) {
  return (
    checks.coreProduct === 'uncertain' ||
    checks.partWhole === 'uncertain' ||
    checks.setScope === 'uncertain' ||
    checks.specificity === 'uncertain' ||
    checks.material === 'uncertain' ||
    checks.function === 'uncertain' ||
    checks.terminology === 'uncertain'
  );
}

function getPreliminaryStatus(semantic) {
  if (hasHardMismatch(semantic.checks)) {
    return ENGLISH_CHECK_STATUS.WRONG;
  }

  if (semantic.checks.specificity === 'too_generic' || hasExplicitUncertainty(semantic.checks)) {
    return ENGLISH_CHECK_STATUS.CLOSE;
  }

  return ENGLISH_CHECK_STATUS.OK;
}

function selectSuggestedName(row, semantic, status) {
  if (status === ENGLISH_CHECK_STATUS.OK) {
    return null;
  }

  const suggestion = semantic.suggestedName?.trim() || semantic.canonicalName?.trim() || null;

  if (
    suggestion &&
    normalizeEnglishCheckText(suggestion) === normalizeEnglishCheckText(row.productNameEn) &&
    normalizeEnglishCheckText(row.productNameEn)
  ) {
    return null;
  }

  return suggestion;
}

export function mapSemanticCheckToResult(row, semantic) {
  if (!normalizeEnglishCheckText(row.productNameVi)) {
    return {
      rowId: row.rowId,
      status: ENGLISH_CHECK_STATUS.MISSING,
      reason: 'Thiếu "Tên hàng hóa XNK".',
      suggestedName: null
    };
  }

  if (!normalizeEnglishCheckText(row.productNameEn)) {
    return {
      rowId: row.rowId,
      status: ENGLISH_CHECK_STATUS.MISSING,
      reason: 'Thiếu "Tên TA".',
      suggestedName: semantic.suggestedName?.trim() || semantic.canonicalName.trim()
    };
  }

  const preliminaryStatus = getPreliminaryStatus(semantic);
  const riskReasons = getSemanticRiskReasons(row, semantic, preliminaryStatus);
  const status =
    preliminaryStatus === ENGLISH_CHECK_STATUS.OK && riskReasons.length
      ? ENGLISH_CHECK_STATUS.CLOSE
      : preliminaryStatus;

  return {
    rowId: row.rowId,
    status,
    reason: buildEnglishCheckReason({ status, semantic, riskReasons }),
    suggestedName: selectSuggestedName(row, semantic, status)
  };
}

export function mapSemanticChecksToResults(rows, semanticChecks) {
  const semanticByRowId = new Map(semanticChecks.map((semantic) => [semantic.rowId, semantic]));

  return rows.map((row) => {
    const semantic = semanticByRowId.get(row.rowId);

    if (!semantic) {
      throw new Error(`Thiếu semantic analysis cho dòng ${row.rowId}.`);
    }

    return mapSemanticCheckToResult(row, semantic);
  });
}

export function getPreliminarySemanticStatus(semantic) {
  return getPreliminaryStatus(semantic);
}
