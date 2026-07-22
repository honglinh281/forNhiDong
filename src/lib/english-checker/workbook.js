import ExcelJS from 'exceljs';

import {
  ENGLISH_CHECK_COLUMN_ALIASES,
  ENGLISH_CHECK_HEADER_SCAN_LIMIT,
  ENGLISH_CHECK_RESULT_HEADERS,
  ENGLISH_CHECK_STATUS_COLORS
} from '@/lib/english-checker/constants';

export function normalizeEnglishCheckHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getEnglishCheckCellText(cell) {
  if (!cell) {
    return '';
  }

  const value = cell.value;

  if (value === null || value === undefined) {
    return '';
  }

  if (['string', 'number', 'boolean'].includes(typeof value)) {
    return String(value).trim();
  }

  if (typeof value === 'object' && Array.isArray(value.richText)) {
    return value.richText.map((item) => item.text ?? '').join('').trim();
  }

  if (typeof value === 'object' && value.result !== null && value.result !== undefined) {
    return String(value.result).trim();
  }

  return cell.text?.trim() ?? '';
}

function createNormalizedAliases() {
  return Object.fromEntries(
    Object.entries(ENGLISH_CHECK_COLUMN_ALIASES).map(([key, aliases]) => [
      key,
      new Set(aliases.map(normalizeEnglishCheckHeader))
    ])
  );
}

const NORMALIZED_ALIASES = createNormalizedAliases();

function findColumnByAlias(headerRow, aliases) {
  const maxColumn = Math.max(headerRow.cellCount, headerRow.worksheet.columnCount);

  for (let columnNumber = 1; columnNumber <= maxColumn; columnNumber += 1) {
    const normalizedValue = normalizeEnglishCheckHeader(getEnglishCheckCellText(headerRow.getCell(columnNumber)));

    if (aliases.has(normalizedValue)) {
      return columnNumber;
    }
  }

  return null;
}

function findProductHeaderRow(worksheet) {
  const lastRow = Math.min(worksheet.rowCount, ENGLISH_CHECK_HEADER_SCAN_LIMIT);

  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);

    if (findColumnByAlias(row, NORMALIZED_ALIASES.productNameVi)) {
      return rowNumber;
    }
  }

  return null;
}

function hasTextData(worksheet, columnNumber, dataStartRow) {
  if (!columnNumber || columnNumber < 1) {
    return false;
  }

  const sampleEnd = Math.min(worksheet.rowCount, dataStartRow + 19);

  let textCount = 0;
  let englishLikeCount = 0;

  for (let rowNumber = dataStartRow; rowNumber <= sampleEnd; rowNumber += 1) {
    const value = getEnglishCheckCellText(worksheet.getRow(rowNumber).getCell(columnNumber));

    if (value && !/^[-+]?\d[\d\s.,/]*$/.test(value)) {
      textCount += 1;

      if (/[a-z]/i.test(value) && !/[ăâđêôơư]/iu.test(value)) {
        englishLikeCount += 1;
      }
    }
  }

  return textCount > 0 && englishLikeCount >= Math.min(2, textCount);
}

export function detectEnglishCheckColumns(worksheet, headerRowNumber) {
  const headerRow = worksheet.getRow(headerRowNumber);
  const dataStartRow = headerRowNumber + 1;
  const productNameVi =
    findColumnByAlias(headerRow, new Set([normalizeEnglishCheckHeader('Tên hàng hóa XNK')])) ||
    findColumnByAlias(headerRow, NORMALIZED_ALIASES.productNameVi);
  const hsCode = findColumnByAlias(headerRow, NORMALIZED_ALIASES.hsCode);
  let productNameEn = findColumnByAlias(headerRow, NORMALIZED_ALIASES.productNameEn);
  let englishNameDetection = productNameEn ? 'header' : null;

  if (!productNameEn && hsCode) {
    const candidate = hsCode - 1;

    if (candidate !== productNameVi && hasTextData(worksheet, candidate, dataStartRow)) {
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

function toNullableText(cell) {
  const value = getEnglishCheckCellText(cell);
  return value || null;
}

function extractProductRows(worksheet, headerRow, columns) {
  const rows = [];
  const businessColumns = [
    columns.stt,
    columns.productNameVi,
    columns.productNameEn,
    columns.hsCode,
    columns.checkInfo,
    columns.customerFeedback,
    columns.quoteCode,
    columns.trackingCode
  ].filter(Boolean);

  for (let excelRow = headerRow + 1; excelRow <= worksheet.rowCount; excelRow += 1) {
    const row = worksheet.getRow(excelRow);
    const hasBusinessData = businessColumns.some((columnNumber) => getEnglishCheckCellText(row.getCell(columnNumber)));

    if (!hasBusinessData) {
      continue;
    }

    rows.push({
      rowId: `${worksheet.name}:${excelRow}`,
      sheet: worksheet.name,
      excelRow,
      stt: columns.stt ? toNullableText(row.getCell(columns.stt)) : null,
      productNameVi: toNullableText(row.getCell(columns.productNameVi)),
      productNameEn: toNullableText(row.getCell(columns.productNameEn)),
      checkInfo: columns.checkInfo ? toNullableText(row.getCell(columns.checkInfo)) : null,
      customerFeedback: columns.customerFeedback
        ? toNullableText(row.getCell(columns.customerFeedback))
        : null
    });
  }

  return rows;
}

export async function readEnglishCheckWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets = [];
  const rows = [];
  const undetectedEnglishSheets = [];

  workbook.eachSheet((worksheet) => {
    const headerRow = findProductHeaderRow(worksheet);

    if (!headerRow) {
      return;
    }

    const columns = detectEnglishCheckColumns(worksheet, headerRow);

    if (!columns.productNameEn) {
      undetectedEnglishSheets.push(worksheet.name);
      return;
    }

    const sheetRows = extractProductRows(worksheet, headerRow, columns);
    const sheetInfo = {
      name: worksheet.name,
      headerRow,
      dataStartRow: headerRow + 1,
      rowCount: sheetRows.length,
      columns,
      englishNameHidden: Boolean(worksheet.getColumn(columns.productNameEn).hidden),
      englishNameDetection: columns.englishNameDetection
    };

    sheets.push(sheetInfo);
    rows.push(...sheetRows);
  });

  if (!sheets.length && !undetectedEnglishSheets.length) {
    throw new Error('Không tìm thấy cột "Tên hàng hóa XNK" trong workbook.');
  }

  if (undetectedEnglishSheets.length) {
    throw new Error(
      `Không xác định được cột "Tên TA" trong sheet ${undetectedEnglishSheets.join(', ')}. Vui lòng kiểm tra cấu trúc file.`
    );
  }

  return {
    workbook,
    sheets,
    rows,
    totalRows: rows.length
  };
}

function cloneStyle(style) {
  if (!style || !Object.keys(style).length) {
    return {};
  }

  return JSON.parse(JSON.stringify(style));
}

function findResultColumns(worksheet, headerRowNumber) {
  const headerRow = worksheet.getRow(headerRowNumber);
  const expected = Object.fromEntries(
    Object.entries(ENGLISH_CHECK_RESULT_HEADERS).map(([key, value]) => [key, normalizeEnglishCheckHeader(value)])
  );
  const found = {};

  for (let columnNumber = 1; columnNumber <= worksheet.columnCount; columnNumber += 1) {
    const normalizedValue = normalizeEnglishCheckHeader(getEnglishCheckCellText(headerRow.getCell(columnNumber)));

    for (const [key, expectedValue] of Object.entries(expected)) {
      if (normalizedValue === expectedValue) {
        found[key] = columnNumber;
      }
    }
  }

  return found;
}

function ensureResultColumns(worksheet, headerRowNumber) {
  const existing = findResultColumns(worksheet, headerRowNumber);

  if (existing.status && existing.reason && existing.suggestedName) {
    return existing;
  }

  const headerRow = worksheet.getRow(headerRowNumber);
  const referenceColumn = Math.max(1, worksheet.columnCount);
  const referenceStyle = cloneStyle(headerRow.getCell(referenceColumn).style);
  let nextColumn = worksheet.columnCount + 1;

  for (const [key, label] of Object.entries(ENGLISH_CHECK_RESULT_HEADERS)) {
    if (existing[key]) {
      continue;
    }

    const cell = headerRow.getCell(nextColumn);
    cell.value = label;
    cell.style = cloneStyle(referenceStyle);
    existing[key] = nextColumn;
    nextColumn += 1;
  }

  return existing;
}

export async function writeEnglishCheckResults(workbook, sheets, results) {
  const resultByRowId = new Map(results.map((result) => [result.rowId, result]));

  for (const sheet of sheets) {
    const worksheet = workbook.getWorksheet(sheet.name);

    if (!worksheet) {
      continue;
    }

    const resultColumns = ensureResultColumns(worksheet, sheet.headerRow);

    for (let excelRow = sheet.dataStartRow; excelRow <= worksheet.rowCount; excelRow += 1) {
      const result = resultByRowId.get(`${sheet.name}:${excelRow}`);

      if (!result) {
        continue;
      }

      const statusCell = worksheet.getRow(excelRow).getCell(resultColumns.status);
      statusCell.value = result.status;
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ENGLISH_CHECK_STATUS_COLORS[result.status] }
      };
      worksheet.getRow(excelRow).getCell(resultColumns.reason).value = result.reason ?? '';
      worksheet.getRow(excelRow).getCell(resultColumns.suggestedName).value = result.suggestedName ?? '';
    }
  }

  return workbook.xlsx.writeBuffer();
}
