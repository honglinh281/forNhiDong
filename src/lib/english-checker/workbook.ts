import ExcelJS from 'exceljs';

import {
  ENGLISH_CHECK_COLUMN_ALIASES,
  ENGLISH_CHECK_HEADER_SCAN_LIMIT,
  ENGLISH_CHECK_RESULT_HEADERS,
  ENGLISH_CHECK_STATUS_COLORS
} from '@/lib/english-checker/constants';
import type { FinalAuditResult, ProductRow } from '@/lib/english-checker/types';

type DetectedColumns = {
  stt: number | null;
  productNameVi: number;
  productNameEn: number;
  hsCode: number | null;
  checkInfo: number | null;
  customerFeedback: number | null;
  quoteCode: number | null;
  trackingCode: number | null;
  englishNameDetection: 'header' | 'hs-fallback';
};

export type ProductSheet = {
  name: string;
  headerRow: number;
  dataStartRow: number;
  rowCount: number;
  columns: DetectedColumns;
  englishNameHidden: boolean;
  englishNameDetection: 'header' | 'hs-fallback';
};

export function normalizeEnglishCheckHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/giu, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getEnglishCheckCellText(cell?: ExcelJS.Cell): string {
  const value = cell?.value;
  if (value == null) return '';
  if (['string', 'number', 'boolean'].includes(typeof value)) return String(value).trim();

  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((item) => item.text).join('').trim();
  }

  if (typeof value === 'object' && 'result' in value && value.result != null) {
    return String(value.result).trim();
  }

  return String(cell?.text ?? '').trim();
}

const NORMALIZED_ALIASES = Object.fromEntries(
  Object.entries(ENGLISH_CHECK_COLUMN_ALIASES).map(([key, aliases]) => [
    key,
    new Set(aliases.map(normalizeEnglishCheckHeader))
  ])
) as Record<keyof typeof ENGLISH_CHECK_COLUMN_ALIASES, Set<string>>;

function findColumnByAlias(headerRow: ExcelJS.Row, aliases: Set<string>): number | null {
  const maxColumn = Math.max(headerRow.cellCount, headerRow.worksheet.columnCount);
  for (let column = 1; column <= maxColumn; column += 1) {
    if (aliases.has(normalizeEnglishCheckHeader(getEnglishCheckCellText(headerRow.getCell(column))))) {
      return column;
    }
  }
  return null;
}

function findProductHeaderRow(worksheet: ExcelJS.Worksheet): number | null {
  const lastRow = Math.min(worksheet.rowCount, ENGLISH_CHECK_HEADER_SCAN_LIMIT);
  for (let row = 1; row <= lastRow; row += 1) {
    if (findColumnByAlias(worksheet.getRow(row), NORMALIZED_ALIASES.productNameVi)) return row;
  }
  return null;
}

function hasTextData(worksheet: ExcelJS.Worksheet, column: number, dataStartRow: number): boolean {
  const sampleEnd = Math.min(worksheet.rowCount, dataStartRow + 19);
  for (let row = dataStartRow; row <= sampleEnd; row += 1) {
    const value = getEnglishCheckCellText(worksheet.getRow(row).getCell(column));
    if (value && !/^[-+]?\d[\d\s.,/]*$/.test(value)) return true;
  }
  return false;
}

export function detectEnglishCheckColumns(
  worksheet: ExcelJS.Worksheet,
  headerRowNumber: number
) {
  const headerRow = worksheet.getRow(headerRowNumber);
  const dataStartRow = headerRowNumber + 1;
  const productNameVi = findColumnByAlias(headerRow, NORMALIZED_ALIASES.productNameVi);
  const hsCode = findColumnByAlias(headerRow, NORMALIZED_ALIASES.hsCode);
  let productNameEn = findColumnByAlias(headerRow, NORMALIZED_ALIASES.productNameEn);
  let englishNameDetection: 'header' | 'hs-fallback' | undefined = productNameEn ? 'header' : undefined;

  if (!productNameEn && hsCode) {
    const candidate = hsCode - 1;
    if (candidate > 0 && candidate !== productNameVi && hasTextData(worksheet, candidate, dataStartRow)) {
      productNameEn = candidate;
      englishNameDetection = 'hs-fallback';
    }
  }

  return {
    stt: findColumnByAlias(headerRow, NORMALIZED_ALIASES.stt),
    productNameVi,
    productNameEn,
    hsCode,
    checkInfo: findColumnByAlias(headerRow, NORMALIZED_ALIASES.checkInfo),
    customerFeedback: findColumnByAlias(headerRow, NORMALIZED_ALIASES.customerFeedback),
    quoteCode: findColumnByAlias(headerRow, NORMALIZED_ALIASES.quoteCode),
    trackingCode: findColumnByAlias(headerRow, NORMALIZED_ALIASES.trackingCode),
    englishNameDetection
  };
}

function textOrNull(cell: ExcelJS.Cell): string | null {
  return getEnglishCheckCellText(cell) || null;
}

function extractProductRows(
  worksheet: ExcelJS.Worksheet,
  headerRow: number,
  columns: DetectedColumns
): ProductRow[] {
  const rows: ProductRow[] = [];
  const businessColumns = Object.values(columns).filter((value): value is number => typeof value === 'number');

  for (let excelRow = headerRow + 1; excelRow <= worksheet.rowCount; excelRow += 1) {
    const row = worksheet.getRow(excelRow);
    if (!businessColumns.some((column) => getEnglishCheckCellText(row.getCell(column)))) continue;
    rows.push({
      rowId: `${worksheet.name}::${excelRow}`,
      sheet: worksheet.name,
      excelRow,
      stt: columns.stt ? textOrNull(row.getCell(columns.stt)) : null,
      productNameVi: textOrNull(row.getCell(columns.productNameVi)),
      productNameEn: textOrNull(row.getCell(columns.productNameEn)),
      checkInfo: columns.checkInfo ? getEnglishCheckCellText(row.getCell(columns.checkInfo)) : '',
      customerFeedback: columns.customerFeedback
        ? getEnglishCheckCellText(row.getCell(columns.customerFeedback))
        : ''
    });
  }
  return rows;
}

export async function readEnglishCheckWorkbook(buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheets: ProductSheet[] = [];
  const rows: ProductRow[] = [];
  const undetectedEnglishSheets: string[] = [];

  workbook.eachSheet((worksheet) => {
    const headerRow = findProductHeaderRow(worksheet);
    if (!headerRow) return;
    const detected = detectEnglishCheckColumns(worksheet, headerRow);
    if (!detected.productNameVi) return;
    if (!detected.productNameEn || !detected.englishNameDetection) {
      undetectedEnglishSheets.push(worksheet.name);
      return;
    }
    const columns = detected as DetectedColumns;
    const sheetRows = extractProductRows(worksheet, headerRow, columns);
    sheets.push({
      name: worksheet.name,
      headerRow,
      dataStartRow: headerRow + 1,
      rowCount: sheetRows.length,
      columns,
      englishNameHidden: Boolean(worksheet.getColumn(columns.productNameEn).hidden),
      englishNameDetection: columns.englishNameDetection
    });
    rows.push(...sheetRows);
  });

  if (!sheets.length && !undetectedEnglishSheets.length) {
    throw new Error('Không tìm thấy cột "Tên hàng hóa XNK" trong workbook.');
  }
  if (undetectedEnglishSheets.length) {
    throw new Error(`Không xác định được cột "Tên TA" trong sheet ${undetectedEnglishSheets.join(', ')}. Vui lòng kiểm tra cấu trúc file.`);
  }
  return { workbook, sheets, rows, totalRows: rows.length };
}

function cloneStyle(style: Partial<ExcelJS.Style>): Partial<ExcelJS.Style> {
  return style && Object.keys(style).length ? JSON.parse(JSON.stringify(style)) : {};
}

function ensureResultColumns(worksheet: ExcelJS.Worksheet, headerRowNumber: number) {
  const headerRow = worksheet.getRow(headerRowNumber);
  const expected = Object.fromEntries(
    Object.entries(ENGLISH_CHECK_RESULT_HEADERS).map(([key, value]) => [key, normalizeEnglishCheckHeader(value)])
  );
  const found: Partial<Record<keyof typeof ENGLISH_CHECK_RESULT_HEADERS, number>> = {};
  for (let column = 1; column <= worksheet.columnCount; column += 1) {
    const value = normalizeEnglishCheckHeader(getEnglishCheckCellText(headerRow.getCell(column)));
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (value === expectedValue) found[key as keyof typeof found] = column;
    }
  }
  const referenceStyle = cloneStyle(headerRow.getCell(Math.max(1, worksheet.columnCount)).style);
  let nextColumn = worksheet.columnCount + 1;
  for (const [key, label] of Object.entries(ENGLISH_CHECK_RESULT_HEADERS)) {
    const typedKey = key as keyof typeof ENGLISH_CHECK_RESULT_HEADERS;
    if (found[typedKey]) continue;
    const cell = headerRow.getCell(nextColumn);
    cell.value = label;
    cell.style = cloneStyle(referenceStyle);
    found[typedKey] = nextColumn;
    nextColumn += 1;
  }
  return found as Record<keyof typeof ENGLISH_CHECK_RESULT_HEADERS, number>;
}

export async function writeEnglishCheckResults(
  workbook: ExcelJS.Workbook,
  sheets: ProductSheet[],
  results: FinalAuditResult[]
) {
  const resultByRowId = new Map(results.map((result) => [result.rowId, result]));
  for (const sheet of sheets) {
    const worksheet = workbook.getWorksheet(sheet.name);
    if (!worksheet) continue;
    const columns = ensureResultColumns(worksheet, sheet.headerRow);
    for (let excelRow = sheet.dataStartRow; excelRow <= worksheet.rowCount; excelRow += 1) {
      const result = resultByRowId.get(`${sheet.name}::${excelRow}`);
      if (!result) continue;
      const statusCell = worksheet.getRow(excelRow).getCell(columns.status);
      statusCell.value = String(result.status ?? '');
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ENGLISH_CHECK_STATUS_COLORS[result.status] }
      };
      worksheet.getRow(excelRow).getCell(columns.reason).value = String(result.reason ?? '');
      worksheet.getRow(excelRow).getCell(columns.suggestedName).value = String(result.suggestedName ?? '');
    }
  }
  return workbook.xlsx.writeBuffer();
}
