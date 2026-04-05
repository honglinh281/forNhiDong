import { POST } from '@/app/api/compare/route';

import { createSampleExcelBuffer, createSampleFormEPdfBuffer, createSamplePdfBuffer } from './helpers';

describe('POST /api/compare', () => {
  it('compares an uploaded excel and pdf pair', async () => {
    const excelBuffer = createSampleExcelBuffer([
      {
        'HS code': '6211.43',
        'Tên hàng': "WOMEN'S LONG-SLEEVED PULLOVER",
        'Đơn vị tính': 'PCE',
        'Số lượng': '10'
      },
      {
        'HS code': '8308.90',
        'Tên hàng': 'BROOCH',
        'Đơn vị tính': 'PCE',
        'Số lượng': '951'
      }
    ]);

    const pdfBuffer = await createSampleFormEPdfBuffer([
      {
        itemNumber: 1,
        itemName: "WOMEN'S LONG-SLEEVED PULLOVER",
        hsCode: '6211.43',
        quantity: '10',
        unit: 'PCE'
      },
      {
        itemNumber: 2,
        itemName: 'BROOCH',
        hsCode: '8308.90',
        quantity: '950',
        unit: 'PCE'
      }
    ]);

    const formData = new FormData();
    formData.set(
      'excelFile',
      new File([excelBuffer], 'hang-hoa.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
    );
    formData.set(
      'pdfFile',
      new File([pdfBuffer], 'to-khai.pdf', {
        type: 'application/pdf'
      })
    );

    const response = await POST(
      new Request('http://localhost/api/compare', {
        method: 'POST',
        body: formData
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.summary.totalRows).toBe(2);
    expect(payload.summary.mismatchCount).toBe(1);
    expect(payload.summary.errorCount).toBe(1);
  });

  it('returns a clear error when the PDF has no extractable item rows', async () => {
    const excelBuffer = createSampleExcelBuffer([
      {
        'HS code': '6211.43',
        'Tên hàng': "WOMEN'S LONG-SLEEVED PULLOVER",
        'Đơn vị tính': 'PCE',
        'Số lượng': '10'
      }
    ]);
    const pdfBuffer = await createSamplePdfBuffer(['ASEAN-CHINA FREE TRADE AREA', 'FORM E']);

    const formData = new FormData();
    formData.set(
      'excelFile',
      new File([excelBuffer], 'hang-hoa.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
    );
    formData.set(
      'pdfFile',
      new File([pdfBuffer], 'blank-form-e.pdf', {
        type: 'application/pdf'
      })
    );

    const response = await POST(
      new Request('http://localhost/api/compare', {
        method: 'POST',
        body: formData
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain('Không tìm thấy dòng hàng hóa nào trong PDF Form E.');
  });
});
