import { ENGLISH_CHECK_STATUS, ENGLISH_CHECK_STATUS_PRIORITY } from '@/lib/english-checker/constants';

export function normalizeEnglishCheckText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function createEnglishCheckKey(productNameVi, productNameEn, checkInfo, customerFeedback) {
  return [productNameVi, productNameEn, checkInfo, customerFeedback]
    .map(normalizeEnglishCheckText)
    .join('::');
}

export function prepareEnglishChecks(rows) {
  const deterministicResults = [];
  const uniqueByKey = new Map();
  const groupsByUniqueRowId = new Map();

  for (const row of rows) {
    if (!normalizeEnglishCheckText(row.productNameVi)) {
      deterministicResults.push({
        rowId: row.rowId,
        status: ENGLISH_CHECK_STATUS.MISSING,
        reason: 'Thiếu "Tên hàng hóa XNK".',
        suggestedName: ''
      });
      continue;
    }

    const key = createEnglishCheckKey(
      row.productNameVi,
      row.productNameEn,
      row.checkInfo,
      row.customerFeedback
    );
    let uniqueRow = uniqueByKey.get(key);

    if (!uniqueRow) {
      uniqueRow = {
        ...row,
        rowId: `unique-check-${uniqueByKey.size + 1}`
      };
      uniqueByKey.set(key, uniqueRow);
      groupsByUniqueRowId.set(uniqueRow.rowId, []);
    }

    groupsByUniqueRowId.get(uniqueRow.rowId).push(row);
  }

  return {
    deterministicResults,
    uniqueRows: [...uniqueByKey.values()],
    groupsByUniqueRowId
  };
}

function normalizeModelResult(result, originalRow) {
  if (!normalizeEnglishCheckText(originalRow.productNameEn)) {
    return {
      rowId: originalRow.rowId,
      status: ENGLISH_CHECK_STATUS.MISSING,
      reason: 'Thiếu "Tên TA".',
      suggestedName: result.suggestedName || ''
    };
  }

  if (result.status === ENGLISH_CHECK_STATUS.OK) {
    return {
      rowId: originalRow.rowId,
      status: ENGLISH_CHECK_STATUS.OK,
      reason: '',
      suggestedName: ''
    };
  }

  return {
    rowId: originalRow.rowId,
    status: result.status,
    reason: result.reason || 'Tên tiếng Anh cần được kiểm tra lại.',
    suggestedName: result.suggestedName || ''
  };
}

export function expandEnglishCheckResults(rows, prepared, uniqueResults) {
  const resultByRowId = new Map(prepared.deterministicResults.map((result) => [result.rowId, result]));

  for (const result of uniqueResults) {
    const originals = prepared.groupsByUniqueRowId.get(result.rowId);

    if (!originals) {
      throw new Error(`AI trả về rowId không hợp lệ: ${result.rowId}.`);
    }

    for (const originalRow of originals) {
      resultByRowId.set(originalRow.rowId, normalizeModelResult(result, originalRow));
    }
  }

  const missingResult = rows.find((row) => !resultByRowId.has(row.rowId));

  if (missingResult) {
    throw new Error(`Thiếu kết quả kiểm tra cho dòng ${missingResult.rowId}.`);
  }

  return rows.map((row) => ({ ...row, ...resultByRowId.get(row.rowId) }));
}

export function summarizeEnglishCheckResults(results) {
  const summary = {
    total: results.length,
    ok: 0,
    close: 0,
    wrong: 0,
    missing: 0
  };

  for (const result of results) {
    if (result.status === ENGLISH_CHECK_STATUS.OK) summary.ok += 1;
    if (result.status === ENGLISH_CHECK_STATUS.CLOSE) summary.close += 1;
    if (result.status === ENGLISH_CHECK_STATUS.WRONG) summary.wrong += 1;
    if (result.status === ENGLISH_CHECK_STATUS.MISSING) summary.missing += 1;
  }

  return summary;
}

export function sortEnglishCheckResults(results) {
  return [...results].sort((left, right) => {
    const statusDifference = ENGLISH_CHECK_STATUS_PRIORITY[left.status] - ENGLISH_CHECK_STATUS_PRIORITY[right.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    const sheetDifference = left.sheet.localeCompare(right.sheet, 'vi');
    return sheetDifference || left.excelRow - right.excelRow;
  });
}
