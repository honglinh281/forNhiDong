import {
  ENGLISH_CHECK_STATUS,
  ENGLISH_CHECK_STATUS_PRIORITY
} from '@/lib/english-checker/constants';
import { findGlossaryHints } from '@/lib/english-checker/domain/glossary';
import { normalizeSearchText, normalizeVietnamese } from '@/lib/english-checker/normalization/normalize-vietnamese';
import { splitVietnameseClauses } from '@/lib/english-checker/normalization/split-clauses';
import type {
  AuditRequestItem,
  FinalAuditResult,
  ProductRow
} from '@/lib/english-checker/types';

export function normalizeEnglishCheckText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function createEnglishCheckKey(row: ProductRow): string {
  return [
    row.productNameVi,
    row.productNameEn,
    row.checkInfo,
    row.customerFeedback
  ].map(normalizeEnglishCheckText).join('::');
}

export function createAuditRequestItem(row: ProductRow): AuditRequestItem {
  const originalVietnamese = String(row.productNameVi ?? '').trim();
  const normalizedVietnamese = normalizeVietnamese(originalVietnamese);

  return {
    rowId: row.rowId,
    originalVietnamese,
    normalizedVietnamese,
    currentEnglish: String(row.productNameEn ?? '').trim(),
    clauses: splitVietnameseClauses(originalVietnamese),
    secondaryContext: {
      checkInfo: String(row.checkInfo ?? '').trim(),
      customerFeedback: String(row.customerFeedback ?? '').trim()
    },
    glossaryHints: findGlossaryHints(originalVietnamese)
  };
}

export type PreparedEnglishChecks = {
  deterministicResults: FinalAuditResult[];
  uniqueRows: ProductRow[];
  requestItemsByRowId: Map<string, AuditRequestItem>;
  groupsByUniqueRowId: Map<string, ProductRow[]>;
};

export function prepareEnglishChecks(rows: ProductRow[]): PreparedEnglishChecks {
  const deterministicResults: FinalAuditResult[] = [];
  const uniqueByKey = new Map<string, ProductRow>();
  const requestItemsByRowId = new Map<string, AuditRequestItem>();
  const groupsByUniqueRowId = new Map<string, ProductRow[]>();

  for (const row of rows) {
    if (!normalizeSearchText(row.productNameVi)) {
      deterministicResults.push({
        rowId: row.rowId,
        status: ENGLISH_CHECK_STATUS.MISSING,
        reason: 'Thiếu "Tên hàng hóa XNK".',
        suggestedName: '',
        riskScore: 0
      });
      continue;
    }

    const key = createEnglishCheckKey(row);
    let uniqueRow = uniqueByKey.get(key);

    if (!uniqueRow) {
      uniqueRow = { ...row, rowId: `unique-audit-${uniqueByKey.size + 1}` };
      uniqueByKey.set(key, uniqueRow);
      groupsByUniqueRowId.set(uniqueRow.rowId, []);
      requestItemsByRowId.set(uniqueRow.rowId, createAuditRequestItem(uniqueRow));
    }

    groupsByUniqueRowId.get(uniqueRow.rowId)?.push(row);
  }

  return {
    deterministicResults,
    uniqueRows: [...uniqueByKey.values()],
    requestItemsByRowId,
    groupsByUniqueRowId
  };
}

function copyResultToOriginal(result: FinalAuditResult, original: ProductRow): FinalAuditResult {
  return {
    ...result,
    rowId: original.rowId,
    reason: String(result.reason ?? ''),
    suggestedName: String(result.suggestedName ?? '')
  };
}

export function expandPartialEnglishCheckResults(
  prepared: PreparedEnglishChecks,
  uniqueResults: FinalAuditResult[]
): FinalAuditResult[] {
  const results = [...prepared.deterministicResults];

  for (const result of uniqueResults) {
    const originals = prepared.groupsByUniqueRowId.get(result.rowId);
    if (!originals) throw new Error(`Kết quả trả về rowId không hợp lệ: ${result.rowId}.`);
    results.push(...originals.map((row) => copyResultToOriginal(result, row)));
  }

  return results;
}

export function expandEnglishCheckResults(
  rows: ProductRow[],
  prepared: PreparedEnglishChecks,
  uniqueResults: FinalAuditResult[]
): Array<ProductRow & FinalAuditResult> {
  const partial = expandPartialEnglishCheckResults(prepared, uniqueResults);
  const resultByRowId = new Map(partial.map((result) => [result.rowId, result]));
  const missing = rows.find((row) => !resultByRowId.has(row.rowId));
  if (missing) throw new Error(`Thiếu kết quả kiểm tra cho dòng ${missing.rowId}.`);
  return rows.map((row) => ({ ...row, ...resultByRowId.get(row.rowId)! }));
}

export function mergeRowsWithPartialResults(
  rows: ProductRow[],
  results: FinalAuditResult[]
): Array<ProductRow & FinalAuditResult> {
  const byId = new Map(results.map((result) => [result.rowId, result]));
  return rows
    .filter((row) => byId.has(row.rowId))
    .map((row) => ({ ...row, ...byId.get(row.rowId)! }));
}

export function summarizeEnglishCheckResults(results: FinalAuditResult[]) {
  const summary = { total: results.length, ok: 0, close: 0, wrong: 0, missing: 0 };
  for (const result of results) {
    if (result.status === ENGLISH_CHECK_STATUS.OK) summary.ok += 1;
    if (result.status === ENGLISH_CHECK_STATUS.CLOSE) summary.close += 1;
    if (result.status === ENGLISH_CHECK_STATUS.WRONG) summary.wrong += 1;
    if (result.status === ENGLISH_CHECK_STATUS.MISSING) summary.missing += 1;
  }
  return summary;
}

export function sortEnglishCheckResults<T extends ProductRow & FinalAuditResult>(results: T[]): T[] {
  return [...results].sort((left, right) => {
    const statusDifference =
      ENGLISH_CHECK_STATUS_PRIORITY[left.status] - ENGLISH_CHECK_STATUS_PRIORITY[right.status];
    if (statusDifference !== 0) return statusDifference;
    const sheetDifference = left.sheet.localeCompare(right.sheet, 'vi');
    return sheetDifference || left.excelRow - right.excelRow;
  });
}
