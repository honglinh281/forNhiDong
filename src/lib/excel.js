import * as XLSX from 'xlsx';

import { FIELD_ALIASES, REQUIRED_FIELDS } from '@/lib/constants';
import { createDeclarationRow } from '@/lib/declaration';
import { normalizeHeader } from '@/lib/normalize';

function toBuffer(bufferLike) {
  if (Buffer.isBuffer(bufferLike)) {
    return bufferLike;
  }

  if (bufferLike instanceof Uint8Array) {
    return Buffer.from(bufferLike);
  }

  return Buffer.from(bufferLike);
}

function rowHasContent(row) {
  return row.some((value) => String(value ?? '').trim() !== '');
}

function getBestMatchingIndex(normalizedCells, field) {
  const aliases = FIELD_ALIASES[field];
  let bestMatch = { index: -1, score: 0 };

  normalizedCells.forEach((cell, index) => {
    if (!cell) {
      return;
    }

    aliases.forEach((alias) => {
      let score = 0;

      if (cell === alias) {
        score = 3;
      } else if (alias.length >= 4 && (cell.includes(alias) || alias.includes(cell))) {
        score = 2;
      }

      if (score > bestMatch.score) {
        bestMatch = { index, score };
      }
    });
  });

  return bestMatch.index;
}

function findHeaderMapping(rows) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 30); rowIndex += 1) {
    const row = rows[rowIndex];
    const normalizedCells = row.map((cell) => normalizeHeader(cell));
    const mapping = {};

    for (const field of REQUIRED_FIELDS) {
      const matchedIndex = getBestMatchingIndex(normalizedCells, field);

      if (matchedIndex >= 0) {
        mapping[field] = matchedIndex;
      }
    }

    if (REQUIRED_FIELDS.every((field) => Number.isInteger(mapping[field]))) {
      return {
        headerRowIndex: rowIndex,
        mapping
      };
    }
  }

  return null;
}

export function extractExcelRows(bufferLike) {
  const workbook = XLSX.read(toBuffer(bufferLike), {
    type: 'buffer',
    raw: false,
    cellText: true
  });

  const sheetName = workbook.SheetNames.find((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
    return rows.some(rowHasContent);
  });

  if (!sheetName) {
    throw new Error('Không tìm thấy sheet nào có dữ liệu trong file Excel.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
  const header = findHeaderMapping(rows);

  if (!header) {
    throw new Error('Không xác định được đủ 4 cột bắt buộc trong file Excel: HS code, Tên hàng, Đơn vị tính, Số lượng.');
  }

  const dataRows = [];
  const warnings = [`Đang đọc sheet "${sheetName}".`];

  for (let index = header.headerRowIndex + 1; index < rows.length; index += 1) {
    const currentRow = rows[index];

    if (!rowHasContent(currentRow)) {
      continue;
    }

    const declarationRow = createDeclarationRow(
      'excel',
      {
        hsCode: currentRow[header.mapping.hsCode],
        itemName: currentRow[header.mapping.itemName],
        unit: currentRow[header.mapping.unit],
        quantity: currentRow[header.mapping.quantity]
      },
      index + 1,
      { sheetName }
    );

    dataRows.push(declarationRow);
  }

  if (dataRows.length === 0) {
    throw new Error('Sheet Excel có tiêu đề hợp lệ nhưng không có dòng dữ liệu nào để đối chiếu.');
  }

  return {
    rows: dataRows,
    warnings
  };
}
