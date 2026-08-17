import type { ClauseAudit, ClauseType, CoveragePolicy } from '@/lib/english-checker/types';

export const AUDIT_POLICY: Readonly<Record<ClauseType, CoveragePolicy>> = Object.freeze({
  product_identity: 'MUST',
  product_subtype: 'MUST',
  material: 'MUST',
  construction: 'CONDITIONAL_MUST',
  part_whole: 'MUST',
  set_scope: 'MUST',
  shape: 'CONDITIONAL_MUST',
  technology: 'CONDITIONAL_MUST',
  mechanism: 'CONDITIONAL_MUST',
  function: 'CONDITIONAL_MUST',
  application: 'CONDITIONAL_MUST',
  electrical: 'OPTIONAL',
  dimension: 'IGNORE',
  model: 'IGNORE',
  brand: 'IGNORE',
  manufacturer: 'IGNORE',
  origin: 'IGNORE',
  condition: 'IGNORE',
  packing: 'IGNORE',
  other: 'CONDITIONAL_MUST'
});

export function policyFor(clause: ClauseAudit): CoveragePolicy {
  return AUDIT_POLICY[clause.clauseType];
}

export function isRequiredClause(clause: ClauseAudit): boolean {
  const policy = policyFor(clause);
  return policy === 'MUST' || (policy === 'CONDITIONAL_MUST' && clause.identityDefining);
}

export function allowsImplicit(clause: ClauseAudit): boolean {
  return (
    clause.englishCoverage === 'implicit' &&
    ['function', 'application'].includes(clause.clauseType) &&
    clause.evidenceImportance !== 'critical'
  );
}

export const CRITICAL_CLAIM_TYPES = new Set<ClauseType>([
  'product_identity',
  'product_subtype',
  'material',
  'construction',
  'part_whole',
  'set_scope',
  'shape',
  'technology',
  'mechanism',
  'function',
  'application'
]);
