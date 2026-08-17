import type { AiMicroAuditItem, AuditRequestItem, InputClause } from '@/lib/english-checker/types';

export class IncompleteAuditError extends Error {
  code = 'INCOMPLETE_CLAUSE_COVERAGE' as const;
  retryable = true;

  constructor(message = 'AI chưa trả đủ kết quả cho mọi clauseId.') {
    super(message);
    this.name = 'IncompleteAuditError';
  }
}

export function validateClauseCoverage(inputClauses: InputClause[], audit: AiMicroAuditItem): void {
  const inputIds = new Set(inputClauses.map((clause) => clause.id));
  const outputIds = new Set(audit.clauseAudits.map((clause) => clause.clauseId));

  if (
    inputIds.size !== inputClauses.length ||
    outputIds.size !== audit.clauseAudits.length ||
    inputIds.size !== outputIds.size
  ) {
    throw new IncompleteAuditError();
  }

  for (const id of inputIds) {
    if (!outputIds.has(id)) throw new IncompleteAuditError(`AI bỏ sót clauseId ${id}.`);
  }
}

export function validateMicroAuditItems(
  inputs: AuditRequestItem[],
  audits: AiMicroAuditItem[]
): void {
  const inputByRowId = new Map(inputs.map((item) => [item.rowId, item]));
  const outputIds = new Set<string>();

  if (inputByRowId.size !== inputs.length || audits.length !== inputs.length) {
    throw new IncompleteAuditError('Số audit item không khớp request.');
  }

  for (const audit of audits) {
    if (outputIds.has(audit.rowId)) throw new IncompleteAuditError(`rowId ${audit.rowId} bị lặp.`);
    outputIds.add(audit.rowId);
    const input = inputByRowId.get(audit.rowId);
    if (!input) throw new IncompleteAuditError(`AI trả rowId không hợp lệ: ${audit.rowId}.`);
    validateClauseCoverage(input.clauses, audit);
  }
}
