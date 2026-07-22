import { z } from 'zod';

import { ENGLISH_CHECK_STATUSES } from '@/lib/english-checker/constants';

export const productCheckInputSchema = z.object({
  rowId: z.string().min(1),
  sheet: z.string().min(1),
  excelRow: z.number().int().positive(),
  stt: z.union([z.string(), z.number()]).nullable().optional(),
  productNameVi: z.string().nullable(),
  productNameEn: z.string().nullable()
});

export const checkRequestSchema = z.object({
  rows: z.array(productCheckInputSchema).min(1).max(100)
});

export const semanticRelationSchema = z.enum([
  'exact',
  'equivalent',
  'broader',
  'narrower',
  'different',
  'uncertain',
  'not_applicable'
]);

const productIdentityRelationSchema = z.enum([
  'exact',
  'equivalent',
  'broader',
  'narrower',
  'different',
  'uncertain'
]);

const partWholeScopeSchema = z.enum([
  'complete_product',
  'part',
  'accessory',
  'consumable',
  'not_applicable',
  'uncertain'
]);

const setScopeSchema = z.enum(['single', 'set', 'component_of_set', 'not_applicable', 'uncertain']);
const terminologyStateSchema = z.enum(['natural', 'acceptable', 'awkward', 'wrong', 'uncertain']);

export const semanticCheckDetailsSchema = z.object({
  canonicalName: z.string().min(1),
  coreProduct: z.string().min(1),
  productClass: z.string().min(1),
  specificSubtype: z.string().nullable(),
  partWholeScope: partWholeScopeSchema,
  setScope: setScopeSchema,
  criticalQualifiers: z.array(z.string()),
  optionalQualifiers: z.array(z.string()),
  comparison: z.object({
    productIdentity: productIdentityRelationSchema,
    partWhole: semanticRelationSchema,
    setScope: semanticRelationSchema,
    material: semanticRelationSchema,
    function: semanticRelationSchema,
    terminology: terminologyStateSchema,
    unsupportedInfo: z.boolean()
  }),
  confidence: z.number().min(0).max(1)
});

export const semanticCheckSchema = semanticCheckDetailsSchema.extend({
  rowId: z.string().min(1)
});

export function createSemanticCheckResponseSchema(rowIds) {
  const uniqueRowIds = new Set(rowIds);

  if (!rowIds.length || uniqueRowIds.size !== rowIds.length) {
    throw new Error('Danh sách rowId gửi tới OpenAI không hợp lệ.');
  }

  const resultsByRowId = Object.fromEntries(
    rowIds.map((rowId) => [rowId, semanticCheckDetailsSchema])
  );

  return z.object({
    results: z.object(resultsByRowId)
  });
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
