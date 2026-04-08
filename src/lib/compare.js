import {
  FIELD_LABELS,
  HS_CODE_MAPPING_RULES,
  MATCH_THRESHOLD,
  MATCH_WEIGHTS,
  ROW_STATUS,
  STATUS_PRIORITY
} from '@/lib/constants';
import { stripDiacritics } from '@/lib/normalize';

const NEAR_MATCH_NAME_THRESHOLD = 0.9;

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
  const comparablePdfValue = field === 'itemName' ? normalizeNameForScore(pdfValue) : pdfNormalized;
  const comparableExcelValue = field === 'itemName' ? normalizeNameForScore(excelValue) : excelNormalized;

  let status = 'match';

  if (!pdfRow || !excelRow) {
    status = 'missing';
  } else if (fieldHasIssue(pdfRow, field) || fieldHasIssue(excelRow, field)) {
    status = 'error';
  } else if (comparablePdfValue !== comparableExcelValue) {
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

function buildReasonFromIssues(pdfRow, excelRow) {
  const messages = [...(pdfRow?.issues ?? []), ...(excelRow?.issues ?? [])]
    .map((issue) => issue.message)
    .filter(Boolean);

  return messages.join(' ');
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

function normalizeNameForScore(value) {
  return stripDiacritics(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function tokenize(value) {
  const normalized = normalizeNameForScore(value);
  return normalized ? normalized.split(' ') : [];
}

function levenshteinDistance(left, right) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost
      );
    }

    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function calculateNameSimilarity(left, right) {
  const normalizedLeft = normalizeNameForScore(left);
  const normalizedRight = normalizeNameForScore(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);
  const levenshteinScore = maxLength === 0 ? 0 : 1 - levenshteinDistance(normalizedLeft, normalizedRight) / maxLength;
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  const tokenSet = new Set(leftTokens);
  const intersectionSize = rightTokens.filter((token) => tokenSet.has(token)).length;
  const tokenScore =
    leftTokens.length + rightTokens.length === 0 ? 0 : (2 * intersectionSize) / (leftTokens.length + rightTokens.length);

  return Math.max(0, Math.min(1, levenshteinScore * 0.65 + tokenScore * 0.35));
}

function buildScoreBreakdown(excelRow, pdfRow, weights) {
  const itemNameSimilarity = calculateNameSimilarity(excelRow.normalized.itemName, pdfRow.normalized.itemName);
  const quantityMatch = Number(excelRow.normalized.quantity === pdfRow.normalized.quantity);
  const unitMatch = Number(excelRow.normalized.unit === pdfRow.normalized.unit);
  const itemNameScore = Number((itemNameSimilarity * weights.itemName).toFixed(2));
  const quantityScore = quantityMatch * weights.quantity;
  const unitScore = unitMatch * weights.unit;

  return {
    itemNameSimilarity,
    itemNameScore,
    quantityMatch: Boolean(quantityMatch),
    quantityScore,
    unitMatch: Boolean(unitMatch),
    unitScore,
    total: Number((itemNameScore + quantityScore + unitScore).toFixed(2))
  };
}

function buildResultRow({
  status,
  pdfRow,
  excelRow,
  reason,
  matchScore = null,
  matchBreakdown = null,
  matchedHsRule = null
}) {
  const fields = {
    hsCode: buildFieldResult('hsCode', pdfRow, excelRow),
    itemName: buildFieldResult('itemName', pdfRow, excelRow),
    unit: buildFieldResult('unit', pdfRow, excelRow),
    quantity: buildFieldResult('quantity', pdfRow, excelRow)
  };

  if (matchedHsRule && fields.hsCode.status === 'mismatch') {
    fields.hsCode = {
      ...fields.hsCode,
      status: 'rule-match',
      matched: true
    };
  }

  return {
    id: `${status}-${pdfRow?.rowNumber ?? 'x'}-${excelRow?.rowNumber ?? 'y'}-${pdfRow?.normalized?.itemName ?? excelRow?.normalized?.itemName ?? 'unknown'}`,
    hsCode: excelRow?.normalized?.hsCode || pdfRow?.normalized?.hsCode || '',
    status,
    reason,
    matchScore,
    matchBreakdown,
    matchedHsRule,
    pdf: buildRowReference(pdfRow),
    excel: buildRowReference(excelRow),
    fields
  };
}

function isMatchableRow(row) {
  return (row?.issues?.length ?? 0) === 0;
}

function getSequenceKey(row) {
  return row?.meta?.sequenceKey || '';
}

function buildSequenceGroups(rows) {
  const groups = new Map();
  const keyedRowIds = new Set();

  for (const row of rows) {
    const sequenceKey = getSequenceKey(row);

    if (!sequenceKey) {
      continue;
    }

    keyedRowIds.add(row.id);
    const group = groups.get(sequenceKey) ?? [];
    group.push(row);
    groups.set(sequenceKey, group);
  }

  return {
    groups,
    keyedRowIds
  };
}

function assignSequenceMatches(excelRows, pdfRows, config) {
  const excelIndex = buildSequenceGroups(excelRows);
  const pdfIndex = buildSequenceGroups(pdfRows);
  const matches = [];
  const usedExcelIds = new Set();
  const usedPdfIds = new Set();
  const sequenceKeys = new Set([...excelIndex.groups.keys(), ...pdfIndex.groups.keys()]);

  for (const sequenceKey of sequenceKeys) {
    const excelGroup = excelIndex.groups.get(sequenceKey) ?? [];
    const pdfGroup = pdfIndex.groups.get(sequenceKey) ?? [];

    if (excelGroup.length !== 1 || pdfGroup.length !== 1) {
      continue;
    }

    const excelRow = excelGroup[0];
    const pdfRow = pdfGroup[0];

    matches.push({
      excelRow,
      pdfRow,
      score: buildScoreBreakdown(excelRow, pdfRow, config.weights).total,
      breakdown: buildScoreBreakdown(excelRow, pdfRow, config.weights),
      matchedBy: 'sequence'
    });
    usedExcelIds.add(excelRow.id);
    usedPdfIds.add(pdfRow.id);
  }

  return {
    matches,
    usedExcelIds,
    usedPdfIds,
    keyedExcelIds: excelIndex.keyedRowIds,
    keyedPdfIds: pdfIndex.keyedRowIds
  };
}

function buildCandidateMatrix(excelRows, pdfRows, config) {
  const candidates = [];
  const nearCandidates = [];

  for (const excelRow of excelRows) {
    const candidatePool = pdfRows;

    for (const pdfRow of candidatePool) {
      const breakdown = buildScoreBreakdown(excelRow, pdfRow, config.weights);
      const candidate = {
        excelRow,
        pdfRow,
        score: breakdown.total,
        breakdown
      };

      if (candidate.score >= config.threshold) {
        candidates.push(candidate);
      } else if (
        breakdown.itemNameSimilarity >= NEAR_MATCH_NAME_THRESHOLD &&
        (breakdown.quantityMatch || breakdown.unitMatch)
      ) {
        nearCandidates.push(candidate);
      }
    }
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (right.breakdown.itemNameSimilarity !== left.breakdown.itemNameSimilarity) {
      return right.breakdown.itemNameSimilarity - left.breakdown.itemNameSimilarity;
    }

    const pdfDelta = (left.pdfRow.rowNumber ?? Number.MAX_SAFE_INTEGER) - (right.pdfRow.rowNumber ?? Number.MAX_SAFE_INTEGER);
    if (pdfDelta !== 0) {
      return pdfDelta;
    }

    return (left.excelRow.rowNumber ?? Number.MAX_SAFE_INTEGER) - (right.excelRow.rowNumber ?? Number.MAX_SAFE_INTEGER);
  });

  nearCandidates.sort((left, right) => {
    if (right.breakdown.itemNameSimilarity !== left.breakdown.itemNameSimilarity) {
      return right.breakdown.itemNameSimilarity - left.breakdown.itemNameSimilarity;
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const pdfDelta = (left.pdfRow.rowNumber ?? Number.MAX_SAFE_INTEGER) - (right.pdfRow.rowNumber ?? Number.MAX_SAFE_INTEGER);
    if (pdfDelta !== 0) {
      return pdfDelta;
    }

    return (left.excelRow.rowNumber ?? Number.MAX_SAFE_INTEGER) - (right.excelRow.rowNumber ?? Number.MAX_SAFE_INTEGER);
  });

  return {
    candidates,
    nearCandidates
  };
}

function assignMatches(candidates) {
  const usedExcelIds = new Set();
  const usedPdfIds = new Set();
  const matches = [];

  for (const candidate of candidates) {
    if (usedExcelIds.has(candidate.excelRow.id) || usedPdfIds.has(candidate.pdfRow.id)) {
      continue;
    }

    usedExcelIds.add(candidate.excelRow.id);
    usedPdfIds.add(candidate.pdfRow.id);
    matches.push(candidate);
  }

  return {
    matches,
    usedExcelIds,
    usedPdfIds
  };
}

function normalizeRuleSide(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function findHsRule(excelHsCode, pdfHsCode, rules) {
  if (!excelHsCode || !pdfHsCode || excelHsCode === pdfHsCode) {
    return null;
  }

  return (
    rules.find((rule) => {
      const fromExcel = normalizeRuleSide(rule?.excel);
      const fromPdf = normalizeRuleSide(rule?.pdf);
      return fromExcel === excelHsCode && fromPdf === pdfHsCode;
    }) ?? null
  );
}

function buildMissingReason(targetLabel, row) {
  return `Không tìm thấy dòng ${targetLabel} tương ứng cho "${row.raw.itemName}".`;
}

function buildMatchedRow(candidate, config) {
  const matchedHsRule = findHsRule(
    candidate.excelRow.normalized.hsCode,
    candidate.pdfRow.normalized.hsCode,
    config.hsCodeMappingRules
  );

  const resultRow = buildResultRow({
    status: ROW_STATUS.MATCH,
    pdfRow: candidate.pdfRow,
    excelRow: candidate.excelRow,
    reason: 'Dữ liệu khớp hoàn toàn.',
    matchScore: candidate.score,
    matchBreakdown: candidate.breakdown,
    matchedHsRule
  });

  const mismatchReason = buildMismatchReason(resultRow.fields);
  const hasMismatch = Object.values(resultRow.fields).some((field) => field.status === 'mismatch');

  if (hasMismatch) {
    resultRow.status = ROW_STATUS.MISMATCH;
    resultRow.reason = mismatchReason;
    return resultRow;
  }

  if (matchedHsRule) {
    resultRow.status = ROW_STATUS.MATCH_WITH_HS_RULE;
    resultRow.reason = matchedHsRule.description
      ? `Khớp theo rule HS hợp lệ: ${matchedHsRule.description}.`
      : `Khớp theo rule HS hợp lệ: Excel ${candidate.excelRow.raw.hsCode} -> PDF ${candidate.pdfRow.raw.hsCode}.`;
  }

  return resultRow;
}

function buildSummary(rows) {
  const summary = {
    totalRows: rows.length,
    matchCount: 0,
    matchWithHsRuleCount: 0,
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
      case ROW_STATUS.MATCH_WITH_HS_RULE:
        summary.matchWithHsRuleCount += 1;
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

function getStatusOrder(row) {
  return STATUS_PRIORITY[row.status] ?? Number.MAX_SAFE_INTEGER;
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
    const statusDelta = getStatusOrder(left) - getStatusOrder(right);

    if (statusDelta !== 0) {
      return statusDelta;
    }

    const pdfDelta = getPrimaryOrder(left) - getPrimaryOrder(right);

    if (pdfDelta !== 0) {
      return pdfDelta;
    }

    const excelDelta = getSecondaryOrder(left) - getSecondaryOrder(right);

    if (excelDelta !== 0) {
      return excelDelta;
    }

    return (left.fields.itemName.pdfNormalized || left.fields.itemName.excelNormalized || '').localeCompare(
      right.fields.itemName.pdfNormalized || right.fields.itemName.excelNormalized || '',
      'vi'
    );
  });
}

export function compareDeclarations(excelRows, pdfRows, options = {}) {
  const config = {
    threshold: options.threshold ?? MATCH_THRESHOLD,
    weights: options.weights ?? MATCH_WEIGHTS,
    hsCodeMappingRules: options.hsCodeMappingRules ?? HS_CODE_MAPPING_RULES
  };
  const rows = [];
  const validExcelRows = [];
  const validPdfRows = [];

  for (const pdfRow of pdfRows) {
    if (isMatchableRow(pdfRow)) {
      validPdfRows.push(pdfRow);
      continue;
    }

    rows.push(
      buildResultRow({
        status: ROW_STATUS.PARSE_ERROR,
        pdfRow,
        excelRow: null,
        reason: buildReasonFromIssues(pdfRow, null)
      })
    );
  }

  for (const excelRow of excelRows) {
    if (isMatchableRow(excelRow)) {
      validExcelRows.push(excelRow);
      continue;
    }

    rows.push(
      buildResultRow({
        status: ROW_STATUS.PARSE_ERROR,
        pdfRow: null,
        excelRow,
        reason: buildReasonFromIssues(null, excelRow)
      })
    );
  }

  const sequenceAssignment = assignSequenceMatches(validExcelRows, validPdfRows, config);

  for (const candidate of sequenceAssignment.matches) {
    rows.push(buildMatchedRow(candidate, config));
  }

  const fuzzyExcelRows = validExcelRows.filter(
    (row) => !sequenceAssignment.usedExcelIds.has(row.id) && !sequenceAssignment.keyedExcelIds.has(row.id)
  );
  const fuzzyPdfRows = validPdfRows.filter(
    (row) => !sequenceAssignment.usedPdfIds.has(row.id) && !sequenceAssignment.keyedPdfIds.has(row.id)
  );

  const { candidates, nearCandidates } = buildCandidateMatrix(fuzzyExcelRows, fuzzyPdfRows, config);
  const { matches, usedExcelIds, usedPdfIds } = assignMatches(candidates);
  const nearMatchAssignment = assignMatches(
    nearCandidates.filter(
      (candidate) => !usedExcelIds.has(candidate.excelRow.id) && !usedPdfIds.has(candidate.pdfRow.id)
    )
  );

  for (const candidate of matches) {
    rows.push(buildMatchedRow(candidate, config));
  }

  for (const candidate of nearMatchAssignment.matches) {
    usedExcelIds.add(candidate.excelRow.id);
    usedPdfIds.add(candidate.pdfRow.id);
    rows.push(buildMatchedRow(candidate, config));
  }

  for (const excelRow of validExcelRows) {
    if (sequenceAssignment.usedExcelIds.has(excelRow.id) || usedExcelIds.has(excelRow.id)) {
      continue;
    }

    rows.push(
      buildResultRow({
        status: ROW_STATUS.MISSING_IN_PDF,
        pdfRow: null,
        excelRow,
        reason: buildMissingReason('PDF', excelRow)
      })
    );
  }

  for (const pdfRow of validPdfRows) {
    if (sequenceAssignment.usedPdfIds.has(pdfRow.id) || usedPdfIds.has(pdfRow.id)) {
      continue;
    }

    rows.push(
      buildResultRow({
        status: ROW_STATUS.MISSING_IN_EXCEL,
        pdfRow,
        excelRow: null,
        reason: buildMissingReason('Excel', pdfRow)
      })
    );
  }

  const sortedRows = sortRows(rows);

  return {
    rows: sortedRows,
    summary: buildSummary(sortedRows)
  };
}
