import {
  finalizeAuditResult,
  getCandidateStatus,
  isPotentialOK
} from '@/lib/english-checker/rule-engine';

function createRow(productNameVi, productNameEn) {
  return {
    rowId: 'row-1',
    sheet: 'Data',
    excelRow: 2,
    stt: 1,
    productNameVi,
    productNameEn
  };
}

function createFacts(canonicalName, overrides = {}) {
  return {
    rowId: 'row-1',
    canonicalName,
    productIdentity: { value: canonicalName.toLowerCase(), evidence: 'hàng hóa thực tế' },
    productClass: null,
    subtype: null,
    scope: 'single_product',
    distinguishingQualifiers: [],
    factualConstraints: {
      material: null,
      function: null,
      application: null,
      composition: null
    },
    administrativeInfo: [],
    unresolvedCriticalFacts: [],
    confidence: 0.95,
    ...overrides
  };
}

function createComparison(overrides = {}) {
  return {
    rowId: 'row-1',
    englishClaims: {
      coreProduct: 'commercial product',
      productClass: null,
      subtype: null,
      scope: 'single_product',
      qualifiers: [],
      claims: { material: null, function: null, application: null }
    },
    identityRelation: 'exact',
    distinguishingCoverage: 'complete',
    partWhole: 'match',
    setScope: 'match',
    material: 'not_applicable',
    function: 'not_applicable',
    terminology: 'natural',
    unsupportedClaims: [],
    missedImportantFacts: [],
    confidence: 0.95,
    ...overrides
  };
}

const verifiedOK = {
  rowId: 'row-1',
  verifiedOK: true,
  foundIssue: 'none',
  severity: 'none',
  evidence: null,
  explanation: 'All critical facts verified.'
};

describe('v3 deterministic status mapper', () => {
  it('maps a different product identity to Sai rõ with a specific reason', () => {
    const row = createRow('Bộ khóa cửa, gồm tay nắm và ổ khóa', 'Door handle set');
    const facts = createFacts('Door lock set', {
      productIdentity: { value: 'door lock set', evidence: 'Bộ khóa cửa' },
      scope: 'set'
    });
    const comparison = createComparison({
      englishClaims: {
        ...createComparison().englishClaims,
        coreProduct: 'door handle set',
        scope: 'set'
      },
      identityRelation: 'different',
      setScope: 'mismatch',
      terminology: 'misleading'
    });

    expect(finalizeAuditResult({ row, facts, comparison })).toEqual({
      rowId: row.rowId,
      status: 'Sai rõ',
      reason: 'Tên TA hiện tại mô tả “door handle set”, trong khi hàng hóa thực tế là “door lock set”.',
      suggestedName: 'Door lock set'
    });
  });

  it('maps broader names and missing distinguishing qualifiers to Chưa sát', () => {
    const row = createRow('Đồ trang trí để bàn: hình ván trượt', 'Table decorations');
    const facts = createFacts('Skateboard-shaped table decoration', {
      distinguishingQualifiers: [
        { value: 'skateboard-shaped', evidence: 'Hình ván trượt' }
      ]
    });
    const comparison = createComparison({
      englishClaims: { ...createComparison().englishClaims, coreProduct: 'table decorations' },
      identityRelation: 'broader',
      distinguishingCoverage: 'partially_missing',
      missedImportantFacts: ['skateboard shape']
    });

    expect(finalizeAuditResult({ row, facts, comparison })).toMatchObject({
      status: 'Chưa sát',
      suggestedName: 'Skateboard-shaped table decoration',
      reason: '“table decorations” đúng nhóm sản phẩm nhưng chưa thể hiện “skateboard shape”.'
    });
  });

  it.each([
    ['Máy ảnh kỹ thuật số loại chụp lấy ảnh ngay', 'Digital camera', 'Instant digital camera', 'instant'],
    ['Dụng cụ cầm tay: thanh nạy lốp', 'Tire removal tool', 'Tire lever', 'tire lever']
  ])(
    'keeps the broader required case %s as Chưa sát rather than Sai rõ',
    (productNameVi, productNameEn, canonicalName, missedFact) => {
      const result = finalizeAuditResult({
        row: createRow(productNameVi, productNameEn),
        facts: createFacts(canonicalName, {
          distinguishingQualifiers: [{ value: missedFact, evidence: missedFact }]
        }),
        comparison: createComparison({
          englishClaims: { ...createComparison().englishClaims, coreProduct: productNameEn },
          identityRelation: 'broader',
          distinguishingCoverage: 'partially_missing',
          missedImportantFacts: [missedFact]
        })
      });

      expect(result).toMatchObject({ status: 'Chưa sát', suggestedName: canonicalName });
    }
  );

  it('maps eyeglasses bag versus strap to Sai rõ', () => {
    const result = finalizeAuditResult({
      row: createRow('Dây đeo kính bằng vải', 'Eyeglasses bag'),
      facts: createFacts('Eyeglass strap', {
        productIdentity: { value: 'eyeglass strap', evidence: 'Dây đeo kính' }
      }),
      comparison: createComparison({
        englishClaims: { ...createComparison().englishClaims, coreProduct: 'eyeglasses bag' },
        identityRelation: 'different',
        terminology: 'misleading'
      })
    });

    expect(result).toMatchObject({ status: 'Sai rõ', suggestedName: 'Eyeglass strap' });
  });

  it('maps a claimed material contradiction to Sai rõ', () => {
    const row = createRow(
      'Miếng dán bảo vệ màn hình điện thoại bằng nhựa TPU',
      'Tempered glass screen protector'
    );
    const facts = createFacts('Phone screen protector', {
      factualConstraints: {
        material: { value: 'TPU plastic', evidence: 'nhựa TPU' },
        function: null,
        application: null,
        composition: null
      }
    });
    const comparison = createComparison({
      englishClaims: {
        ...createComparison().englishClaims,
        coreProduct: 'screen protector',
        claims: { material: 'tempered glass', function: null, application: null }
      },
      identityRelation: 'equivalent',
      material: 'contradiction'
    });

    expect(finalizeAuditResult({ row, facts, comparison })).toMatchObject({
      status: 'Sai rõ',
      reason: 'Tên TA ghi vật liệu “tempered glass”, nhưng mô tả tiếng Việt xác định “TPU plastic”.',
      suggestedName: 'Phone screen protector'
    });
  });

  it('requires adversarial verification before a candidate can become OK', () => {
    const row = createRow('Giá đỡ máy chiếu', 'Projector stand');
    const facts = createFacts('Projector stand');
    const comparison = createComparison({
      englishClaims: { ...createComparison().englishClaims, coreProduct: 'projector stand' }
    });

    expect(isPotentialOK(row, facts, comparison)).toBe(true);
    expect(getCandidateStatus(row, facts, comparison)).toBe('OK');
    expect(finalizeAuditResult({ row, facts, comparison })).toMatchObject({
      status: 'Chưa sát',
      suggestedName: 'Projector stand'
    });
    expect(finalizeAuditResult({ row, facts, comparison, verification: verifiedOK })).toEqual({
      rowId: row.rowId,
      status: 'OK',
      reason: '',
      suggestedName: ''
    });
  });

  it('accepts a longer supported English description after strict verification', () => {
    const row = createRow(
      'Bộ nguồn chuyển mạch AC-DC cấp nguồn máy kiểm tra bản mạch, vỏ nhôm, 480W',
      'AC-DC switching power supply for circuit board tester, aluminum casing, 480W'
    );
    const facts = createFacts('AC-DC switching power supply');
    const comparison = createComparison({
      englishClaims: {
        ...createComparison().englishClaims,
        coreProduct: 'AC-DC switching power supply',
        claims: {
          material: 'aluminum casing',
          function: 'powering a circuit board tester',
          application: 'circuit board tester'
        }
      },
      identityRelation: 'equivalent',
      material: 'match',
      function: 'match'
    });

    expect(finalizeAuditResult({ row, facts, comparison, verification: verifiedOK })).toMatchObject({
      status: 'OK',
      reason: '',
      suggestedName: ''
    });
  });

  it('rejects an internally inconsistent verifier confirmation', () => {
    const row = createRow('Giá đỡ máy chiếu', 'Projector stand');
    const result = finalizeAuditResult({
      row,
      facts: createFacts('Projector stand'),
      comparison: createComparison(),
      verification: {
        ...verifiedOK,
        foundIssue: 'specificity',
        severity: 'chua_sat',
        explanation: 'Thiếu loại giá đỡ cụ thể.'
      }
    });

    expect(result).toMatchObject({
      status: 'Chưa sát',
      reason: 'Thiếu loại giá đỡ cụ thể.',
      suggestedName: 'Projector stand'
    });
  });

  it('never auto-OKs unresolved facts, low confidence, or generic-only English names', () => {
    const genericRow = createRow('Mô-đun transistor IGBT', 'Module');

    const genericFacts = createFacts('IGBT transistor module');
    const genericComparison = createComparison();
    expect(getCandidateStatus(genericRow, genericFacts, genericComparison)).toBe('Chưa sát');
    expect(
      finalizeAuditResult({ row: genericRow, facts: genericFacts, comparison: genericComparison })
    ).toMatchObject({
      status: 'Chưa sát',
      reason: '“Module” quá chung; mô tả hàng hóa xác định cụ thể là “IGBT transistor module”.'
    });
    expect(
      getCandidateStatus(
        createRow('Sản phẩm chưa rõ', 'Commercial product'),
        createFacts('Commercial product', { unresolvedCriticalFacts: ['exact subtype'] }),
        createComparison()
      )
    ).toBe('Chưa sát');
    expect(
      getCandidateStatus(
        createRow('Giá đỡ', 'Stand'),
        createFacts('Stand'),
        createComparison({ confidence: 0.79 })
      )
    ).toBe('Chưa sát');
  });

  it('keeps missing-data outputs and suggested names null-free', () => {
    expect(
      finalizeAuditResult({
        row: createRow('Giá đỡ máy chiếu', null),
        facts: createFacts('Projector stand')
      })
    ).toEqual({
      rowId: 'row-1',
      status: 'Thiếu dữ liệu',
      reason: 'Thiếu "Tên TA".',
      suggestedName: 'Projector stand'
    });
    expect(finalizeAuditResult({ row: createRow(null, 'Projector stand') })).toEqual({
      rowId: 'row-1',
      status: 'Thiếu dữ liệu',
      reason: 'Thiếu "Tên hàng hóa XNK".',
      suggestedName: ''
    });
  });
});
