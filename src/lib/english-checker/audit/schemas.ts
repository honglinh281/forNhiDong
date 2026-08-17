import { z } from 'zod';

import { AUDIT_MAX_ITEMS, ENGLISH_CHECK_STATUSES } from '@/lib/english-checker/constants';

export const clauseTypeSchema = z.enum([
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
  'application',
  'electrical',
  'dimension',
  'model',
  'brand',
  'manufacturer',
  'origin',
  'condition',
  'packing',
  'other'
]);

export const coverageStateSchema = z.enum([
  'explicit',
  'semantic_equivalent',
  'implicit',
  'missing',
  'contradiction',
  'uncertain'
]);

export const inputClauseSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  preTypeHint: z.union([clauseTypeSchema, z.literal('unknown')])
}).strict();

export const auditRequestItemSchema = z.object({
  rowId: z.string().min(1),
  originalVietnamese: z.string().min(1),
  normalizedVietnamese: z.string().min(1),
  currentEnglish: z.string(),
  clauses: z.array(inputClauseSchema).min(1).max(40),
  secondaryContext: z.object({
    checkInfo: z.string(),
    customerFeedback: z.string()
  }).strict(),
  glossaryHints: z.array(z.object({
    vi: z.string().min(1),
    preferredEnglish: z.string().min(1)
  }).strict()).max(20)
}).strict();

export const auditRequestSchema = z.object({
  requestId: z.string().min(1),
  items: z.array(auditRequestItemSchema).min(1).max(AUDIT_MAX_ITEMS)
}).strict();

export const clauseAuditSchema = z.object({
  clauseId: z.string().min(1),
  clauseText: z.string(),
  clauseType: clauseTypeSchema,
  normalizedFact: z.string(),
  identityDefining: z.boolean(),
  evidenceImportance: z.enum(['critical', 'supporting', 'administrative']),
  englishCoverage: coverageStateSchema,
  englishEvidence: z.string().nullable(),
  note: z.string().nullable()
}).strict();

export const englishClaimSchema = z.object({
  claimId: z.string().min(1),
  claimText: z.string().min(1),
  claimType: clauseTypeSchema,
  normalizedFact: z.string(),
  criticality: z.enum(['critical', 'supporting', 'administrative']),
  vietnameseSupport: z.enum([
    'supported',
    'equivalent',
    'unsupported',
    'contradicted',
    'uncertain'
  ]),
  vietnameseEvidence: z.string().nullable()
}).strict();

export const aiMicroAuditItemSchema = z.object({
  rowId: z.string().min(1),
  canonicalEnglishName: z.string().min(1),
  productIdentity: z.object({
    vietnamese: z.string(),
    english: z.string(),
    relation: z.enum(['exact', 'equivalent', 'broader', 'narrower', 'different', 'uncertain'])
  }).strict(),
  clauseAudits: z.array(clauseAuditSchema),
  englishClaims: z.array(englishClaimSchema),
  unresolvedCriticalFacts: z.array(z.string()),
  overallConfidence: z.number().min(0).max(1)
}).strict();

export const aiMicroAuditResponseSchema = z.object({
  items: z.array(aiMicroAuditItemSchema).min(1).max(AUDIT_MAX_ITEMS)
}).strict();

export const auditResponseSchema = z.object({
  requestId: z.string().min(1),
  items: z.array(aiMicroAuditItemSchema).min(1).max(AUDIT_MAX_ITEMS),
  meta: z.object({
    model: z.string().min(1),
    durationMs: z.number().nonnegative()
  }).strict()
}).strict();

export const auditErrorCodeSchema = z.enum([
  'INVALID_INPUT',
  'AUDIT_TIMEOUT',
  'UPSTREAM_RATE_LIMIT',
  'UPSTREAM_ERROR',
  'INVALID_AI_SCHEMA',
  'INCOMPLETE_CLAUSE_COVERAGE',
  'UNKNOWN_ERROR'
]);

export const auditErrorResponseSchema = z.object({
  error: z.object({
    code: auditErrorCodeSchema,
    message: z.string(),
    retryable: z.boolean()
  }).strict()
}).strict();

export const finalAuditResultSchema = z.object({
  rowId: z.string().min(1),
  status: z.enum(ENGLISH_CHECK_STATUSES),
  reason: z.string(),
  suggestedName: z.string(),
  riskScore: z.number().nonnegative()
});
