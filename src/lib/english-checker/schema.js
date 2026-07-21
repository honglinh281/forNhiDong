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

export const productCheckResultSchema = z.object({
  rowId: z.string().min(1),
  status: z.enum(ENGLISH_CHECK_STATUSES),
  reason: z.string().nullable(),
  suggestedName: z.string().nullable()
});

export const checkResponseSchema = z.object({
  results: z.array(productCheckResultSchema)
});
