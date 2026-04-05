import * as XLSX from 'xlsx';

import { extractExcelRows } from '@/lib/excel';

function createWorkbookBuffer(rows) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

describe('extractExcelRows', () => {
  it('accepts common customs spreadsheet headers', () => {
    const workbookBuffer = createWorkbookBuffer([
      ['STT', 'Tên hàng (mô tả chi tiết)', 'hs code', 'Lượng', 'Đơn vị tính', ''],
      ['1', "WOMEN'S LONG-SLEEVED PULLOVER", '6211.43', '10', 'PCE', ''],
      ['2', 'BROOCH', '8308.90', '950', 'PCE', '']
    ]);

    const result = extractExcelRows(workbookBuffer);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].normalized.itemName).toBe("women's long-sleeved pullover");
    expect(result.rows[0].normalized.hsCode).toBe('621143');
    expect(result.rows[0].normalized.quantity).toBe('10');
    expect(result.rows[0].normalized.unit).toBe('piece');
  });

  it('fails when a required customs column is missing', () => {
    const workbookBuffer = createWorkbookBuffer([
      ['STT', 'Tên hàng', 'hs code', 'Đơn vị tính'],
      ['1', 'BROOCH', '8308.90', 'PCE']
    ]);

    expect(() => extractExcelRows(workbookBuffer)).toThrow(
      'Không xác định được đủ 4 cột bắt buộc trong file Excel: HS code, Tên hàng, Đơn vị tính, Số lượng.'
    );
  });
});
