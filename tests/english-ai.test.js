import { checkEnglishNamesWithOpenAI } from '@/lib/english-checker/ai';

describe('checkEnglishNamesWithOpenAI', () => {
  it('uses the Responses API structured-output flow and enforces compact deterministic output', async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        results: [
          {
            rowId: 'unique-check-1',
            status: 'OK',
            reason: 'Không được giữ nội dung này.',
            suggestedName: 'Không được giữ nội dung này.'
          },
          {
            rowId: 'unique-check-2',
            status: 'Chưa sát',
            reason: 'Tên hiện tại đang trống.',
            suggestedName: 'Projector stand'
          }
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
        productNameVi: 'Áo phông ngắn tay',
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
});
