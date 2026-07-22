import { ENGLISH_CHECK_FEW_SHOT_EXAMPLES } from '@/lib/english-checker/examples';
import { mapSemanticCheckToResult } from '@/lib/english-checker/rule-engine';

function createRow(productNameVi, productNameEn) {
  return {
    rowId: 'unique-check-1',
    sheet: 'Data',
    excelRow: 2,
    stt: 1,
    productNameVi,
    productNameEn
  };
}

function createSemantic(canonicalName, comparison = {}, overrides = {}) {
  return {
    rowId: 'unique-check-1',
    canonicalName,
    coreProduct: canonicalName.toLowerCase(),
    productClass: 'commercial product',
    specificSubtype: null,
    partWholeScope: 'complete_product',
    setScope: 'single',
    criticalQualifiers: [],
    optionalQualifiers: [],
    comparison: {
      productIdentity: 'exact',
      partWhole: 'not_applicable',
      setScope: 'not_applicable',
      material: 'not_applicable',
      function: 'equivalent',
      terminology: 'natural',
      unsupportedInfo: false,
      ...comparison
    },
    confidence: 0.95,
    ...overrides
  };
}

describe('English semantic relationship rule engine', () => {
  it('maps a different product identity and set scope to Sai rõ', () => {
    const row = createRow('Bộ khóa cửa, gồm tay nắm và ổ khóa', 'Door handle set');
    const semantic = createSemantic('Door lock set', {
      productIdentity: 'different',
      setScope: 'different',
      terminology: 'wrong'
    });

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'Sai rõ',
      reason: 'Tên TA hiện tại mô tả một loại hàng hóa khác.',
      suggestedName: 'Door lock set'
    });
  });

  it('never allows a generic-only name to become OK', () => {
    const row = createRow('Mô-đun transistor IGBT dùng cho biến tần', 'Module');
    const semantic = createSemantic('IGBT transistor module');

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'Chưa sát',
      reason: 'Tên TA hiện tại quá rộng hoặc quá chung so với loại hàng hóa cụ thể.',
      suggestedName: 'IGBT transistor module'
    });
  });

  it('keeps optional qualifier omissions and singular/plural differences as OK', () => {
    const row = createRow('Đồ trang trí để bàn: hình ván trượt', 'Table decorations');
    const semantic = createSemantic(
      'Table decoration',
      { productIdentity: 'equivalent' },
      { optionalQualifiers: ['skateboard-shaped'] }
    );

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'OK',
      reason: '',
      suggestedName: ''
    });
  });

  it.each([
    ['Digital camera', 'Instant digital camera'],
    ['Circuit board', 'ESP32-S3 development board'],
    ['audio cable', 'Optical audio cable'],
    ['Tire removal tool', 'Tire lever']
  ])('maps the broader real-world name %s to Chưa sát', (productNameEn, canonicalName) => {
    const row = createRow('Mô tả tiếng Việt xác định subtype cụ thể', productNameEn);
    const semantic = createSemantic(canonicalName, { productIdentity: 'broader' });

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'Chưa sát',
      reason: 'Tên TA hiện tại quá rộng hoặc quá chung so với loại hàng hóa cụ thể.',
      suggestedName: canonicalName
    });
  });

  it.each([
    ['partWhole', 'Lõi lọc dầu thủy lực', 'Oil filter', 'Hydraulic oil filter element'],
    ['setScope', 'Bộ bàn phím kèm chuột', 'Computer keyboard', 'Keyboard and mouse set'],
    ['material', 'Túi xách nhựa', 'Leather handbag', 'Plastic handbag'],
    ['function', 'Máy bơm nước', 'Air compressor', 'Water pump']
  ])('maps a %s contradiction to Sai rõ', (dimension, productNameVi, productNameEn, canonicalName) => {
    const row = createRow(productNameVi, productNameEn);
    const semantic = createSemantic(canonicalName, { [dimension]: 'different' });

    expect(mapSemanticCheckToResult(row, semantic)).toMatchObject({
      status: 'Sai rõ',
      suggestedName: canonicalName
    });
  });

  it('blocks low-confidence results from auto-OK and always supplies canonicalName', () => {
    const row = createRow('Giá đỡ máy chiếu', 'Projector stand');
    const semantic = createSemantic('Projector stand', {}, { confidence: 0.79 });

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'Chưa sát',
      reason: 'Độ tin cậy chưa đủ cao để tự động xác nhận tên hiện tại.',
      suggestedName: 'Projector stand'
    });
  });

  it('maps awkward but understandable terminology to Chưa sát', () => {
    const row = createRow('Thanh nạy lốp', 'Tire removal tool');
    const semantic = createSemantic('Tire lever', {
      productIdentity: 'equivalent',
      terminology: 'awkward'
    });

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'Chưa sát',
      reason: 'Tên TA hiện tại hiểu được nhưng thuật ngữ thương mại chưa tự nhiên hoặc chưa chính xác.',
      suggestedName: 'Tire lever'
    });
  });

  it('maps unsupported but non-contradictory information to Chưa sát', () => {
    const row = createRow('Túi xách tay', 'Premium handbag');
    const semantic = createSemantic('Handbag', {
      productIdentity: 'narrower',
      unsupportedInfo: true
    });

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'Chưa sát',
      reason: 'Tên TA hiện tại hẹp hoặc cụ thể hơn thông tin được hỗ trợ trong mô tả tiếng Việt.',
      suggestedName: 'Handbag'
    });
  });

  it('accepts a longer English description when every detail is supported', () => {
    const row = createRow(
      'Bộ nguồn AC-DC cấp nguồn máy kiểm tra bản mạch, vỏ nhôm, 72VDC/6.7A, 480W',
      'AC-DC switching power supply for circuit board tester, aluminum casing, 72VDC/6.7A, 480W'
    );
    const semantic = createSemantic('AC-DC switching power supply', {
      productIdentity: 'equivalent',
      material: 'equivalent',
      function: 'equivalent',
      unsupportedInfo: false
    });

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'OK',
      reason: '',
      suggestedName: ''
    });
  });

  it('returns non-null strings for deterministic missing-data results', () => {
    const semantic = createSemantic('Projector stand');

    expect(mapSemanticCheckToResult(createRow('Giá đỡ máy chiếu', null), semantic)).toMatchObject({
      status: 'Thiếu dữ liệu',
      suggestedName: 'Projector stand'
    });
    expect(mapSemanticCheckToResult(createRow(null, 'Projector stand'), semantic)).toMatchObject({
      status: 'Thiếu dữ liệu',
      suggestedName: ''
    });
  });

  it('ships the measured calibration cases as static source code', () => {
    expect(ENGLISH_CHECK_FEW_SHOT_EXAMPLES).toHaveLength(18);
    expect(ENGLISH_CHECK_FEW_SHOT_EXAMPLES.map((example) => example.canonicalName)).toEqual(
      expect.arrayContaining([
        'Door lock set',
        'Instant digital camera',
        'Eyeglasses strap',
        'AC-DC switching power supply'
      ])
    );
  });
});
