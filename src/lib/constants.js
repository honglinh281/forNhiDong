export const REQUIRED_FIELDS = ['hsCode', 'itemName', 'unit', 'quantity'];

export const FIELD_LABELS = {
  hsCode: 'HS code',
  itemName: 'Tên hàng',
  unit: 'Đơn vị tính',
  quantity: 'Số lượng'
};

export const FIELD_ALIASES = {
  hsCode: ['hs code', 'hscode', 'ma hs', 'mã hs', 'ma hs code', 'mã hs code', 'hs', 'ma hang', 'mã hàng'],
  itemName: [
    'ten hang',
    'tên hàng',
    'ten hang hoa',
    'ten hang mo ta chi tiet',
    'tên hàng mô tả chi tiết',
    'ten hang chi tiet',
    'mô tả chi tiết',
    'mo ta chi tiet',
    'item name',
    'description',
    'commodity',
    'goods description'
  ],
  unit: ['don vi tinh', 'đơn vị tính', 'don vi', 'đơn vị', 'dvt', 'unit', 'uom', 'unit name'],
  quantity: ['so luong', 'số lượng', 'luong', 'lượng', 'quantity', 'qty', 'sl', 'amount']
};

export const OPTIONAL_FIELD_ALIASES = {
  sequenceKey: ['stt', 'số thứ tự', 'so thu tu', 'item no', 'item no.', 'item number', 'no', 'no.']
};

export const UNIT_NORMALIZATION_GROUPS = {
  // Synced from "Dịch nghĩa viết tắt (1).xlsx"
  piece: ['pce', 'piece', 'pieces', 'piece/pieces'],
  pair: ['pr', 'pair', 'pairs'],
  set: ['set', 'sets'],
  box: ['unk', 'box', 'boxes'],
  bag: ['bag', 'bags'],
  kilogram_net: ['kgm', 'kgs', 'kgs n.w.', 'kgs n.w', 'kgs n w', 'kgs nw'],
  roll: ['rol', 'roll', 'rolls'],
  bottle: ['una', 'bottle', 'bottles'],
  meter: ['mtr', 'meter', 'meters', 'metre', 'metres'],
  square_meter: ['mtk', 'square meter', 'square meters', 'square metre', 'square metres'],
  cubic_meter: ['mtq', 'cubic meter', 'cubic meters', 'cubic metre', 'cubic metres']
};

export const ROW_STATUS = {
  MATCH: 'MATCH',
  MATCH_WITH_HS_RULE: 'MATCH_WITH_HS_RULE',
  MISMATCH: 'MISMATCH',
  MISSING_IN_EXCEL: 'MISSING_IN_EXCEL',
  MISSING_IN_PDF: 'MISSING_IN_PDF',
  PARSE_ERROR: 'PARSE_ERROR'
};

export const STATUS_LABELS = {
  ALL: 'Tất cả',
  [ROW_STATUS.MATCH]: 'Khớp',
  [ROW_STATUS.MATCH_WITH_HS_RULE]: 'Khớp (lách HS hợp lệ)',
  [ROW_STATUS.MISMATCH]: 'Sai lệch',
  [ROW_STATUS.MISSING_IN_EXCEL]: 'Thiếu trong Excel',
  [ROW_STATUS.MISSING_IN_PDF]: 'Thiếu trong PDF',
  [ROW_STATUS.PARSE_ERROR]: 'Lỗi đọc dữ liệu'
};

export const STATUS_PRIORITY = {
  [ROW_STATUS.PARSE_ERROR]: 0,
  [ROW_STATUS.MISMATCH]: 1,
  [ROW_STATUS.MISSING_IN_EXCEL]: 2,
  [ROW_STATUS.MISSING_IN_PDF]: 3,
  [ROW_STATUS.MATCH_WITH_HS_RULE]: 4,
  [ROW_STATUS.MATCH]: 5
};

export const STATUS_FILTERS = [
  { value: 'ALL', label: STATUS_LABELS.ALL },
  { value: ROW_STATUS.PARSE_ERROR, label: STATUS_LABELS[ROW_STATUS.PARSE_ERROR] },
  { value: ROW_STATUS.MISMATCH, label: STATUS_LABELS[ROW_STATUS.MISMATCH] },
  { value: ROW_STATUS.MISSING_IN_EXCEL, label: STATUS_LABELS[ROW_STATUS.MISSING_IN_EXCEL] },
  { value: ROW_STATUS.MISSING_IN_PDF, label: STATUS_LABELS[ROW_STATUS.MISSING_IN_PDF] },
  { value: ROW_STATUS.MATCH_WITH_HS_RULE, label: STATUS_LABELS[ROW_STATUS.MATCH_WITH_HS_RULE] },
  { value: ROW_STATUS.MATCH, label: STATUS_LABELS[ROW_STATUS.MATCH] }
];

export const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
export const PDF_EXTENSIONS = ['.pdf'];

export const MATCH_WEIGHTS = {
  itemName: 50,
  quantity: 30,
  unit: 20
};

export const MATCH_THRESHOLD = 85;

export const HS_CODE_MAPPING_RULES = [];

export const PDF_NOISE_PATTERNS = [
  /^page\s+\d+/i,
  /^trang\s+\d+/i,
  /^tong\s+cong/i,
  /^total/i,
  /^ghi\s+chu/i
];
