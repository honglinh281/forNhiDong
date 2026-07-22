import { checkEnglishNamesWithOpenAI } from '@/lib/english-checker/ai';

function createSemantic(rowId, overrides = {}) {
  const comparison = {
    productIdentity: 'exact',
    partWhole: 'not_applicable',
    setScope: 'not_applicable',
    material: 'not_applicable',
    function: 'equivalent',
    terminology: 'natural',
    unsupportedInfo: false,
    ...overrides.comparison
  };

  return {
    rowId,
    canonicalName: 'Projector stand',
    coreProduct: 'projector stand',
    productClass: 'support equipment',
    specificSubtype: 'projector stand',
    partWholeScope: 'complete_product',
    setScope: 'single',
    criticalQualifiers: [],
    optionalQualifiers: [],
    confidence: 0.95,
    ...overrides,
    comparison
  };
}

function createParsedResponse(semanticChecks) {
  const results = Object.fromEntries(
    semanticChecks.map(({ rowId, ...details }) => [rowId, details])
  );

  return { output_parsed: { results } };
}

describe('checkEnglishNamesWithOpenAI', () => {
  it('requests semantic Structured Output and derives final results deterministically', async () => {
    const parse = vi.fn().mockResolvedValue(
      createParsedResponse([
        createSemantic('unique-check-1', {
          canonicalName: "Women's short-sleeved T-shirt",
          coreProduct: 'T-shirt',
          productClass: 'garment',
          specificSubtype: 'T-shirt',
          optionalQualifiers: ['women', 'short sleeves'],
          comparison: { productIdentity: 'equivalent' }
        }),
        createSemantic('unique-check-2', {
          comparison: {
            productIdentity: 'uncertain',
            terminology: 'uncertain'
          }
        })
      ])
    );
    const client = { responses: { parse } };
    const rows = [
      {
        rowId: 'unique-check-1',
        sheet: 'Data',
        excelRow: 2,
        stt: 1,
        productNameVi: 'Áo phông ngắn tay cho nữ',
        productNameEn: 'T-shirt'
      },
      {
        rowId: 'unique-check-2',
        sheet: 'Data',
        excelRow: 3,
        stt: 2,
        productNameVi: 'Giá đỡ máy chiếu',
        productNameEn: null
      }
    ];

    const results = await checkEnglishNamesWithOpenAI(rows, { client });

    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5-nano',
        reasoning: { effort: 'low' },
        store: false,
        text: { format: expect.objectContaining({ type: 'json_schema', strict: true }) }
      })
    );
    expect(parse.mock.calls[0][0].instructions).toContain('Ignore productNameEn');
    expect(parse.mock.calls[0][0].instructions).toContain('exact:');
    expect(parse.mock.calls[0][0].instructions).not.toContain('Return canonicalName, coreProduct, attributes, checks, suggestedName');
    expect(JSON.parse(parse.mock.calls[0][0].input)).toEqual({ rows });
    const outputSchema = parse.mock.calls[0][0].text.format.schema;
    expect(outputSchema.properties.results.required).toEqual([
      'unique-check-1',
      'unique-check-2'
    ]);
    expect(outputSchema.properties.results.properties['unique-check-1'].properties).not.toHaveProperty(
      'rowId'
    );
    expect(results).toEqual([
      {
        rowId: 'unique-check-1',
        status: 'OK',
        reason: '',
        suggestedName: ''
      },
      {
        rowId: 'unique-check-2',
        status: 'Thiếu dữ liệu',
        reason: 'Thiếu "Tên TA".',
        suggestedName: 'Projector stand'
      }
    ]);
  });

  it('calls the fallback model only for risky rows when explicitly enabled', async () => {
    const parse = vi
      .fn()
      .mockResolvedValueOnce(
        createParsedResponse([
          createSemantic('unique-check-1', {
            canonicalName: 'Display support',
            comparison: { productIdentity: 'equivalent' },
            confidence: 0.61
          }),
          createSemantic('unique-check-2', {
            canonicalName: 'T-shirt',
            coreProduct: 'T-shirt',
            productClass: 'garment',
            specificSubtype: 'T-shirt'
          })
        ])
      )
      .mockResolvedValueOnce(
        createParsedResponse([
          createSemantic('unique-check-1', {
            canonicalName: 'Monitor mount',
            coreProduct: 'monitor mount',
            confidence: 0.98
          })
        ])
      );
    const client = { responses: { parse } };
    const rows = [
      {
        rowId: 'unique-check-1',
        sheet: 'Data',
        excelRow: 2,
        stt: 1,
        productNameVi: 'Giá đỡ màn hình',
        productNameEn: 'Monitor mount'
      },
      {
        rowId: 'unique-check-2',
        sheet: 'Data',
        excelRow: 3,
        stt: 2,
        productNameVi: 'Áo phông',
        productNameEn: 'T-shirt'
      }
    ];

    const results = await checkEnglishNamesWithOpenAI(rows, {
      client,
      enableFallback: true,
      fallbackModel: 'gpt-5-mini'
    });

    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[1][0].model).toBe('gpt-5-mini');
    expect(JSON.parse(parse.mock.calls[1][0].input).rows).toEqual([rows[0]]);
    expect(results).toEqual([
      { rowId: 'unique-check-1', status: 'OK', reason: '', suggestedName: '' },
      { rowId: 'unique-check-2', status: 'OK', reason: '', suggestedName: '' }
    ]);
  });

  it('normalizes an inconsistent different relation when a supported long name contains canonicalName', async () => {
    const parse = vi.fn().mockResolvedValue(
      createParsedResponse([
        createSemantic('unique-check-1', {
          canonicalName: 'DC-DC power converter',
          coreProduct: 'DC-DC power converter',
          comparison: {
            productIdentity: 'different',
            unsupportedInfo: false
          },
          confidence: 0.7
        })
      ])
    );
    const rows = [
      {
        rowId: 'unique-check-1',
        sheet: 'Data',
        excelRow: 2,
        stt: 1,
        productNameVi: 'Bộ chuyển đổi nguồn DC/DC cho bảng mạch tivi, 300V/4mA, 6W',
        productNameEn: 'DC/DC power converter for TV circuit boards, 300V/4mA, power 6W'
      }
    ];

    const results = await checkEnglishNamesWithOpenAI(rows, {
      client: { responses: { parse } }
    });

    expect(results).toEqual([
      { rowId: 'unique-check-1', status: 'OK', reason: '', suggestedName: '' }
    ]);
  });
});
