import { ENGLISH_CHECK_STATUS } from '@/lib/english-checker/constants';

const HARD_MISMATCH_REASONS = Object.freeze([
  ['coreProduct', 'Tên TA hiện tại mô tả sai loại hàng hóa chính.'],
  ['partWhole', 'Tên TA hiện tại không phản ánh đúng quan hệ linh kiện và sản phẩm hoàn chỉnh.'],
  ['setScope', 'Tên TA hiện tại không phản ánh đúng phạm vi bộ hàng.'],
  ['function', 'Tên TA hiện tại mô tả sai công dụng làm thay đổi bản chất hàng hóa.']
]);

export function buildEnglishCheckReason({ status, semantic, riskReasons }) {
  if (status === ENGLISH_CHECK_STATUS.OK) {
    return null;
  }

  if (status === ENGLISH_CHECK_STATUS.WRONG) {
    for (const [dimension, reason] of HARD_MISMATCH_REASONS) {
      if (semantic.checks[dimension] === 'mismatch') {
        return reason;
      }
    }

    if (semantic.checks.material === 'contradiction') {
      return 'Tên TA hiện tại mâu thuẫn với vật liệu được mô tả.';
    }

    if (semantic.checks.terminology === 'wrong') {
      return 'Tên TA hiện tại dùng sai thuật ngữ thương mại cho hàng hóa.';
    }

    if (semantic.checks.unsupportedInfo) {
      return 'Tên TA hiện tại bổ sung thông tin không có trong mô tả tiếng Việt.';
    }

    return 'Tên TA hiện tại làm thay đổi bản chất hàng hóa.';
  }

  if (riskReasons.includes('generic-only-name') || semantic.checks.specificity === 'too_generic') {
    return 'Tên TA hiện tại quá chung, chưa thể hiện loại hàng hóa cụ thể.';
  }

  if (semantic.checks.specificity === 'over_specific') {
    return 'Tên TA hiện tại cụ thể hơn thông tin có trong mô tả tiếng Việt.';
  }

  if (riskReasons.includes('uncertain-check')) {
    return 'Một số đặc điểm ngữ nghĩa chưa đủ rõ để xác nhận tên hiện tại.';
  }

  if (riskReasons.includes('low-confidence')) {
    return 'Độ tin cậy chưa đủ cao để tự động xác nhận tên hiện tại.';
  }

  if (riskReasons.includes('suspicious-ok')) {
    return 'Tên TA hiện tại cần được đối chiếu thêm với tên thương mại chuẩn.';
  }

  return 'Tên TA hiện tại chưa thể hiện đầy đủ thông tin quan trọng của hàng hóa.';
}
