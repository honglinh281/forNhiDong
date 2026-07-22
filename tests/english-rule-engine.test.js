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

function createSemantic(canonicalName, checks = {}, overrides = {}) {
  return {
    rowId: 'unique-check-1',
    canonicalName,
    coreProduct: canonicalName.toLowerCase(),
    criticalAttributes: [],
    optionalAttributes: [],
    checks: {
      coreProduct: 'match',
      partWhole: 'match',
      setScope: 'not_applicable',
      specificity: 'sufficient',
      material: 'not_applicable',
      function: 'match',
      terminology: 'natural',
      unsupportedInfo: false,
      ...checks
    },
    suggestedName: null,
    confidence: 0.95,
    ...overrides
  };
}

describe('English semantic rule engine', () => {
  it('maps a wrong core product and set scope to Sai rõ', () => {
    const row = createRow('Bộ khóa cửa, gồm tay nắm và ổ khóa', 'Door handle set');
    const semantic = createSemantic('Door lock set', {
      coreProduct: 'mismatch',
      setScope: 'mismatch',
      terminology: 'wrong'
    });

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'Sai rõ',
      reason: 'Tên TA hiện tại mô tả sai loại hàng hóa chính.',
      suggestedName: 'Door lock set'
    });
  });

  it('never allows a generic-only name to become OK', () => {
    const row = createRow('Mô-đun transistor IGBT dùng cho biến tần', 'Module');
    const semantic = createSemantic('IGBT transistor module');

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'Chưa sát',
      reason: 'Tên TA hiện tại quá chung, chưa thể hiện loại hàng hóa cụ thể.',
      suggestedName: 'IGBT transistor module'
    });
  });

  it('keeps optional shape omissions as OK', () => {
    const row = createRow('Đồ trang trí để bàn: hình ván trượt', 'Table decorations');
    const semantic = createSemantic(
      'Table decoration',
      { material: 'missing_but_optional' },
      { optionalAttributes: ['skateboard-shaped'] }
    );

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'OK',
      reason: null,
      suggestedName: null
    });
  });

  it('maps wrong terminology and product head noun to Sai rõ', () => {
    const row = createRow('Đầu bơm lốp, dùng ghép nối với dây hơi', 'Tire inflation valve clamp');
    const semantic = createSemantic('Tire inflator chuck', {
      coreProduct: 'mismatch',
      terminology: 'wrong'
    });

    expect(mapSemanticCheckToResult(row, semantic)).toMatchObject({
      status: 'Sai rõ',
      suggestedName: 'Tire inflator chuck'
    });
  });

  it('maps a generic functional translation to Chưa sát', () => {
    const row = createRow('Thanh nạy lốp', 'Tire removal tool');
    const semantic = createSemantic('Tire lever', {
      specificity: 'too_generic',
      terminology: 'acceptable'
    });

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'Chưa sát',
      reason: 'Tên TA hiện tại quá chung, chưa thể hiện loại hàng hóa cụ thể.',
      suggestedName: 'Tire lever'
    });
  });

  it('maps part versus whole mismatches to Sai rõ', () => {
    const row = createRow('Cánh bơm dùng cho máy bơm nước', 'Water pump');
    const semantic = createSemantic('Pump impeller', { partWhole: 'mismatch' });

    expect(mapSemanticCheckToResult(row, semantic)).toMatchObject({
      status: 'Sai rõ',
      reason: 'Tên TA hiện tại không phản ánh đúng quan hệ linh kiện và sản phẩm hoàn chỉnh.',
      suggestedName: 'Pump impeller'
    });
  });

  it('blocks low-confidence semantic checks from auto-OK', () => {
    const row = createRow('Giá đỡ máy chiếu', 'Projector stand');
    const semantic = createSemantic('Projector stand', {}, { confidence: 0.79 });

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'Chưa sát',
      reason: 'Độ tin cậy chưa đủ cao để tự động xác nhận tên hiện tại.',
      suggestedName: null
    });
  });

  it('treats an actual material contradiction as Sai rõ', () => {
    const row = createRow('Túi xách tay bằng nhựa', 'Leather handbag');
    const semantic = createSemantic('Plastic handbag', { material: 'contradiction' });

    expect(mapSemanticCheckToResult(row, semantic)).toMatchObject({
      status: 'Sai rõ',
      reason: 'Tên TA hiện tại mâu thuẫn với vật liệu được mô tả.',
      suggestedName: 'Plastic handbag'
    });
  });

  it.each([
    ['setScope', 'Bộ dụng cụ sửa chữa', 'Repair tool', 'Repair tool set'],
    ['function', 'Máy bơm nước', 'Air compressor', 'Water pump'],
    ['terminology', 'Đầu nối ống khí', 'Air hose decoration', 'Air hose connector']
  ])('treats a %s mismatch as Sai rõ', (dimension, productNameVi, productNameEn, canonicalName) => {
    const row = createRow(productNameVi, productNameEn);
    const semantic = createSemantic(canonicalName, {
      [dimension]: dimension === 'terminology' ? 'wrong' : 'mismatch'
    });

    expect(mapSemanticCheckToResult(row, semantic)).toMatchObject({
      status: 'Sai rõ',
      suggestedName: canonicalName
    });
  });

  it('treats unsupported added information as Sai rõ', () => {
    const row = createRow('Túi xách tay', 'Leather handbag');
    const semantic = createSemantic('Handbag', { unsupportedInfo: true });

    expect(mapSemanticCheckToResult(row, semantic)).toMatchObject({
      status: 'Sai rõ',
      reason: 'Tên TA hiện tại bổ sung thông tin không có trong mô tả tiếng Việt.',
      suggestedName: 'Handbag'
    });
  });

  it.each([
    [{ specificity: 'over_specific' }, 'Tên TA hiện tại cụ thể hơn thông tin có trong mô tả tiếng Việt.'],
    [{ material: 'uncertain' }, 'Một số đặc điểm ngữ nghĩa chưa đủ rõ để xác nhận tên hiện tại.'],
    [{ coreProduct: 'not_applicable' }, 'Tên TA hiện tại cần được đối chiếu thêm với tên thương mại chuẩn.']
  ])('prevents a risky preliminary OK result from auto-OK', (checks, reason) => {
    const row = createRow('Giá đỡ máy chiếu', 'Projector stand');
    const semantic = createSemantic('Projector stand', checks);

    expect(mapSemanticCheckToResult(row, semantic)).toEqual({
      rowId: row.rowId,
      status: 'Chưa sát',
      reason,
      suggestedName: null
    });
  });

  it('ships the documented calibration set as static source code', () => {
    expect(ENGLISH_CHECK_FEW_SHOT_EXAMPLES).toHaveLength(10);
    expect(ENGLISH_CHECK_FEW_SHOT_EXAMPLES.map((example) => example.canonicalName)).toEqual(
      expect.arrayContaining(['Door lock set', 'IGBT transistor module', 'Tire inflator chuck', 'Tire lever'])
    );
  });
});
