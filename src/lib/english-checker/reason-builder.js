import { ENGLISH_CHECK_STATUS } from '@/lib/english-checker/constants';
import { isGenericOnlyEnglishName } from '@/lib/english-checker/generic-name-rule';

function quote(value) {
  const normalized = String(value ?? '').trim();
  return normalized ? `“${normalized}”` : 'tên hiện tại';
}

function joinFacts(values) {
  return values.filter(Boolean).join(', ');
}

export function buildEnglishCheckReason({ row, facts, comparison, verification, status, stageError }) {
  if (status === ENGLISH_CHECK_STATUS.OK) {
    return '';
  }

  if (status === ENGLISH_CHECK_STATUS.MISSING) {
    return row.productNameVi?.trim() ? 'Thiếu "Tên TA".' : 'Thiếu "Tên hàng hóa XNK".';
  }

  if (stageError) {
    return stageError;
  }

  if (
    verification &&
    (!verification.verifiedOK || verification.foundIssue !== 'none' || verification.severity !== 'none')
  ) {
    return verification.explanation.trim() || 'Lượt rà soát nghiêm ngặt phát hiện tên tiếng Anh chưa đủ an toàn để xác nhận.';
  }

  const currentCore = comparison?.englishClaims?.coreProduct || row.productNameEn;
  const actualIdentity = facts?.productIdentity?.value || facts?.canonicalName;

  if (status === ENGLISH_CHECK_STATUS.WRONG) {
    if (comparison?.identityRelation === 'different') {
      return `Tên TA hiện tại mô tả ${quote(currentCore)}, trong khi hàng hóa thực tế là ${quote(actualIdentity)}.`;
    }

    if (comparison?.partWhole === 'mismatch') {
      return `Tên TA hiện tại mâu thuẫn quan hệ bộ phận/sản phẩm hoàn chỉnh; mô tả tiếng Việt xác định ${quote(actualIdentity)}.`;
    }

    if (comparison?.setScope === 'mismatch') {
      return `Tên TA hiện tại mâu thuẫn phạm vi bộ hàng/thành phần với ${quote(actualIdentity)}.`;
    }

    if (comparison?.material === 'contradiction') {
      const englishMaterial = comparison.englishClaims.claims.material;
      const vietnameseMaterial = facts?.factualConstraints?.material?.value;
      return `Tên TA ghi vật liệu ${quote(englishMaterial)}, nhưng mô tả tiếng Việt xác định ${quote(vietnameseMaterial)}.`;
    }

    if (comparison?.function === 'contradiction') {
      const englishFunction = comparison.englishClaims.claims.function;
      const vietnameseFunction = facts?.factualConstraints?.function?.value;
      return `Tên TA mô tả công dụng ${quote(englishFunction)}, nhưng hàng hóa thực tế có công dụng ${quote(vietnameseFunction)}.`;
    }

    if (comparison?.unsupportedClaims?.length) {
      return `Tên TA có thông tin không được mô tả tiếng Việt hỗ trợ: ${comparison.unsupportedClaims.join(', ')}.`;
    }
  }

  if (comparison?.identityRelation === 'broader') {
    const missing = joinFacts(comparison.missedImportantFacts);
    return `${quote(currentCore)} đúng nhóm sản phẩm nhưng chưa thể hiện ${missing ? quote(missing) : `đầy đủ ${quote(facts?.canonicalName)}`}.`;
  }

  if (isGenericOnlyEnglishName(row.productNameEn)) {
    return `${quote(row.productNameEn)} quá chung; mô tả hàng hóa xác định cụ thể là ${quote(facts?.canonicalName)}.`;
  }

  if (comparison?.identityRelation === 'narrower') {
    return `${quote(currentCore)} cụ thể hơn phạm vi được mô tả tiếng Việt hỗ trợ; tên chuẩn là ${quote(facts?.canonicalName)}.`;
  }

  if (
    ['partially_missing', 'critically_missing'].includes(comparison?.distinguishingCoverage) ||
    comparison?.missedImportantFacts?.length
  ) {
    const missing = joinFacts(comparison?.missedImportantFacts ?? []) ||
      joinFacts((facts?.distinguishingQualifiers ?? []).map((fact) => fact.value));
    return `${quote(currentCore)} còn thiếu đặc điểm định danh ${quote(missing)}.`;
  }

  if (facts?.unresolvedCriticalFacts?.length) {
    return `Chưa thể xác minh đầy đủ thông tin quan trọng: ${facts.unresolvedCriticalFacts.join(', ')}.`;
  }

  if (comparison?.terminology === 'awkward' || comparison?.terminology === 'misleading') {
    return `${quote(currentCore)} chưa dùng thuật ngữ thương mại sát nghĩa; tên đề xuất là ${quote(facts?.canonicalName)}.`;
  }

  return 'Không đủ độ tin cậy để xác nhận tên tiếng Anh.';
}
