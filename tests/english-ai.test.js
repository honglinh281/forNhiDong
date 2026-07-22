import { checkEnglishNamesWithOpenAI } from '@/lib/english-checker/ai';

function createSemantic(rowId, overrides = {}) {
  const checks = {
    coreProduct: 'match',
    partWhole: 'not_applicable',
    setScope: 'not_applicable',
    specificity: 'sufficient',
    material: 'not_applicable',
    function: 'match',
    terminology: 'natural',
    unsupportedInfo: false,
    ...overrides.checks
  };

  return {
    rowId,
    canonicalName: 'Projector stand',
    coreProduct: 'projector stand',
    criticalAttributes: ['projector stand'],
    optionalAttributes: [],
    checks,
    suggestedName: null,
    confidence: 0.95,
    ...overrides,
    checks
  };
}

describe('checkEnglishNamesWithOpenAI', () => {
  it('requests semantic Structured Output and lets the rule engine create final results', async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        results: [
          createSemantic('unique-check-1', {
            canonicalName: "Women's short-sleeved T-shirt",
            coreProduct: 'T-shirt',
            criticalAttributes: ['T-shirt'],
            optionalAttributes: ['women', 'short sleeves']
          }),
          createSemantic('unique-check-2', {
            suggestedName: 'Projector stand',
            checks: {
              coreProduct: 'not_applicable',
              partWhole: 'not_applicable',
              setScope: 'not_applicable',
              specificity: 'uncertain',
              material: 'not_applicable',
              function: 'not_applicable',
              terminology: 'uncertain',
              unsupportedInfo: false
            }
          })
        ]
      }
    });
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
    expect(parse.mock.calls[0][0].instructions).toContain('Never let productNameEn influence');
    expect(parse.mock.calls[0][0].instructions).not.toContain('Chỉ dùng bốn trạng thái');
    expect(JSON.parse(parse.mock.calls[0][0].input)).toEqual({ rows });
    expect(results).toEqual([
      {
        rowId: 'unique-check-1',
        status: 'OK',
        reason: null,
        suggestedName: null
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
      .mockResolvedValueOnce({
        output_parsed: {
          results: [
            createSemantic('unique-check-1', { confidence: 0.61 }),
            createSemantic('unique-check-2', {
              canonicalName: 'T-shirt',
              coreProduct: 'T-shirt',
              criticalAttributes: ['T-shirt']
            })
          ]
        }
      })
      .mockResolvedValueOnce({
        output_parsed: {
          results: [createSemantic('unique-check-1', { confidence: 0.98 })]
        }
      });
    const client = { responses: { parse } };
    const rows = [
      {
        rowId: 'unique-check-1',
        sheet: 'Data',
        excelRow: 2,
        stt: 1,
        productNameVi: 'Giá đỡ máy chiếu',
        productNameEn: 'Projector stand'
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
      { rowId: 'unique-check-1', status: 'OK', reason: null, suggestedName: null },
      { rowId: 'unique-check-2', status: 'OK', reason: null, suggestedName: null }
    ]);
  });
});
