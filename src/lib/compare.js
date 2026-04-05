import { FIELD_LABELS, ROW_STATUS } from '@/lib/constants';

function buildRowReference(row) {
  return row
    ? {
        rowNumber: row.rowNumber,
        issues: row.issues,
        meta: row.meta
      }
    : null;
}

function fieldHasIssue(row, field) {
  return Boolean(row?.issues?.some((issue) => issue.field === field));
}

function buildFieldResult(field, pdfRow, excelRow) {
  const pdfValue = pdfRow?.raw?.[field] ?? '';
  const excelValue = excelRow?.raw?.[field] ?? '';
  const pdfNormalized = pdfRow?.normalized?.[field] ?? '';
  const excelNormalized = excelRow?.normalized?.[field] ?? '';

  let status = 'match';

  if (!pdfRow || !excelRow) {
    status = 'missing';
  } else if (fieldHasIssue(pdfRow, field) || fieldHasIssue(excelRow, field)) {
    status = 'error';
  } else if (pdfNormalized !== excelNormalized) {
    status = 'mismatch';
  }

  return {
    field,
    label: FIELD_LABELS[field],
    pdfValue,
    excelValue,
    pdfNormalized,
    excelNormalized,
    status,
    matched: status === 'match'
  };
}

function indexRows(rows) {
  const byHsCode = new Map();
  const orphanRows = [];

  for (const row of rows) {
    if (!row.normalized.hsCode) {
      orphanRows.push(row);
      continue;
    }

    const group = byHsCode.get(row.normalized.hsCode) ?? [];
    group.push(row);
    byHsCode.set(row.normalized.hsCode, group);
  }

  return {
    byHsCode,
    orphanRows
  };
}

function buildReasonFromIssues(pdfRow, excelRow) {
  const messages = [...(pdfRow?.issues ?? []), ...(excelRow?.issues ?? [])]
    .map((issue) => issue.message)
    .filter(Boolean);

  return messages.join(' ');
}

function buildResultRow({ status, hsCode, pdfRow, excelRow, reason, duplicateCounts = null }) {
  return {
    id: `${status}-${hsCode || 'unknown'}-${pdfRow?.rowNumber ?? 'x'}-${excelRow?.rowNumber ?? 'y'}`,
    hsCode,
    status,
    reason,
    duplicateCounts,
    pdf: buildRowReference(pdfRow),
    excel: buildRowReference(excelRow),
    fields: {
      itemName: buildFieldResult('itemName', pdfRow, excelRow),
      unit: buildFieldResult('unit', pdfRow, excelRow),
      quantity: buildFieldResult('quantity', pdfRow, excelRow)
    }
  };
}

function buildMismatchReason(fields) {
  const mismatches = Object.values(fields)
    .filter((field) => field.status === 'mismatch')
    .map((field) => field.label);

  if (mismatches.length === 0) {
    return 'Không có sai lệch trường dữ liệu.';
  }

  return `Sai lệch tại: ${mismatches.join(', ')}.`;
}

function buildSummary(rows) {
  const summary = {
    totalRows: rows.length,
    matchCount: 0,
    mismatchCount: 0,
    missingInExcelCount: 0,
    missingInPdfCount: 0,
    duplicateCount: 0,
    parseErrorCount: 0,
    errorCount: 0
  };

  for (const row of rows) {
    switch (row.status) {
      case ROW_STATUS.MATCH:
        summary.matchCount += 1;
        break;
      case ROW_STATUS.MISMATCH:
        summary.mismatchCount += 1;
        summary.errorCount += 1;
        break;
      case ROW_STATUS.MISSING_IN_EXCEL:
        summary.missingInExcelCount += 1;
        summary.errorCount += 1;
        break;
      case ROW_STATUS.MISSING_IN_PDF:
        summary.missingInPdfCount += 1;
        summary.errorCount += 1;
        break;
      case ROW_STATUS.DUPLICATE_HSCODE:
        summary.duplicateCount += 1;
        summary.errorCount += 1;
        break;
      case ROW_STATUS.PARSE_ERROR:
        summary.parseErrorCount += 1;
        summary.errorCount += 1;
        break;
      default:
        break;
    }
  }

  return summary;
}

function getPrimaryOrder(row) {
  if (Number.isInteger(row.pdf?.rowNumber)) {
    return row.pdf.rowNumber;
  }

  return Number.MAX_SAFE_INTEGER;
}

function getSecondaryOrder(row) {
  if (Number.isInteger(row.excel?.rowNumber)) {
    return row.excel.rowNumber;
  }

  return Number.MAX_SAFE_INTEGER;
}

function sortRows(rows) {
  return [...rows].sort((left, right) => {
    const pdfDelta = getPrimaryOrder(left) - getPrimaryOrder(right);

    if (pdfDelta !== 0) {
      return pdfDelta;
    }

    const excelDelta = getSecondaryOrder(left) - getSecondaryOrder(right);

    if (excelDelta !== 0) {
      return excelDelta;
    }

    return (left.hsCode || '').localeCompare(right.hsCode || '', 'vi');
  });
}

export function compareDeclarations(excelRows, pdfRows) {
  const excelIndex = indexRows(excelRows);
  const pdfIndex = indexRows(pdfRows);
  const rows = [];

  for (const orphanRow of pdfIndex.orphanRows) {
    rows.push(
      buildResultRow({
        status: ROW_STATUS.PARSE_ERROR,
        hsCode: '',
        pdfRow: orphanRow,
        excelRow: null,
        reason: buildReasonFromIssues(orphanRow, null)
      })
    );
  }

  for (const orphanRow of excelIndex.orphanRows) {
    rows.push(
      buildResultRow({
        status: ROW_STATUS.PARSE_ERROR,
        hsCode: '',
        pdfRow: null,
        excelRow: orphanRow,
        reason: buildReasonFromIssues(null, orphanRow)
      })
    );
  }

  const hsCodes = new Set([...excelIndex.byHsCode.keys(), ...pdfIndex.byHsCode.keys()]);

  for (const hsCode of hsCodes) {
    const excelGroup = excelIndex.byHsCode.get(hsCode) ?? [];
    const pdfGroup = pdfIndex.byHsCode.get(hsCode) ?? [];

    if (excelGroup.length > 1 || pdfGroup.length > 1) {
      rows.push(
        buildResultRow({
          status: ROW_STATUS.DUPLICATE_HSCODE,
          hsCode,
          pdfRow: pdfGroup[0] ?? null,
          excelRow: excelGroup[0] ?? null,
          reason: `HS code ${hsCode} bị trùng: PDF ${pdfGroup.length} dòng, Excel ${excelGroup.length} dòng.`,
          duplicateCounts: {
            pdf: pdfGroup.length,
            excel: excelGroup.length
          }
        })
      );
      continue;
    }

    const excelRow = excelGroup[0] ?? null;
    const pdfRow = pdfGroup[0] ?? null;

    if (!excelRow) {
      rows.push(
        buildResultRow({
          status: ROW_STATUS.MISSING_IN_EXCEL,
          hsCode,
          pdfRow,
          excelRow: null,
          reason: `HS code ${hsCode} có trong PDF nhưng không thấy trong Excel.`
        })
      );
      continue;
    }

    if (!pdfRow) {
      rows.push(
        buildResultRow({
          status: ROW_STATUS.MISSING_IN_PDF,
          hsCode,
          pdfRow: null,
          excelRow,
          reason: `HS code ${hsCode} có trong Excel nhưng không thấy trong PDF.`
        })
      );
      continue;
    }

    if (pdfRow.issues.length > 0 || excelRow.issues.length > 0) {
      rows.push(
        buildResultRow({
          status: ROW_STATUS.PARSE_ERROR,
          hsCode,
          pdfRow,
          excelRow,
          reason: buildReasonFromIssues(pdfRow, excelRow)
        })
      );
      continue;
    }

    const resultRow = buildResultRow({
      status: ROW_STATUS.MATCH,
      hsCode,
      pdfRow,
      excelRow,
      reason: 'Dữ liệu khớp hoàn toàn.'
    });

    const hasMismatch = Object.values(resultRow.fields).some((field) => field.status === 'mismatch');

    if (hasMismatch) {
      resultRow.status = ROW_STATUS.MISMATCH;
      resultRow.reason = buildMismatchReason(resultRow.fields);
    }

    rows.push(resultRow);
  }

  const sortedRows = sortRows(rows);

  return {
    rows: sortedRows,
    summary: buildSummary(sortedRows)
  };
}
