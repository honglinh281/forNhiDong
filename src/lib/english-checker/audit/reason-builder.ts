import { formatMaterial } from '@/lib/english-checker/audit/material-guard';
import { isRequiredClause } from '@/lib/english-checker/audit/policy';
import type { AiMicroAuditItem, CheckStatus, MaterialGuardResult } from '@/lib/english-checker/types';

function quoteList(values: string[]): string {
  return values.map((value) => `"${value}"`).join(', ');
}

export function buildAuditReason({
  status,
  audit,
  material,
  genericNameRisk
}: {
  status: CheckStatus;
  audit: AiMicroAuditItem;
  material: MaterialGuardResult;
  genericNameRisk: boolean;
}): string {
  if (status === 'OK') return '';

  if (material.contradiction) {
    return `Tên TA ghi vật liệu ${quoteList(material.englishMaterials.map(formatMaterial))}, trong khi mô tả tiếng Việt ghi ${quoteList(material.vietnameseMaterials.map(formatMaterial))}.`;
  }

  if (material.unsupportedInEnglish.length) {
    return `Tên TA thêm vật liệu ${quoteList(material.unsupportedInEnglish.map(formatMaterial))} nhưng mô tả tiếng Việt không hỗ trợ thông tin này.`;
  }

  if (audit.productIdentity.relation === 'different') {
    const vi = audit.productIdentity.vietnamese || 'hàng hóa trong mô tả tiếng Việt';
    const en = audit.productIdentity.english || 'Tên TA hiện tại';
    return `Tên TA mô tả "${en}", trong khi hàng hóa thực tế là "${vi}".`;
  }

  const contradictedClaim = audit.englishClaims.find(
    (claim) => claim.criticality === 'critical' && claim.vietnameseSupport === 'contradicted'
  );
  if (contradictedClaim) {
    return `Thông tin "${contradictedClaim.normalizedFact || contradictedClaim.claimText}" trong Tên TA mâu thuẫn với mô tả tiếng Việt.`;
  }

  const unsupportedClaim = audit.englishClaims.find(
    (claim) => claim.criticality === 'critical' && claim.vietnameseSupport === 'unsupported'
  );
  if (unsupportedClaim) {
    return `Tên TA thêm thông tin định danh "${unsupportedClaim.normalizedFact || unsupportedClaim.claimText}" nhưng mô tả tiếng Việt không hỗ trợ.`;
  }

  if (material.missingFromEnglish.length) {
    return `Tên TA thiếu vật liệu ${quoteList(material.missingFromEnglish.map(formatMaterial))} được nêu rõ trong mô tả hàng hóa tiếng Việt.`;
  }

  const contradictedClause = audit.clauseAudits.find(
    (clause) => isRequiredClause(clause) && clause.englishCoverage === 'contradiction'
  );
  if (contradictedClause) {
    return `Tên TA mâu thuẫn với yếu tố bắt buộc "${contradictedClause.normalizedFact || contradictedClause.clauseText}".`;
  }

  const missingClause = audit.clauseAudits.find(
    (clause) =>
      isRequiredClause(clause) &&
      ['missing', 'uncertain'].includes(clause.englishCoverage)
  );
  if (missingClause) {
    const fact = missingClause.normalizedFact || missingClause.clauseText;
    if (missingClause.clauseType === 'shape') {
      return `Tên TA đúng nhóm hàng nhưng thiếu đặc điểm định danh "${fact}".`;
    }
    if (missingClause.clauseType === 'product_subtype') {
      return `Tên TA quá chung và thiếu loại hàng cụ thể "${fact}".`;
    }
    return `Tên TA chưa thể hiện đầy đủ yếu tố bắt buộc "${fact}".`;
  }

  if (genericNameRisk || audit.productIdentity.relation === 'broader') {
    return `"${audit.productIdentity.english || 'Tên TA hiện tại'}" quá chung; mô tả tiếng Việt xác định cụ thể là "${audit.productIdentity.vietnamese}".`;
  }

  if (audit.productIdentity.relation === 'narrower') {
    return 'Tên TA cụ thể hơn phạm vi thông tin được hỗ trợ trong mô tả tiếng Việt.';
  }

  if (audit.unresolvedCriticalFacts.length) {
    return `Chưa đủ cơ sở xác nhận yếu tố quan trọng "${audit.unresolvedCriticalFacts[0]}".`;
  }

  return 'Không đủ cơ sở để xác nhận đầy đủ các yếu tố của Tên TA.';
}
