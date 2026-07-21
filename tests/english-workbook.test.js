import ExcelJS from 'exceljs';

import { ENGLISH_CHECK_STATUS } from '@/lib/english-checker/constants';
import { readEnglishCheckWorkbook, writeEnglishCheckResults } from '@/lib/english-checker/workbook';

async function createWorkbook(setup) {
  const workbook = new ExcelJS.Workbook();
  await setup(workbook);
  return workbook.xlsx.writeBuffer();
}

describe('readEnglishCheckWorkbook', () => {
  it('detects a hidden Tên TA column by header and scans multiple sheets independently', async () => {
    const buffer = await createWorkbook(async (workbook) => {
      const ignored = workbook.addWorksheet('Ghi chú');
      ignored.addRow(['Không phải sheet hàng hóa']);

      const products = workbook.addWorksheet('Hàng hóa');
      products.addRow(['BÁO CÁO']);
      products.addRow([]);
      products.addRow(['STT', 'Tên hàng hóa XNK', 'Tên TA', 'Mã HS']);
      products.addRow([1, 'Cánh bơm, dùng cho máy bơm nước', 'Pump impeller', '84139190']);
      products.getColumn(3).hidden = true;
    });

    const parsed = await readEnglishCheckWorkbook(buffer);

    expect(parsed.sheets).toHaveLength(1);
    expect(parsed.sheets[0]).toMatchObject({
      name: 'Hàng hóa',
      headerRow: 3,
      englishNameHidden: true,
      englishNameDetection: 'header'
    });
    expect(parsed.rows).toEqual([
      expect.objectContaining({
        rowId: 'Hàng hóa:4',
        stt: '1',
        productNameVi: 'Cánh bơm, dùng cho máy bơm nước',
        productNameEn: 'Pump impeller'
      })
    ]);
  });

  it('falls back to the hidden column immediately before Mã HS when Tên TA has no header', async () => {
    const buffer = await createWorkbook(async (workbook) => {
      const worksheet = workbook.addWorksheet('Worksheet');
      worksheet.getCell('M1').value = 'Tên hàng hóa XNK';
      worksheet.getCell('R1').value = 'Mã HS';
      worksheet.getCell('M2').value = 'Túi xách tay bằng nhựa';
      worksheet.getCell('Q2').value = 'HANDBAG';
      worksheet.getCell('R2').value = '42022220';
      worksheet.getColumn(17).hidden = true;
    });

    const parsed = await readEnglishCheckWorkbook(buffer);

    expect(parsed.sheets[0].columns.productNameEn).toBe(17);
    expect(parsed.sheets[0].englishNameDetection).toBe('hs-fallback');
    expect(parsed.sheets[0].englishNameHidden).toBe(true);
    expect(parsed.rows[0].productNameEn).toBe('HANDBAG');
  });

  it('keeps rows with a missing name but skips fully blank rows', async () => {
    const buffer = await createWorkbook(async (workbook) => {
      const worksheet = workbook.addWorksheet('Data');
      worksheet.addRow(['STT', 'Tên hàng hóa XNK', 'Tên TA', 'Mã HS']);
      worksheet.addRow([1, 'Giá đỡ máy chiếu', null, '96200030']);
      worksheet.addRow([]);
      worksheet.addRow([3, null, 'PROJECTOR STAND', '96200030']);
    });

    const parsed = await readEnglishCheckWorkbook(buffer);

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].productNameEn).toBeNull();
    expect(parsed.rows[1].productNameVi).toBeNull();
  });

  it('reports a clear error when the English column cannot be detected', async () => {
    const buffer = await createWorkbook(async (workbook) => {
      const worksheet = workbook.addWorksheet('Data');
      worksheet.addRow(['STT', 'Tên hàng hóa XNK', 'Mã HS']);
      worksheet.addRow([1, 'Cánh bơm', '84139190']);
    });

    await expect(readEnglishCheckWorkbook(buffer)).rejects.toThrow('Không xác định được cột "Tên TA"');
  });
});

describe('writeEnglishCheckResults', () => {
  it('appends result columns, colors the status cell, and preserves hidden columns', async () => {
    const sourceBuffer = await createWorkbook(async (workbook) => {
      const worksheet = workbook.addWorksheet('Hàng hóa');
      worksheet.addRow(['STT', 'Tên hàng hóa XNK', 'Tên TA', 'Mã HS']);
      worksheet.addRow([1, 'Cánh bơm', 'Water pump', '84139190']);
      worksheet.getColumn(3).hidden = true;
    });
    const parsed = await readEnglishCheckWorkbook(sourceBuffer);
    const outputBuffer = await writeEnglishCheckResults(parsed.workbook, parsed.sheets, [
      {
        rowId: 'Hàng hóa:2',
        status: ENGLISH_CHECK_STATUS.WRONG,
        reason: 'Tên hiện tại mô tả máy hoàn chỉnh thay vì linh kiện.',
        suggestedName: 'Pump impeller'
      }
    ]);
    const outputWorkbook = new ExcelJS.Workbook();
    await outputWorkbook.xlsx.load(outputBuffer);
    const outputSheet = outputWorkbook.getWorksheet('Hàng hóa');

    expect(outputSheet.getColumn(3).hidden).toBe(true);
    expect(outputSheet.getRow(1).values.slice(-3)).toEqual([
      'Kết quả check Tên TA',
      'Lý do',
      'Tên TA đề xuất'
    ]);
    expect(outputSheet.getCell('E2').value).toBe(ENGLISH_CHECK_STATUS.WRONG);
    expect(outputSheet.getCell('E2').fill.fgColor.argb).toBe('FFFEE2E2');
    expect(outputSheet.getCell('G2').value).toBe('Pump impeller');
  });
});
