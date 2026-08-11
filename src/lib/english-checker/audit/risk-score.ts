import { hasGenericEnglishName } from '@/lib/english-checker/audit/generic-name-guard';
import { inspectMaterialCoverage } from '@/lib/english-checker/audit/material-guard';
import { hasColonDetail } from '@/lib/english-checker/normalization/split-clauses';
import type { AiMicroAuditItem, AuditRequestItem, ProductRow } from '@/lib/english-checker/types';

export function calculateAuditRisk(
  row: ProductRow,
  requestItem: AuditRequestItem,
  audit: AiMicroAuditItem
): number {
  let score = 0;
  const material = inspectMaterialCoverage(row.productNameVi, row.productNameEn);
  const vi = row.productNameVi ?? '';

  if (vi.length > 180) score += 2;
  if (requestItem.clauses.length >= 7) score += 2;
  if (hasColonDetail(vi)) score += 2;
  if (material.vietnameseMaterials.length) score += 2;
  if (/\b(gồm|bộ phận|linh kiện|phụ kiện|bộ)\b/iu.test(vi)) score += 2;
  if (material.vietnameseMaterials.length > 1) score += 2;
  if (audit.productIdentity.relation === 'broader') score += 3;
  if (audit.overallConfidence < 0.9) score += 2;
  if (hasGenericEnglishName(row.productNameEn)) score += 3;
  if (audit.clauseAudits.some((clause) => clause.englishCoverage === 'uncertain')) score += 3;
  return score;
}
