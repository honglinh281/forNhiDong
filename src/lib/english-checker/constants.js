export const ENGLISH_CHECK_STATUS = Object.freeze({
  OK: 'OK',
  CLOSE: 'Chưa sát',
  WRONG: 'Sai rõ',
  MISSING: 'Thiếu dữ liệu'
});

export const ENGLISH_CHECK_STATUSES = Object.freeze(Object.values(ENGLISH_CHECK_STATUS));

export const ENGLISH_CHECK_STATUS_PRIORITY = Object.freeze({
  [ENGLISH_CHECK_STATUS.WRONG]: 0,
  [ENGLISH_CHECK_STATUS.CLOSE]: 1,
  [ENGLISH_CHECK_STATUS.MISSING]: 2,
  [ENGLISH_CHECK_STATUS.OK]: 3
});

export const ENGLISH_CHECK_STATUS_COLORS = Object.freeze({
  [ENGLISH_CHECK_STATUS.OK]: 'FFDCFCE7',
  [ENGLISH_CHECK_STATUS.CLOSE]: 'FFFEF3C7',
  [ENGLISH_CHECK_STATUS.WRONG]: 'FFFEE2E2',
  [ENGLISH_CHECK_STATUS.MISSING]: 'FFE5E7EB'
});

export const ENGLISH_CHECK_RESULT_HEADERS = Object.freeze({
  status: 'Kết quả check Tên TA',
  reason: 'Lý do',
  suggestedName: 'Tên TA đề xuất'
});

export const ENGLISH_CHECK_COLUMN_ALIASES = Object.freeze({
  stt: ['stt', 'số thứ tự'],
  productNameVi: ['tên hàng hóa xnk', 'tên hàng hóa', 'mô tả hàng hóa'],
  productNameEn: ['tên ta', 'tên tiếng anh', 'english name'],
  hsCode: ['mã hs', 'hs code'],
  checkInfo: ['check/bổ sung thông tin'],
  customerFeedback: ['kh phản hồi thông tin'],
  quoteCode: ['mã báo giá'],
  trackingCode: ['mã vận đơn']
});

export const ENGLISH_CHECK_HEADER_SCAN_LIMIT = 20;
export const ENGLISH_CHECK_BATCH_SIZE = 10;
export const ENGLISH_CHECK_CONCURRENCY = 3;
export const ENGLISH_CHECK_EXTENSIONS = Object.freeze(['.xlsx']);

export const ENGLISH_CHECK_RISK_CONFIDENCE_THRESHOLD = 0.8;

export const ENGLISH_CHECK_GENERIC_ONLY_NAMES = Object.freeze([
  'module',
  'part',
  'parts',
  'component',
  'components',
  'item',
  'product',
  'device',
  'equipment',
  'accessory',
  'accessories',
  'tool'
]);
