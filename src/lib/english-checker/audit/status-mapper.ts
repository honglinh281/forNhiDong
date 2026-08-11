import { hasGenericEnglishName } from '@/lib/english-checker/audit/generic-name-guard';
import { inspectMaterialCoverage } from '@/lib/english-checker/audit/material-guard';
import { allowsImplicit, CRITICAL_CLAIM_TYPES, isRequiredClause } from '@/lib/english-checker/audit/policy';
import { buildAuditReason } from '@/lib/english-checker/audit/reason-builder';
import { calculateAuditRisk } from '@/lib/english-checker/audit/risk-score';
import { RISK_CONFIDENCE_THRESHOLD } from '@/lib/english-checker/constants';
import { normalizeSearchText } from '@/lib/english-checker/normalization/normalize-vietnamese';
import type {
  AiMicroAuditItem,
  AuditRequestItem,
  CheckStatus,
  FinalAuditResult,
  ProductRow
} from '@/lib/english-checker/types';

function hasClearError(audit: AiMicroAuditItem): boolean {
  if (audit.productIdentity.relation === 'different') return true;

  if (
    audit.clauseAudits.some(
      (clause) => isRequiredClause(clause) && clause.englishCoverage === 'contradiction'
    )
  ) {
    return true;
  }

  return audit.englishClaims.some(
    (claim) =>
      claim.criticality === 'critical' &&
      CRITICAL_CLAIM_TYPES.has(claim.claimType) &&
      ['contradicted', 'unsupported'].includes(claim.vietnameseSupport)
  );
}

function requiredClausesAreCovered(audit: AiMicroAuditItem): boolean {
  return audit.clauseAudits.filter(isRequiredClause).every((clause) =>
    ['explicit', 'semantic_equivalent'].includes(clause.englishCoverage) || allowsImplicit(clause)
  );
}

function criticalEnglishClaimsAreSafe(audit: AiMicroAuditItem): boolean {
  return audit.englishClaims.every(
    (claim) =>
      claim.criticality !== 'critical' ||
      !CRITICAL_CLAIM_TYPES.has(claim.claimType) ||
      ['supported', 'equivalent'].includes(claim.vietnameseSupport)
  );
}

export function mapAuditToStatus(
  row: ProductRow,
  audit: AiMicroAuditItem
): CheckStatus {
  if (!normalizeSearchText(row.productNameVi)) return 'Thiếu dữ liệu';
  if (!normalizeSearchText(row.productNameEn)) return 'Thiếu dữ liệu';

  const material = inspectMaterialCoverage(row.productNameVi, row.productNameEn);
  if (material.contradiction || material.unsupportedInEnglish.length || hasClearError(audit)) {
    return 'Sai rõ';
  }

  const identityOK = ['exact', 'equivalent'].includes(audit.productIdentity.relation);
  const genericNameRisk = hasGenericEnglishName(row.productNameEn);
  const canBeOK =
    identityOK &&
    !genericNameRisk &&
    material.missingFromEnglish.length === 0 &&
    audit.unresolvedCriticalFacts.length === 0 &&
    requiredClausesAreCovered(audit) &&
    criticalEnglishClaimsAreSafe(audit) &&
    audit.overallConfidence >= RISK_CONFIDENCE_THRESHOLD;

  return canBeOK ? 'OK' : 'Chưa sát';
}

export function finalizeAuditResult(
  row: ProductRow,
  requestItem: AuditRequestItem,
  audit: AiMicroAuditItem
): FinalAuditResult {
  const status = mapAuditToStatus(row, audit);
  const material = inspectMaterialCoverage(row.productNameVi, row.productNameEn);
  const genericNameRisk = hasGenericEnglishName(row.productNameEn);
  const canonicalEnglishName = audit.canonicalEnglishName.trim();
  const reason =
    status === 'Thiếu dữ liệu'
      ? normalizeSearchText(row.productNameVi)
        ? 'Thiếu "Tên TA".'
        : 'Thiếu "Tên hàng hóa XNK".'
      : buildAuditReason({ status, audit, material, genericNameRisk });

  return {
    rowId: row.rowId,
    status,
    reason: status === 'OK' ? '' : reason,
    suggestedName: status === 'OK' ? '' : canonicalEnglishName,
    riskScore: calculateAuditRisk(row, requestItem, audit),
    audit,
    guards: { material, genericNameRisk }
  };
}
