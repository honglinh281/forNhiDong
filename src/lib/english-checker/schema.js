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

const matchStateSchema = z.enum(['match', 'mismatch', 'uncertain', 'not_applicable']);
const specificityStateSchema = z.enum(['sufficient', 'too_generic', 'over_specific', 'uncertain']);
const materialStateSchema = z.enum([
  'match',
  'contradiction',
  'missing_but_optional',
  'uncertain',
  'not_applicable'
]);
const terminologyStateSchema = z.enum(['natural', 'acceptable', 'wrong', 'uncertain']);

export const semanticCheckSchema = z.object({
  rowId: z.string().min(1),
  canonicalName: z.string().min(1),
  coreProduct: z.string().min(1),
  criticalAttributes: z.array(z.string()),
  optionalAttributes: z.array(z.string()),
  checks: z.object({
    coreProduct: matchStateSchema,
    partWhole: matchStateSchema,
    setScope: matchStateSchema,
    specificity: specificityStateSchema,
    material: materialStateSchema,
    function: matchStateSchema,
    terminology: terminologyStateSchema,
    unsupportedInfo: z.boolean()
  }),
  suggestedName: z.string().nullable(),
  confidence: z.number().min(0).max(1)
});

export const semanticCheckResponseSchema = z.object({
  results: z.array(semanticCheckSchema)
});

export const productCheckResultSchema = z.object({
  rowId: z.string().min(1),
  status: z.enum(ENGLISH_CHECK_STATUSES),
  reason: z.string().nullable(),
  suggestedName: z.string().nullable()
});

export const checkResponseSchema = z.object({
  results: z.array(productCheckResultSchema)
});
