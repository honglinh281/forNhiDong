const { checkEnglishNamesWithOpenAIMock } = vi.hoisted(() => ({
  checkEnglishNamesWithOpenAIMock: vi.fn()
}));

vi.mock('@/lib/english-checker/ai', () => ({
  checkEnglishNamesWithOpenAI: checkEnglishNamesWithOpenAIMock
}));

import { maxDuration, POST } from '@/app/api/check/route';

describe('POST /api/check', () => {
  beforeEach(() => {
    checkEnglishNamesWithOpenAIMock.mockReset();
  });

  it('allows enough runtime for AI batches on Vercel', () => {
    expect(maxDuration).toBe(300);
  });

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
      suggestedName: ''
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

  it('does not retry the whole AI batch inside one server invocation', async () => {
    checkEnglishNamesWithOpenAIMock.mockRejectedValueOnce(new Error('OpenAI upstream failed.'));

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
              productNameVi: 'Giá đỡ máy chiếu',
              productNameEn: 'Projector stand'
            }
          ]
        })
      })
    );

    expect(response.status).toBe(502);
    expect(checkEnglishNamesWithOpenAIMock).toHaveBeenCalledTimes(1);
  });

  it('returns a clear 504 response for an upstream timeout', async () => {
    const timeoutError = new Error('Request timed out.');
    timeoutError.name = 'APIConnectionTimeoutError';
    checkEnglishNamesWithOpenAIMock.mockRejectedValueOnce(timeoutError);

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
              productNameVi: 'Giá đỡ máy chiếu',
              productNameEn: 'Projector stand'
            }
          ]
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(504);
    expect(payload.message).toContain('xử lý quá thời gian');
    expect(checkEnglishNamesWithOpenAIMock).toHaveBeenCalledTimes(1);
  });
});
