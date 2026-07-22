import { checkEnglishNamesWithOpenAI } from '@/lib/english-checker/ai';

function createFacts(rowId, canonicalName, overrides = {}) {
  return {
    rowId,
    canonicalName,
    productIdentity: { value: canonicalName.toLowerCase(), evidence: 'tên hàng hóa' },
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

function createComparison(rowId, coreProduct, overrides = {}) {
  return {
    rowId,
    englishClaims: {
      coreProduct,
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

function parsed(items) {
  return {
    output_parsed: {
      results: Object.fromEntries(items.map(({ rowId, ...details }) => [rowId, details]))
    }
  };
}

describe('v3 three-pass OpenAI audit', () => {
  const rows = [
    {
      rowId: 'unique-check-1',
      sheet: 'Data',
      excelRow: 2,
      stt: 1,
      productNameVi: 'Giá đỡ máy chiếu, sd trong phòng họp',
      productNameEn: 'Projector stand',
      checkInfo: 'ko dùng điện',
      customerFeedback: null
    },
    {
      rowId: 'unique-check-2',
      sheet: 'Data',
      excelRow: 3,
      stt: 2,
      productNameVi: 'Mô-đun transistor IGBT dùng cho biến tần',
      productNameEn: 'Module',
      checkInfo: null,
      customerFeedback: null
    },
    {
      rowId: 'unique-check-3',
      sheet: 'Data',
      excelRow: 4,
      stt: 3,
      productNameVi: 'Dây đeo kính bằng vải',
      productNameEn: null,
      checkInfo: null,
      customerFeedback: null
    }
  ];

  it('extracts facts independently, compares claims, then verifies only potential OK rows', async () => {
    const parse = vi
      .fn()
      .mockResolvedValueOnce(
        parsed([
          createFacts('unique-check-1', 'Projector stand', {
            productIdentity: { value: 'projector stand', evidence: 'Giá đỡ máy chiếu' }
          }),
          createFacts('unique-check-2', 'IGBT transistor module', {
            productIdentity: {
              value: 'IGBT transistor module',
              evidence: 'Mô-đun transistor IGBT'
            },
            distinguishingQualifiers: [{ value: 'IGBT transistor', evidence: 'transistor IGBT' }]
          }),
          createFacts('unique-check-3', 'Eyeglass strap', {
            productIdentity: { value: 'eyeglass strap', evidence: 'Dây đeo kính' }
          })
        ])
      )
      .mockResolvedValueOnce(
        parsed([
          createComparison('unique-check-1', 'projector stand'),
          createComparison('unique-check-2', 'module', {
            identityRelation: 'broader',
            distinguishingCoverage: 'critically_missing',
            missedImportantFacts: ['IGBT transistor']
          })
        ])
      )
      .mockResolvedValueOnce(
        parsed([
          {
            rowId: 'unique-check-1',
            verifiedOK: true,
            foundIssue: 'none',
            severity: 'none',
            evidence: null,
            explanation: 'Identity and all critical dimensions verified.'
          }
        ])
      );

    const results = await checkEnglishNamesWithOpenAI(rows, {
      client: { responses: { parse } }
    });

    expect(parse).toHaveBeenCalledTimes(3);
    expect(parse.mock.calls.map(([request]) => request.model)).toEqual([
      'gpt-5-nano',
      'gpt-5-nano',
      'gpt-5-mini'
    ]);

    const pass1Input = JSON.parse(parse.mock.calls[0][0].input);
    expect(pass1Input.rows).toHaveLength(3);
    expect(pass1Input.rows[0]).not.toHaveProperty('productNameEn');
    expect(pass1Input.rows[0]).not.toHaveProperty('currentEnglish');
    expect(pass1Input.rows[0].productNameVi).toEqual({
      original: 'Giá đỡ máy chiếu, sd trong phòng họp',
      normalized: 'Giá đỡ máy chiếu, sử dụng trong phòng họp'
    });
    expect(pass1Input.rows[0].checkInfo.normalized).toBe('không dùng điện');
    expect(parse.mock.calls[0][0].instructions).toContain('Bộ khóa cửa');
    expect(parse.mock.calls[0][0].instructions).not.toContain('Door handle set');

    const pass2Input = JSON.parse(parse.mock.calls[1][0].input);
    expect(pass2Input.rows.map((row) => row.rowId)).toEqual([
      'unique-check-1',
      'unique-check-2'
    ]);
    expect(pass2Input.rows[0]).toHaveProperty('currentEnglish', 'Projector stand');
    expect(pass2Input.rows[0]).toHaveProperty('productFacts.canonicalName', 'Projector stand');

    const pass3Input = JSON.parse(parse.mock.calls[2][0].input);
    expect(pass3Input.rows.map((row) => row.rowId)).toEqual(['unique-check-1']);
    expect(parse.mock.calls[2][0].instructions).toContain('adversarial review');

    expect(results).toEqual([
      { rowId: 'unique-check-1', status: 'OK', reason: '', suggestedName: '' },
      {
        rowId: 'unique-check-2',
        status: 'Chưa sát',
        reason: '“module” đúng nhóm sản phẩm nhưng chưa thể hiện “IGBT transistor”.',
        suggestedName: 'IGBT transistor module'
      },
      {
        rowId: 'unique-check-3',
        status: 'Thiếu dữ liệu',
        reason: 'Thiếu "Tên TA".',
        suggestedName: 'Eyeglass strap'
      }
    ]);
  });

  it('downgrades a potential OK when the verifier fails after retry', async () => {
    const parse = vi
      .fn()
      .mockResolvedValueOnce(
        parsed([
          createFacts('unique-check-1', 'Projector stand', {
            productIdentity: { value: 'projector stand', evidence: 'Giá đỡ máy chiếu' }
          })
        ])
      )
      .mockResolvedValueOnce(parsed([createComparison('unique-check-1', 'projector stand')]))
      .mockRejectedValueOnce(new Error('Verifier failed.'))
      .mockRejectedValueOnce(new Error('Verifier failed again.'));

    const [result] = await checkEnglishNamesWithOpenAI([rows[0]], {
      client: { responses: { parse } }
    });

    expect(parse).toHaveBeenCalledTimes(4);
    expect(result).toEqual({
      rowId: 'unique-check-1',
      status: 'Chưa sát',
      reason: 'PASS 3 verifier không hoàn tất; hệ thống không xác nhận OK.',
      suggestedName: 'Projector stand'
    });
  });

  it('can explicitly disable PASS 3 without changing PASS 1 and PASS 2', async () => {
    const parse = vi
      .fn()
      .mockResolvedValueOnce(
        parsed([
          createFacts('unique-check-1', 'Projector stand', {
            productIdentity: { value: 'projector stand', evidence: 'Giá đỡ máy chiếu' }
          })
        ])
      )
      .mockResolvedValueOnce(parsed([createComparison('unique-check-1', 'projector stand')]));

    const [result] = await checkEnglishNamesWithOpenAI([rows[0]], {
      client: { responses: { parse } },
      strictVerifyOK: false
    });

    expect(parse).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('OK');
  });

  it('retries an invalid PASS 1 once and then uses the verifier model as fail-safe fallback', async () => {
    const row = rows[1];
    const parse = vi
      .fn()
      .mockRejectedValueOnce(new Error('Invalid PASS 1 output.'))
      .mockRejectedValueOnce(new Error('Invalid PASS 1 output again.'))
      .mockResolvedValueOnce(
        parsed([
          createFacts('unique-check-2', 'IGBT transistor module', {
            productIdentity: {
              value: 'IGBT transistor module',
              evidence: 'Mô-đun transistor IGBT'
            },
            distinguishingQualifiers: [{ value: 'IGBT transistor', evidence: 'transistor IGBT' }]
          })
        ])
      )
      .mockResolvedValueOnce(
        parsed([
          createComparison('unique-check-2', 'module', {
            identityRelation: 'broader',
            distinguishingCoverage: 'critically_missing',
            missedImportantFacts: ['IGBT transistor']
          })
        ])
      );

    const [result] = await checkEnglishNamesWithOpenAI([row], {
      client: { responses: { parse } }
    });

    expect(parse.mock.calls.map(([request]) => request.model)).toEqual([
      'gpt-5-nano',
      'gpt-5-nano',
      'gpt-5-mini',
      'gpt-5-nano'
    ]);
    expect(result).toMatchObject({
      status: 'Chưa sát',
      suggestedName: 'IGBT transistor module'
    });
  });

  it('never returns OK when PASS 1 fails on both models', async () => {
    const parse = vi.fn().mockRejectedValue(new Error('Fact extraction unavailable.'));

    const [result] = await checkEnglishNamesWithOpenAI([rows[1]], {
      client: { responses: { parse } }
    });

    expect(parse).toHaveBeenCalledTimes(4);
    expect(result).toEqual({
      rowId: 'unique-check-2',
      status: 'Chưa sát',
      reason: 'PASS 1 không trích xuất được facts có evidence; không thể xác nhận tên tiếng Anh.',
      suggestedName: 'IGBT transistor module'
    });
  });
});
