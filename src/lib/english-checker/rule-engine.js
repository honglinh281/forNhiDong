import {
  ENGLISH_CHECK_RISK_CONFIDENCE_THRESHOLD,
  ENGLISH_CHECK_STATUS
} from '@/lib/english-checker/constants';
import { normalizeEnglishCheckText } from '@/lib/english-checker/processing';
import { buildEnglishCheckReason } from '@/lib/english-checker/reason-builder';
import {
  getSemanticRiskReasons,
  isGenericOnlyEnglishName
} from '@/lib/english-checker/risk-detector';

const COMPARISON_RELATION_KEYS = Object.freeze([
  'productIdentity',
  'partWhole',
  'setScope',
  'material',
  'function'
]);

function hasHardDifference(comparison) {
  return (
    comparison.productIdentity === 'different' ||
    comparison.partWhole === 'different' ||
    comparison.setScope === 'different' ||
    comparison.material === 'different' ||
    comparison.function === 'different'
  );
}

function hasUncertainComparison(comparison) {
  return (
    COMPARISON_RELATION_KEYS.some((key) => comparison[key] === 'uncertain') ||
    comparison.terminology === 'uncertain'
  );
}

function getPreliminaryStatus(row, semantic) {
  const { comparison } = semantic;

  if (hasHardDifference(comparison)) {
    return ENGLISH_CHECK_STATUS.WRONG;
  }

  if (
    ['broader', 'narrower', 'uncertain'].includes(comparison.productIdentity) ||
    hasUncertainComparison(comparison) ||
    ['awkward', 'wrong'].includes(comparison.terminology) ||
    comparison.unsupportedInfo ||
    semantic.confidence < ENGLISH_CHECK_RISK_CONFIDENCE_THRESHOLD ||
    isGenericOnlyEnglishName(row.productNameEn)
  ) {
    return ENGLISH_CHECK_STATUS.CLOSE;
  }

  return ENGLISH_CHECK_STATUS.OK;
}

function selectSuggestedName(semantic, status) {
  return status === ENGLISH_CHECK_STATUS.OK ? '' : semantic.canonicalName.trim();
}

export function mapSemanticCheckToResult(row, semantic) {
  if (!normalizeEnglishCheckText(row.productNameVi)) {
    return {
      rowId: row.rowId,
      status: ENGLISH_CHECK_STATUS.MISSING,
      reason: 'Thiếu "Tên hàng hóa XNK".',
      suggestedName: ''
    };
  }

  if (!normalizeEnglishCheckText(row.productNameEn)) {
    return {
      rowId: row.rowId,
      status: ENGLISH_CHECK_STATUS.MISSING,
      reason: 'Thiếu "Tên TA".',
      suggestedName: semantic.canonicalName.trim()
    };
  }

  const preliminaryStatus = getPreliminaryStatus(row, semantic);
  const riskReasons = getSemanticRiskReasons(row, semantic, preliminaryStatus);
  const status =
    preliminaryStatus === ENGLISH_CHECK_STATUS.OK && riskReasons.length
      ? ENGLISH_CHECK_STATUS.CLOSE
      : preliminaryStatus;

  return {
    rowId: row.rowId,
    status,
    reason: buildEnglishCheckReason({ status, semantic, riskReasons }),
    suggestedName: selectSuggestedName(semantic, status)
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

export function getPreliminarySemanticStatus(row, semantic) {
  return getPreliminaryStatus(row, semantic);
}
