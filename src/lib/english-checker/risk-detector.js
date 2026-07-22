import {
  ENGLISH_CHECK_GENERIC_ONLY_NAMES,
  ENGLISH_CHECK_RISK_CONFIDENCE_THRESHOLD,
  ENGLISH_CHECK_STATUS
} from '@/lib/english-checker/constants';
import { normalizeEnglishCheckText } from '@/lib/english-checker/processing';

const UNCERTAIN_CHECK_KEYS = Object.freeze([
  'coreProduct',
  'partWhole',
  'setScope',
  'specificity',
  'material',
  'function',
  'terminology'
]);

export function isGenericOnlyEnglishName(productNameEn) {
  return ENGLISH_CHECK_GENERIC_ONLY_NAMES.includes(normalizeEnglishCheckText(productNameEn));
}

function hasUncertainCheck(checks) {
  return UNCERTAIN_CHECK_KEYS.some((key) => checks[key] === 'uncertain');
}

function isSuspiciousAutoOk(row, semantic, preliminaryStatus) {
  if (preliminaryStatus !== ENGLISH_CHECK_STATUS.OK || !normalizeEnglishCheckText(row.productNameEn)) {
    return false;
  }

  // These dimensions are legitimately not applicable for many ordinary
  // products. A missing core-product comparison is the suspicious case.
  const hasNonComparableIdentity = semantic.checks.coreProduct === 'not_applicable';
  const hasDifferentSuggestion =
    normalizeEnglishCheckText(semantic.suggestedName) &&
    normalizeEnglishCheckText(semantic.suggestedName) !== normalizeEnglishCheckText(row.productNameEn);

  return semantic.checks.specificity === 'over_specific' || hasNonComparableIdentity || Boolean(hasDifferentSuggestion);
}

export function getSemanticRiskReasons(row, semantic, preliminaryStatus) {
  const reasons = [];

  if (semantic.confidence < ENGLISH_CHECK_RISK_CONFIDENCE_THRESHOLD) {
    reasons.push('low-confidence');
  }

  if (hasUncertainCheck(semantic.checks)) {
    reasons.push('uncertain-check');
  }

  if (isGenericOnlyEnglishName(row.productNameEn)) {
    reasons.push('generic-only-name');
  }

  if (semantic.checks.material === 'contradiction' || semantic.checks.unsupportedInfo) {
    reasons.push('contradiction');
  }

  if (isSuspiciousAutoOk(row, semantic, preliminaryStatus)) {
    reasons.push('suspicious-ok');
  }

  return reasons;
}

export function isSemanticCheckRisky(row, semantic, preliminaryStatus) {
  return getSemanticRiskReasons(row, semantic, preliminaryStatus).length > 0;
}
