import { z } from 'zod';

import { ENGLISH_CHECK_STATUSES } from '@/lib/english-checker/constants';

export const productCheckInputSchema = z.object({
  rowId: z.string().min(1),
  sheet: z.string().min(1),
  excelRow: z.number().int().positive(),
  stt: z.union([z.string(), z.number()]).nullable().optional(),
  productNameVi: z.string().nullable(),
  productNameEn: z.string().nullable(),
  checkInfo: z.string().nullable().optional(),
  customerFeedback: z.string().nullable().optional()
});

export const checkRequestSchema = z.object({
  rows: z.array(productCheckInputSchema).min(1).max(100)
});

export const evidenceFactSchema = z.object({
  value: z.string().min(1),
  evidence: z.string().min(1)
});

export const vietnameseProductFactsDetailsSchema = z.object({
  canonicalName: z.string().min(1),
  productIdentity: evidenceFactSchema,
  productClass: evidenceFactSchema.nullable(),
  subtype: evidenceFactSchema.nullable(),
  scope: z.enum(['single_product', 'set', 'part', 'accessory', 'machine', 'unknown']),
  distinguishingQualifiers: z.array(evidenceFactSchema),
  factualConstraints: z.object({
    material: evidenceFactSchema.nullable(),
    function: evidenceFactSchema.nullable(),
    application: evidenceFactSchema.nullable(),
    composition: evidenceFactSchema.nullable()
  }),
  administrativeInfo: z.array(z.string()),
  unresolvedCriticalFacts: z.array(z.string()),
  confidence: z.number().min(0).max(1)
});

export const vietnameseProductFactsSchema = vietnameseProductFactsDetailsSchema.extend({
  rowId: z.string().min(1)
});

export const englishNameClaimsSchema = z.object({
  coreProduct: z.string().min(1),
  productClass: z.string().nullable(),
  subtype: z.string().nullable(),
  scope: z.enum(['single_product', 'set', 'part', 'accessory', 'machine', 'unknown']),
  qualifiers: z.array(z.string()),
  claims: z.object({
    material: z.string().nullable(),
    function: z.string().nullable(),
    application: z.string().nullable()
  })
});

export const semanticComparisonDetailsSchema = z.object({
  englishClaims: englishNameClaimsSchema,
  identityRelation: z.enum(['exact', 'equivalent', 'broader', 'narrower', 'different', 'uncertain']),
  distinguishingCoverage: z.enum([
    'complete',
    'partially_missing',
    'critically_missing',
    'not_applicable',
    'uncertain'
  ]),
  partWhole: z.enum(['match', 'mismatch', 'not_applicable', 'uncertain']),
  setScope: z.enum(['match', 'mismatch', 'not_applicable', 'uncertain']),
  material: z.enum(['match', 'omitted', 'contradiction', 'not_applicable', 'uncertain']),
  function: z.enum(['match', 'omitted', 'contradiction', 'not_applicable', 'uncertain']),
  terminology: z.enum(['natural', 'acceptable', 'awkward', 'misleading', 'uncertain']),
  unsupportedClaims: z.array(z.string()),
  missedImportantFacts: z.array(z.string()),
  confidence: z.number().min(0).max(1)
});

export const semanticComparisonSchema = semanticComparisonDetailsSchema.extend({
  rowId: z.string().min(1)
});

export const okVerificationDetailsSchema = z.object({
  verifiedOK: z.boolean(),
  foundIssue: z.enum([
    'none',
    'identity',
    'specificity',
    'material',
    'function',
    'part_whole',
    'set_scope',
    'unsupported_claim',
    'terminology',
    'unresolved'
  ]),
  severity: z.enum(['none', 'chua_sat', 'sai_ro']),
  evidence: z.string().nullable(),
  explanation: z.string()
});

export const okVerificationSchema = okVerificationDetailsSchema.extend({
  rowId: z.string().min(1)
});

function createKeyedResponseSchema(rowIds, detailSchema) {
  const uniqueRowIds = new Set(rowIds);

  if (!rowIds.length || uniqueRowIds.size !== rowIds.length) {
    throw new Error('Danh sách rowId gửi tới OpenAI không hợp lệ.');
  }

  return z.object({
    results: z.object(Object.fromEntries(rowIds.map((rowId) => [rowId, detailSchema])))
  });
}

export function createProductFactsResponseSchema(rowIds) {
  return createKeyedResponseSchema(rowIds, vietnameseProductFactsDetailsSchema);
}

export function createSemanticComparisonResponseSchema(rowIds) {
  return createKeyedResponseSchema(rowIds, semanticComparisonDetailsSchema);
}

export function createOKVerificationResponseSchema(rowIds) {
  return createKeyedResponseSchema(rowIds, okVerificationDetailsSchema);
}

export const productCheckResultSchema = z.object({
  rowId: z.string().min(1),
  status: z.enum(ENGLISH_CHECK_STATUSES),
  reason: z.string(),
  suggestedName: z.string()
});

export const checkResponseSchema = z.object({
  results: z.array(productCheckResultSchema)
});
