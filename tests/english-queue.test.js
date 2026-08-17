import { createAuditRequestItem } from '@/lib/english-checker/processing';
import { AuditQueue } from '@/lib/english-checker/queue/audit-queue';

function row(index) {
  return {
    rowId: `row-${index}`,
    sheet: 'Data',
    excelRow: index + 1,
    stt: index,
    productNameVi: `Ốp điện thoại loại ${index}`,
    productNameEn: `Phone case type ${index}`,
    checkInfo: '',
    customerFeedback: ''
  };
}

function audit(item) {
  return {
    rowId: item.rowId,
    canonicalEnglishName: item.currentEnglish,
    productIdentity: {
      vietnamese: item.originalVietnamese,
      english: item.currentEnglish,
      relation: 'equivalent'
    },
    clauseAudits: item.clauses.map((inputClause) => ({
      clauseId: inputClause.id,
      clauseText: inputClause.text,
      clauseType: inputClause.preTypeHint === 'unknown' ? 'other' : inputClause.preTypeHint,
      normalizedFact: inputClause.text,
      identityDefining: inputClause.id === 'C1',
      evidenceImportance: inputClause.id === 'C1' ? 'critical' : 'supporting',
      englishCoverage: 'semantic_equivalent',
      englishEvidence: item.currentEnglish,
      note: null
    })),
    englishClaims: [],
    unresolvedCriticalFacts: [],
    overallConfidence: 0.96
  };
}

function inputs(count) {
  return Array.from({ length: count }, (_, index) => {
    const source = row(index + 1);
    return { row: source, requestItem: createAuditRequestItem(source), weight: 1 };
  });
}

describe('browser-owned AuditQueue', () => {
  it('splits a timed-out batch and retains successful results', async () => {
    const calls = [];
    const request = vi.fn(async (items) => {
      calls.push(items.map((item) => item.rowId));
      if (items.length === 3) throw { code: 'AUDIT_TIMEOUT', retryable: true };
      return items.map(audit);
    });
    const queue = new AuditQueue(inputs(3), {
      request,
      batchSize: 3,
      concurrency: 1,
      backoffMs: () => 0
    });
    const outcome = await queue.start();

    expect(calls).toEqual([
      ['row-1', 'row-2', 'row-3'],
      ['row-1', 'row-2'],
      ['row-3']
    ]);
    expect(outcome.results).toHaveLength(3);
    expect(outcome.failedRowIds).toEqual([]);
  });

  it('retries rate limits without discarding completed rows', async () => {
    const attempts = new Map();
    const request = vi.fn(async (items) => {
      const id = items[0].rowId;
      attempts.set(id, (attempts.get(id) ?? 0) + 1);
      if (id === 'row-2') throw { code: 'UPSTREAM_ERROR', retryable: false };
      if (id === 'row-1' && attempts.get(id) === 1) {
        throw { code: 'UPSTREAM_RATE_LIMIT', retryable: true };
      }
      return items.map(audit);
    });
    const queue = new AuditQueue(inputs(3), {
      request,
      batchSize: 1,
      concurrency: 2,
      maxAttempts: 3,
      backoffMs: () => 0
    });
    const outcome = await queue.start();

    expect(outcome.results.map((result) => result.rowId).sort()).toEqual(['row-1', 'row-3']);
    expect(outcome.failedRowIds).toEqual(['row-2']);
    expect(attempts.get('row-1')).toBe(2);
  });

  it('supports pause and resume without losing pending jobs', async () => {
    let release;
    const first = new Promise((resolve) => { release = resolve; });
    let call = 0;
    const request = vi.fn(async (items) => {
      call += 1;
      if (call === 1) await first;
      return items.map(audit);
    });
    const queue = new AuditQueue(inputs(2), {
      request,
      batchSize: 1,
      concurrency: 1,
      backoffMs: () => 0
    });
    const running = queue.start();
    queue.pause();
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    expect(queue.getSnapshot().paused).toBe(true);
    queue.resume();
    expect((await running).results).toHaveLength(2);
  });
});
