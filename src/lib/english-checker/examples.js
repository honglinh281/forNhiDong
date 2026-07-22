import { ENGLISH_CHECK_STATUS } from '@/lib/english-checker/constants';

export const ENGLISH_CHECK_FEW_SHOT_EXAMPLES = Object.freeze([
  {
    productNameVi: 'Bộ khóa cửa, dùng cho cửa phòng ngủ, gồm tay nắm và ổ khóa',
    productNameEn: 'Door handle set',
    canonicalName: 'Door lock set',
    expectedChecks: {
      coreProduct: 'mismatch',
      setScope: 'mismatch',
      terminology: 'wrong'
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.WRONG,
    explanation: 'Tên hiện tại chỉ mô tả tay nắm, không phản ánh bộ khóa cửa hoàn chỉnh.'
  },
  {
    productNameVi: 'Mô-đun transistor IGBT dùng cho biến tần',
    productNameEn: 'Module',
    canonicalName: 'IGBT transistor module',
    expectedChecks: {
      coreProduct: 'match',
      specificity: 'too_generic',
      terminology: 'acceptable'
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.CLOSE,
    explanation: 'Module đúng nhóm khái quát nhưng thiếu loại module cụ thể.'
  },
  {
    productNameVi: 'Đồ trang trí để bàn: hình ván trượt',
    productNameEn: 'Table decorations',
    canonicalName: 'Table decoration',
    expectedChecks: {
      coreProduct: 'match',
      specificity: 'sufficient',
      terminology: 'natural'
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.OK,
    explanation: 'Hình ván trượt là thuộc tính tùy chọn, không làm đổi bản chất đồ trang trí.'
  },
  {
    productNameVi: 'Đầu bơm lốp, dùng ghép nối với dây hơi',
    productNameEn: 'Tire inflation valve clamp',
    canonicalName: 'Tire inflator chuck',
    expectedChecks: {
      coreProduct: 'mismatch',
      terminology: 'wrong'
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.WRONG,
    explanation: 'Clamp không phải danh từ thương mại đúng cho đầu nối bơm lốp.'
  },
  {
    productNameVi: 'Dụng cụ cầm tay: Thanh nạy lốp',
    productNameEn: 'Tire removal tool',
    canonicalName: 'Tire lever',
    expectedChecks: {
      coreProduct: 'match',
      specificity: 'too_generic',
      terminology: 'acceptable'
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.CLOSE,
    explanation: 'Tên hiện tại đúng công dụng nhưng chưa dùng đúng tên dụng cụ cụ thể.'
  },
  {
    productNameVi: 'Cánh bơm, dùng cho máy bơm nước công nghiệp',
    productNameEn: 'Water pump',
    canonicalName: 'Pump impeller',
    expectedChecks: {
      coreProduct: 'mismatch',
      partWhole: 'mismatch'
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.WRONG,
    explanation: 'Linh kiện cánh bơm bị mô tả thành máy bơm hoàn chỉnh.'
  },
  {
    productNameVi: 'Áo phông ngắn tay cho nữ',
    productNameEn: 'T-shirt',
    canonicalName: "Women's short-sleeved T-shirt",
    expectedChecks: {
      coreProduct: 'match',
      specificity: 'sufficient',
      terminology: 'natural'
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.OK,
    explanation: 'Tên ngắn vẫn giữ đúng loại sản phẩm; giới tính và chiều dài tay áo có thể lược bỏ.'
  },
  {
    productNameVi: 'Túi xách tay bằng nhựa',
    productNameEn: 'Handbag',
    canonicalName: 'Plastic handbag',
    expectedChecks: {
      coreProduct: 'match',
      specificity: 'sufficient',
      material: 'missing_but_optional'
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.OK,
    explanation: 'Thiếu vật liệu không làm thay đổi loại hàng hóa chính trong ví dụ này.'
  },
  {
    productNameVi: 'Giá đỡ máy chiếu',
    productNameEn: 'Projector stand',
    canonicalName: 'Projector stand',
    expectedChecks: {
      coreProduct: 'match',
      specificity: 'sufficient',
      terminology: 'natural'
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.OK,
    explanation: 'Tên hiện tại là thuật ngữ thương mại tự nhiên và đúng loại hàng.'
  },
  {
    productNameVi: 'Cánh bơm dùng cho máy bơm nước',
    productNameEn: 'Pump impeller',
    canonicalName: 'Pump impeller',
    expectedChecks: {
      coreProduct: 'match',
      partWhole: 'match',
      specificity: 'sufficient',
      terminology: 'natural'
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.OK,
    explanation: 'Tên hiện tại mô tả đúng linh kiện và đúng thuật ngữ chuyên ngành.'
  }
]);

export function serializeEnglishCheckExamples() {
  return JSON.stringify(ENGLISH_CHECK_FEW_SHOT_EXAMPLES, null, 2);
}
