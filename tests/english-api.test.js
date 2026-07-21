import { POST } from '@/app/api/check/route';

describe('POST /api/check', () => {
  it('resolves rows missing Tên hàng hóa XNK without calling OpenAI', async () => {
    const response = await POST(
      new Request('http://localhost/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: [
            {
              rowId: 'Sheet1:2',
              sheet: 'Sheet1',
              excelRow: 2,
              stt: 1,
              productNameVi: null,
              productNameEn: 'PUMP IMPELLER'
            }
          ]
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results[0]).toEqual({
      rowId: 'Sheet1:2',
      status: 'Thiếu dữ liệu',
      reason: 'Thiếu "Tên hàng hóa XNK".',
      suggestedName: null
    });
  });

  it('validates request payloads before processing', async () => {
    const response = await POST(
      new Request('http://localhost/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [] })
      })
    );

    expect(response.status).toBe(400);
  });
});
