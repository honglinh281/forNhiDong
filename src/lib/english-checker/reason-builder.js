import { ENGLISH_CHECK_STATUS } from '@/lib/english-checker/constants';

const HARD_DIFFERENCE_REASONS = Object.freeze([
  ['productIdentity', 'Tên TA hiện tại mô tả một loại hàng hóa khác.'],
  ['partWhole', 'Tên TA hiện tại mâu thuẫn về quan hệ giữa bộ phận và sản phẩm hoàn chỉnh.'],
  ['setScope', 'Tên TA hiện tại mâu thuẫn về phạm vi bộ hàng và thành phần đơn lẻ.'],
  ['material', 'Tên TA hiện tại mâu thuẫn với vật liệu làm thay đổi bản chất hàng hóa.'],
  ['function', 'Tên TA hiện tại mô tả công dụng khác làm thay đổi bản chất hàng hóa.']
]);

export function buildEnglishCheckReason({ status, semantic, riskReasons }) {
  if (status === ENGLISH_CHECK_STATUS.OK) {
    return '';
  }

  if (status === ENGLISH_CHECK_STATUS.WRONG) {
    for (const [dimension, reason] of HARD_DIFFERENCE_REASONS) {
      if (semantic.comparison[dimension] === 'different') {
        return reason;
      }
    }

    return 'Tên TA hiện tại mô tả khác bản chất hàng hóa.';
  }

  if (
    riskReasons.includes('generic-only-name') ||
    semantic.comparison.productIdentity === 'broader'
  ) {
    return 'Tên TA hiện tại quá rộng hoặc quá chung so với loại hàng hóa cụ thể.';
  }

  if (semantic.comparison.productIdentity === 'narrower') {
    return 'Tên TA hiện tại hẹp hoặc cụ thể hơn thông tin được hỗ trợ trong mô tả tiếng Việt.';
  }

  if (semantic.comparison.unsupportedInfo) {
    return 'Tên TA hiện tại có thêm thông tin chưa được hỗ trợ đầy đủ trong mô tả tiếng Việt.';
  }

  if (['awkward', 'wrong'].includes(semantic.comparison.terminology)) {
    return 'Tên TA hiện tại hiểu được nhưng thuật ngữ thương mại chưa tự nhiên hoặc chưa chính xác.';
  }

  if (riskReasons.includes('uncertain-comparison')) {
    return 'Quan hệ ngữ nghĩa giữa tên hiện tại và tên chuẩn chưa đủ rõ để tự động xác nhận.';
  }

  if (riskReasons.includes('low-confidence')) {
    return 'Độ tin cậy chưa đủ cao để tự động xác nhận tên hiện tại.';
  }

  return 'Tên TA hiện tại chưa sát với tên thương mại chuẩn.';
}
