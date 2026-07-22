import { finalizeAuditResult } from '@/lib/english-checker/rule-engine';

function buildFacts(canonicalName, qualifier = null, material = null) {
  return {
    rowId: 'row-1',
    canonicalName,
    productIdentity: { value: canonicalName, evidence: 'mô tả hàng hóa' },
    productClass: null,
    subtype: null,
    scope: 'single_product',
    distinguishingQualifiers: qualifier
      ? [{ value: qualifier, evidence: qualifier }]
      : [],
    factualConstraints: {
      material: material ? { value: material, evidence: material } : null,
      function: null,
      application: null,
      composition: null
    },
    administrativeInfo: [],
    unresolvedCriticalFacts: [],
    confidence: 0.95
  };
}

function buildComparison({ coreProduct, relation, coverage, missed = [], material = 'not_applicable' }) {
  return {
    rowId: 'row-1',
    englishClaims: {
      coreProduct,
      productClass: null,
      subtype: null,
      scope: 'single_product',
      qualifiers: [],
      claims: {
        material: material === 'contradiction' ? 'tempered glass' : null,
        function: null,
        application: null
      }
    },
    identityRelation: relation,
    distinguishingCoverage: coverage,
    partWhole: 'match',
    setScope: 'match',
    material,
    function: 'not_applicable',
    terminology: relation === 'different' ? 'misleading' : 'acceptable',
    unsupportedClaims: [],
    missedImportantFacts: missed,
    confidence: 0.95
  };
}

describe('attached strict-audit regression cases', () => {
  it.each([
    {
      productNameVi: 'Vỏ bảo vệ đầu nối, bộ phận của đầu nối dây điện',
      productNameEn: 'Connector housing',
      facts: buildFacts('Connector protective cover', 'protective cover'),
      comparison: buildComparison({
        coreProduct: 'connector housing',
        relation: 'broader',
        coverage: 'partially_missing',
        missed: ['protective cover scope']
      }),
      status: 'Chưa sát'
    },
    {
      productNameVi: 'BP chuyên dùng cho van điện từ: Màng van khí nén',
      productNameEn: 'Parts of a pneumatic valve',
      facts: buildFacts('Pneumatic valve diaphragm', 'diaphragm'),
      comparison: buildComparison({
        coreProduct: 'parts of a pneumatic valve',
        relation: 'broader',
        coverage: 'critically_missing',
        missed: ['pneumatic valve diaphragm']
      }),
      status: 'Chưa sát'
    },
    {
      productNameVi: 'Đồ trang trí để bàn: Hình ván trượt',
      productNameEn: 'Table decorations',
      facts: buildFacts('Skateboard-shaped table decoration', 'skateboard shape'),
      comparison: buildComparison({
        coreProduct: 'table decorations',
        relation: 'broader',
        coverage: 'partially_missing',
        missed: ['skateboard shape']
      }),
      status: 'Chưa sát'
    },
    {
      productNameVi: 'Thiết bị hỗ trợ dán kính cường lực điện thoại, dùng định vị và căn chỉnh',
      productNameEn: 'Fixture for supporting tempered glass screen protector application',
      facts: buildFacts('Phone screen protector alignment device', 'positioning and alignment'),
      comparison: buildComparison({
        coreProduct: 'screen protector fixture',
        relation: 'broader',
        coverage: 'partially_missing',
        missed: ['positioning and alignment device']
      }),
      status: 'Chưa sát'
    },
    {
      productNameVi: 'Miếng dán bảo vệ màn hình điện thoại, chất liệu bằng nhựa TPU',
      productNameEn: 'Tempered glass screen protector for phone',
      facts: buildFacts('Phone screen protector', null, 'TPU plastic'),
      comparison: buildComparison({
        coreProduct: 'phone screen protector',
        relation: 'equivalent',
        coverage: 'complete',
        material: 'contradiction'
      }),
      status: 'Sai rõ'
    }
  ])('never returns OK for $productNameEn', ({ productNameVi, productNameEn, facts, comparison, status }) => {
    const result = finalizeAuditResult({
      row: { rowId: 'row-1', productNameVi, productNameEn },
      facts,
      comparison
    });

    expect(result.status).toBe(status);
    expect(result.status).not.toBe('OK');
    expect(result.suggestedName).toBe(facts.canonicalName);
    expect(result.reason).not.toBe('');
  });
});
