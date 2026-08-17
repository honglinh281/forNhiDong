import ExcelJS from 'exceljs';

import {
  buildComparisonExportFileName,
  buildComparisonExportRows,
  createComparisonResultWorkbook
} from '@/lib/export';

function comparisonRow(overrides = {}) {
  return {
    id: 'row-1',
    status: 'MISMATCH',
    reason: 'Sai lệch tại: Số lượng.',
    pdf: { rowNumber: 3 },
    excel: { rowNumber: 4 },
    fields: {
      hsCode: { pdfValue: '01234567', excelValue: '01234567' },
      itemName: { pdfValue: 'Laptop adapter', excelValue: 'Laptop adapter' },
      unit: { pdfValue: 'PCE', excelValue: 'PIECE' },
      quantity: { pdfValue: '12', excelValue: '10' }
    },
    ...overrides
  };
}

describe('comparison result Excel export', () => {
  it('maps all result values and preserves HS codes as text', () => {
    const [row] = buildComparisonExportRows([comparisonRow()]);

    expect(row).toMatchObject({
      'Trạng thái': 'Sai lệch',
      'Dòng PDF': 3,
      'Dòng Excel': 4,
      'HS code PDF': '01234567',
      'HS code Excel': '01234567',
      'Số lượng PDF': '12',
      'Số lượng Excel': '10',
      'Ghi chú': 'Sai lệch tại: Số lượng.'
    });
  });

  it('creates a styled workbook with summary, complete results, filter, and parser warnings', async () => {
    const generatedAt = new Date('2026-08-17T03:30:00.000Z');
    const buffer = await createComparisonResultWorkbook({
      rows: [comparisonRow()],
      summary: { totalRows: 1, matchCount: 0, errorCount: 1 },
      excelFileName: 'danh-sach.xlsx',
      pdfFileName: 'to-khai.pdf',
      parserWarnings: ['Không đọc được một ô ghi chú.'],
      generatedAt
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const resultSheet = workbook.getWorksheet('Kết quả đối chiếu');
    expect(resultSheet.getCell('A1').value).toBe('KẾT QUẢ ĐỐI CHIẾU HS CODE');
    expect(resultSheet.getCell('B2').value).toBe('danh-sach.xlsx');
    expect(resultSheet.getCell('H2').value).toBe('to-khai.pdf');
    expect(resultSheet.getCell('C4').value).toMatchObject({ formula: 'COUNTA(A7:A7)', result: 1 });
    expect(resultSheet.getCell('A6').value).toBe('Trạng thái');
    expect(resultSheet.getCell('D7').value).toBe('01234567');
    expect(resultSheet.getCell('E7').value).toBe('01234567');
    expect(resultSheet.getCell('A7').value).toBe('Sai lệch');
    expect(resultSheet.getCell('A7').fill.fgColor.argb).toBe('FFFFE8E1');
    expect(resultSheet.autoFilter).toBe('A6:L7');
    expect(resultSheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 6, showGridLines: false });

    const warningSheet = workbook.getWorksheet('Cảnh báo');
    expect(warningSheet.getCell('A1').value).toBe('CẢNH BÁO KHI ĐỌC DỮ LIỆU');
    expect(warningSheet.getCell('B3').value).toBe('Không đọc được một ô ghi chú.');
  });

  it('builds a safe and descriptive output filename', () => {
    expect(buildComparisonExportFileName('Danh sách: tháng 8.xlsx')).toBe(
      'Danh sách- tháng 8_ket-qua-doi-chieu-hs-code.xlsx'
    );
    expect(buildComparisonExportFileName()).toBe('ket-qua_ket-qua-doi-chieu-hs-code.xlsx');
  });
});
