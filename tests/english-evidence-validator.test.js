import { validateProductFactEvidence } from '@/lib/english-checker/evidence-validator';

function createFacts(evidence) {
  return {
    rowId: 'row-1',
    canonicalName: 'Pneumatic valve diaphragm',
    productIdentity: { value: 'pneumatic valve diaphragm', evidence },
    productClass: null,
    subtype: null,
    scope: 'part',
    distinguishingQualifiers: [],
    factualConstraints: {
      material: null,
      function: null,
      application: null,
      composition: null
    },
    administrativeInfo: [],
    unresolvedCriticalFacts: [],
    confidence: 0.95
  };
}

const sourceInput = {
  productNameVi: {
    original: 'BP chuyên dùng cho van điện từ: Màng van khí nén',
    normalized: 'Bộ phận chuyên dùng cho van điện từ: Màng van khí nén'
  },
  checkInfo: { original: '', normalized: '' },
  customerFeedback: { original: '', normalized: '' }
};

describe('PASS 1 evidence validation', () => {
  it('keeps facts whose evidence is present in the source', () => {
    expect(validateProductFactEvidence(createFacts('Màng van khí nén'), sourceInput)).toEqual(
      createFacts('Màng van khí nén')
    );
  });

  it('makes fabricated or non-source evidence unsafe for OK', () => {
    const result = validateProductFactEvidence(createFacts('Exact product inferred'), sourceInput);

    expect(result.confidence).toBe(0.79);
    expect(result.unresolvedCriticalFacts[0]).toContain('Evidence không khớp nguồn');
  });
});
