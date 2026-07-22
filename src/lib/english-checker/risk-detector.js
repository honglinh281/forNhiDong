import {
  ENGLISH_CHECK_GENERIC_ONLY_NAMES,
  ENGLISH_CHECK_RISK_CONFIDENCE_THRESHOLD,
  ENGLISH_CHECK_STATUS
} from '@/lib/english-checker/constants';
import { normalizeEnglishCheckText } from '@/lib/english-checker/processing';

const RELATION_KEYS = Object.freeze([
  'productIdentity',
  'partWhole',
  'setScope',
  'material',
  'function'
]);

export function isGenericOnlyEnglishName(productNameEn) {
  return ENGLISH_CHECK_GENERIC_ONLY_NAMES.includes(normalizeEnglishCheckText(productNameEn));
}

function hasRelation(comparison, relation) {
  return RELATION_KEYS.some((key) => comparison[key] === relation);
}

function tokenizeName(value) {
  return normalizeEnglishCheckText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function hasLowLexicalOverlap(row, semantic) {
  const currentTokens = new Set(tokenizeName(row.productNameEn));
  const canonicalTokens = new Set(tokenizeName(semantic.canonicalName));
  const smallerSize = Math.min(currentTokens.size, canonicalTokens.size);

  if (!smallerSize) {
    return false;
  }

  const sharedCount = [...currentTokens].filter((token) => canonicalTokens.has(token)).length;
  return sharedCount / smallerSize < 0.5;
}

function hasContradiction(comparison) {
  return (
    comparison.productIdentity === 'different' ||
    comparison.partWhole === 'different' ||
    comparison.setScope === 'different' ||
    comparison.material === 'different' ||
    comparison.function === 'different'
  );
}

function isSuspiciousAutoOk(row, semantic, preliminaryStatus) {
  if (preliminaryStatus !== ENGLISH_CHECK_STATUS.OK) {
    return false;
  }

  return (
    !['exact', 'equivalent'].includes(semantic.comparison.productIdentity) ||
    semantic.comparison.unsupportedInfo ||
    ['awkward', 'wrong', 'uncertain'].includes(semantic.comparison.terminology) ||
    hasLowLexicalOverlap(row, semantic)
  );
}

export function getSemanticRiskReasons(row, semantic, preliminaryStatus) {
  const reasons = [];

  if (!normalizeEnglishCheckText(row.productNameEn)) {
    return reasons;
  }

  if (semantic.calibratedByRule) {
    return reasons;
  }

  if (semantic.confidence < ENGLISH_CHECK_RISK_CONFIDENCE_THRESHOLD) {
    reasons.push('low-confidence');
  }

  if (hasRelation(semantic.comparison, 'uncertain') || semantic.comparison.terminology === 'uncertain') {
    reasons.push('uncertain-comparison');
  }

  if (['broader', 'narrower'].includes(semantic.comparison.productIdentity)) {
    reasons.push('relationship-review');
  }

  if (isGenericOnlyEnglishName(row.productNameEn)) {
    reasons.push('generic-only-name');
  }

  if (hasContradiction(semantic.comparison)) {
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
