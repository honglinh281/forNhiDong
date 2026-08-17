import ExcelJS from 'exceljs';

import { ROW_STATUS, STATUS_LABELS } from '@/lib/constants';

export const COMPARISON_EXPORT_HEADERS = Object.freeze([
  'Trạng thái',
  'Dòng PDF',
  'Dòng Excel',
  'HS code PDF',
  'HS code Excel',
  'Tên hàng PDF',
  'Tên hàng Excel',
  'Đơn vị PDF',
  'Đơn vị Excel',
  'Số lượng PDF',
  'Số lượng Excel',
  'Ghi chú'
]);

const STATUS_FILLS = Object.freeze({
  [ROW_STATUS.MATCH]: 'FFE7F3E9',
  [ROW_STATUS.MATCH_WITH_HS_RULE]: 'FFE7F0F8',
  [ROW_STATUS.MISMATCH]: 'FFFFE8E1',
  [ROW_STATUS.MISSING_IN_EXCEL]: 'FFF8DDDD',
  [ROW_STATUS.MISSING_IN_PDF]: 'FFF8DDDD',
  [ROW_STATUS.PARSE_ERROR]: 'FFF4D6D6'
});

const STATUS_FONTS = Object.freeze({
  [ROW_STATUS.MATCH]: 'FF48624D',
  [ROW_STATUS.MATCH_WITH_HS_RULE]: 'FF46677D',
  [ROW_STATUS.MISMATCH]: 'FF985847',
  [ROW_STATUS.MISSING_IN_EXCEL]: 'FF974848',
  [ROW_STATUS.MISSING_IN_PDF]: 'FF974848',
  [ROW_STATUS.PARSE_ERROR]: 'FF8B3F3F'
});

const COLUMN_WIDTHS = Object.freeze([24, 12, 12, 17, 17, 42, 42, 16, 16, 16, 16, 52]);

function getFieldValue(row, field, source) {
  return String(row?.fields?.[field]?.[`${source}Value`] ?? '');
}

export function buildComparisonExportRows(rows) {
  return rows.map((row) => ({
    'Trạng thái': STATUS_LABELS[row.status] ?? row.status,
    'Dòng PDF': row.pdf?.rowNumber ?? '',
    'Dòng Excel': row.excel?.rowNumber ?? '',
    'HS code PDF': getFieldValue(row, 'hsCode', 'pdf'),
    'HS code Excel': getFieldValue(row, 'hsCode', 'excel'),
    'Tên hàng PDF': getFieldValue(row, 'itemName', 'pdf'),
    'Tên hàng Excel': getFieldValue(row, 'itemName', 'excel'),
    'Đơn vị PDF': getFieldValue(row, 'unit', 'pdf'),
    'Đơn vị Excel': getFieldValue(row, 'unit', 'excel'),
    'Số lượng PDF': getFieldValue(row, 'quantity', 'pdf'),
    'Số lượng Excel': getFieldValue(row, 'quantity', 'excel'),
    'Ghi chú': String(row.reason ?? '')
  }));
}

export function buildErrorExportRows(rows) {
  return buildComparisonExportRows(
    rows.filter((row) => row.status !== ROW_STATUS.MATCH && row.status !== ROW_STATUS.MATCH_WITH_HS_RULE)
  );
}

export function buildComparisonExportFileName(sourceName = '') {
  const baseName = sourceName
    .replace(/\.(xlsx|xls|csv)$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .trim();

  return `${baseName || 'ket-qua'}_ket-qua-doi-chieu-hs-code.xlsx`;
}

function setSummaryCell(cell, formula, result, fill, fontColor) {
  cell.value = { formula, result: Number(result ?? 0) };
  cell.numFmt = '#,##0';
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  cell.font = { bold: true, color: { argb: fontColor }, size: 13 };
}

function applyWorkbookFont(worksheet) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = { ...cell.font, name: 'Arial' };
    });
  });
}

function applyResultSheetStyle(worksheet, rows, summary, warningCount) {
  const dataStartRow = 7;
  const dataEndRow = dataStartRow + rows.length - 1;
  const formulaRange = rows.length ? `A${dataStartRow}:A${dataEndRow}` : null;

  worksheet.mergeCells('A1:L1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'KẾT QUẢ ĐỐI CHIẾU HS CODE';
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7B5C47' } };
  titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 18 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 34;

  for (const range of ['A2:A2', 'G2:G2', 'A3:A3']) {
    const cell = worksheet.getCell(range.split(':')[0]);
    cell.font = { bold: true, color: { argb: 'FF7B5C47' } };
    cell.alignment = { vertical: 'middle' };
  }

  worksheet.mergeCells('B2:F2');
  worksheet.mergeCells('H2:L2');
  worksheet.mergeCells('B3:L3');
  worksheet.getRow(2).height = 24;
  worksheet.getRow(3).height = 24;

  const summaryLabels = [
    ['A4:B4', 'Tổng số dòng'],
    ['D4:E4', 'Khớp'],
    ['G4:H4', 'Cần kiểm tra'],
    ['J4:K4', 'Cảnh báo parser']
  ];
  for (const [range, label] of summaryLabels) {
    worksheet.mergeCells(range);
    const labelCell = worksheet.getCell(range.split(':')[0]);
    labelCell.value = label;
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBEFEF' } };
    labelCell.font = { bold: true, color: { argb: 'FF7B5C47' } };
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  setSummaryCell(
    worksheet.getCell('C4'),
    formulaRange ? `COUNTA(${formulaRange})` : '0',
    summary?.totalRows ?? rows.length,
    'FFF7E7E7',
    'FF7B5C47'
  );
  setSummaryCell(
    worksheet.getCell('F4'),
    formulaRange
      ? `COUNTIF(${formulaRange},"${STATUS_LABELS[ROW_STATUS.MATCH]}")+COUNTIF(${formulaRange},"${STATUS_LABELS[ROW_STATUS.MATCH_WITH_HS_RULE]}")`
      : '0',
    summary?.matchCount ?? 0,
    'FFE7F3E9',
    'FF48624D'
  );
  setSummaryCell(
    worksheet.getCell('I4'),
    formulaRange ? 'C4-F4' : '0',
    summary?.errorCount ?? 0,
    'FFFFE8E1',
    'FF985847'
  );
  setSummaryCell(worksheet.getCell('L4'), String(warningCount), warningCount, 'FFF4D6D6', 'FF8B3F3F');
  worksheet.getRow(4).height = 30;

  const headerRow = worksheet.getRow(6);
  headerRow.height = 34;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9696' } };
    cell.font = { bold: true, color: { argb: 'FF6C0000' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FFD98686' } } };
  });

  rows.forEach((row, index) => {
    const excelRow = worksheet.getRow(dataStartRow + index);
    excelRow.height = 40;
    excelRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.alignment = {
        horizontal: columnNumber === 2 || columnNumber === 3 ? 'center' : 'left',
        vertical: 'top',
        wrapText: true
      };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE7DADA' } } };
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFAFA' } };
      }
    });

    const statusCell = excelRow.getCell(1);
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STATUS_FILLS[row.status] ?? 'FFF4ECEC' }
    };
    statusCell.font = { bold: true, color: { argb: STATUS_FONTS[row.status] ?? 'FF7B5C47' } };
    statusCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  COLUMN_WIDTHS.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  const lastRow = Math.max(6, dataEndRow);
  worksheet.autoFilter = { from: 'A6', to: `L${lastRow}` };
  worksheet.views = [{ state: 'frozen', ySplit: 6, activeCell: 'A7', showGridLines: false }];
  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    printArea: `A1:L${lastRow}`
  };
  applyWorkbookFont(worksheet);
}

function addWarningSheet(workbook, warnings) {
  if (!warnings.length) return;

  const worksheet = workbook.addWorksheet('Cảnh báo');
  worksheet.views = [{ state: 'frozen', ySplit: 2, activeCell: 'A3', showGridLines: false }];
  worksheet.mergeCells('A1:B1');
  worksheet.getCell('A1').value = 'CẢNH BÁO KHI ĐỌC DỮ LIỆU';
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7B5C47' } };
  worksheet.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
  worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 32;
  worksheet.addRow(['STT', 'Nội dung cảnh báo']);
  const headerRow = worksheet.getRow(2);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEB9696' } };
    cell.font = { bold: true, color: { argb: 'FF6C0000' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  warnings.forEach((warning, index) => {
    const row = worksheet.addRow([index + 1, String(warning)]);
    row.height = 32;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'top' };
    row.getCell(2).alignment = { vertical: 'top', wrapText: true };
  });
  worksheet.getColumn(1).width = 10;
  worksheet.getColumn(2).width = 100;
  worksheet.autoFilter = { from: 'A2', to: `B${warnings.length + 2}` };
  applyWorkbookFont(worksheet);
}

export async function createComparisonResultWorkbook({
  rows = [],
  summary = {},
  excelFileName = '',
  pdfFileName = '',
  parserWarnings = [],
  generatedAt = new Date()
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HS Code Checker';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;

  const worksheet = workbook.addWorksheet('Kết quả đối chiếu');
  worksheet.getCell('A2').value = 'File Excel';
  worksheet.getCell('B2').value = excelFileName || 'Không xác định';
  worksheet.getCell('G2').value = 'File PDF';
  worksheet.getCell('H2').value = pdfFileName || 'Không xác định';
  worksheet.getCell('A3').value = 'Thời gian xuất';
  worksheet.getCell('B3').value = generatedAt;
  worksheet.getCell('B3').numFmt = 'dd/mm/yyyy hh:mm';

  const exportRows = buildComparisonExportRows(rows);
  worksheet.getRow(6).values = COMPARISON_EXPORT_HEADERS;
  exportRows.forEach((row) => {
    worksheet.addRow(COMPARISON_EXPORT_HEADERS.map((header) => row[header]));
  });

  applyResultSheetStyle(worksheet, rows, summary, parserWarnings.length);
  addWarningSheet(workbook, parserWarnings);

  return workbook.xlsx.writeBuffer();
}
