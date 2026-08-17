import { finalizeAuditResult } from '@/lib/english-checker/audit/status-mapper';
import {
  AUDIT_BATCH_SIZE,
  AUDIT_CONCURRENCY,
  AUDIT_MAX_ATTEMPTS
} from '@/lib/english-checker/constants';
import type {
  AiMicroAuditItem,
  AuditProgressSnapshot,
  AuditRequestItem,
  FinalAuditResult,
  ProductRow,
  RowJob
} from '@/lib/english-checker/types';

type QueueInput = {
  row: ProductRow;
  requestItem: AuditRequestItem;
  weight?: number;
};

type QueueOutcome = {
  results: FinalAuditResult[];
  failedRowIds: string[];
  cancelled: boolean;
};

type QueueOptions = {
  batchSize?: number;
  concurrency?: number;
  maxAttempts?: number;
  initialCompleted?: number;
  request: (items: AuditRequestItem[], signal: AbortSignal) => Promise<AiMicroAuditItem[]>;
  onProgress?: (snapshot: AuditProgressSnapshot) => void;
  onResult?: (result: FinalAuditResult) => void;
  backoffMs?: (attempt: number) => number;
};

function splitIntoBatches<T>(values: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) batches.push(values.slice(index, index + size));
  return batches;
}

function splitBatch<T>(batch: T[]): [T[], T[]] {
  const middle = Math.ceil(batch.length / 2);
  return [batch.slice(0, middle), batch.slice(middle)];
}

function readError(error: unknown): { code: string; retryable: boolean } {
  if (typeof error === 'object' && error) {
    return {
      code: 'code' in error && typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR',
      retryable: !('retryable' in error) || error.retryable !== false
    };
  }
  return { code: 'UNKNOWN_ERROR', retryable: true };
}

export class AuditQueue {
  private readonly jobs = new Map<string, RowJob>();
  private readonly request: QueueOptions['request'];
  private readonly onProgress?: QueueOptions['onProgress'];
  private readonly onResult?: QueueOptions['onResult'];
  private readonly batchSize: number;
  private readonly concurrency: number;
  private readonly maxAttempts: number;
  private readonly initialCompleted: number;
  private readonly backoffMs: (attempt: number) => number;
  private pendingBatches: RowJob[][];
  private activeRequests = 0;
  private scheduledRetries = 0;
  private retryTimers = new Set<ReturnType<typeof setTimeout>>();
  private paused = false;
  private cancelled = false;
  private running = false;
  private abortController = new AbortController();
  private resolveRun?: (outcome: QueueOutcome) => void;
  private runPromise?: Promise<QueueOutcome>;

  constructor(inputs: QueueInput[], options: QueueOptions) {
    this.request = options.request;
    this.onProgress = options.onProgress;
    this.onResult = options.onResult;
    this.batchSize = Math.min(5, Math.max(1, options.batchSize ?? AUDIT_BATCH_SIZE));
    this.concurrency = Math.max(1, options.concurrency ?? AUDIT_CONCURRENCY);
    this.maxAttempts = Math.max(1, options.maxAttempts ?? AUDIT_MAX_ATTEMPTS);
    this.initialCompleted = options.initialCompleted ?? 0;
    this.backoffMs = options.backoffMs ?? ((attempt) => {
      const base = [1_500, 4_000, 8_000][Math.min(attempt - 1, 2)];
      return base + Math.floor(Math.random() * 350);
    });

    for (const input of inputs) {
      this.jobs.set(input.row.rowId, {
        row: input.row,
        requestItem: input.requestItem,
        state: 'pending',
        attempts: 0,
        weight: input.weight ?? 1
      });
    }
    this.pendingBatches = splitIntoBatches([...this.jobs.values()], this.batchSize);
  }

  start(): Promise<QueueOutcome> {
    if (this.running && this.runPromise) return this.runPromise;
    this.running = true;
    this.cancelled = false;
    this.abortController = new AbortController();
    this.runPromise = new Promise((resolve) => { this.resolveRun = resolve; });
    this.emitProgress();
    this.pump();
    return this.runPromise;
  }

  pause(): void {
    this.paused = true;
    this.emitProgress();
  }

  resume(): void {
    if (!this.running) return;
    this.paused = false;
    this.emitProgress();
    this.pump();
  }

  cancel(): void {
    if (!this.running) return;
    this.cancelled = true;
    this.paused = false;
    this.abortController.abort();
    for (const timer of this.retryTimers) clearTimeout(timer);
    this.retryTimers.clear();
    this.scheduledRetries = 0;
    this.pendingBatches = [];
    this.emitProgress();
    this.finishIfDone();
  }

  retryFailed(): Promise<QueueOutcome> {
    if (this.running) return this.runPromise!;
    const failed = [...this.jobs.values()].filter((job) => job.state === 'failed');
    for (const job of failed) {
      job.state = 'pending';
      job.attempts = 0;
      delete job.errorCode;
    }
    this.pendingBatches = splitIntoBatches(failed, this.batchSize);
    return this.start();
  }

  getSnapshot(): AuditProgressSnapshot {
    const counts = { completed: this.initialCompleted, processing: 0, pending: 0, retrying: 0, failed: 0 };
    let total = this.initialCompleted;
    for (const job of this.jobs.values()) {
      total += job.weight;
      counts[job.state] += job.weight;
    }
    return {
      total,
      ...counts,
      resolved: counts.completed + counts.failed,
      paused: this.paused
    };
  }

  private pump(): void {
    if (!this.running || this.cancelled || this.paused) return;
    while (this.activeRequests < this.concurrency && this.pendingBatches.length) {
      const batch = this.pendingBatches.shift()!;
      this.launchBatch(batch);
    }
    this.finishIfDone();
  }

  private launchBatch(batch: RowJob[]): void {
    this.activeRequests += 1;
    for (const job of batch) {
      job.state = 'processing';
      job.attempts += 1;
    }
    this.emitProgress();

    this.request(batch.map((job) => job.requestItem), this.abortController.signal)
      .then((audits) => this.completeBatch(batch, audits))
      .catch((error) => this.failBatch(batch, error))
      .finally(() => {
        this.activeRequests -= 1;
        this.emitProgress();
        this.pump();
        this.finishIfDone();
      });
  }

  private completeBatch(batch: RowJob[], audits: AiMicroAuditItem[]): void {
    const byRowId = new Map(audits.map((audit) => [audit.rowId, audit]));
    for (const job of batch) {
      const audit = byRowId.get(job.row.rowId);
      if (!audit) {
        this.failBatch(batch, { code: 'INCOMPLETE_CLAUSE_COVERAGE', retryable: true });
        return;
      }
    }
    for (const job of batch) {
      const result = finalizeAuditResult(job.row, job.requestItem, byRowId.get(job.row.rowId)!);
      job.finalResult = result;
      job.state = 'completed';
      delete job.errorCode;
      this.onResult?.(result);
    }
  }

  private failBatch(batch: RowJob[], error: unknown): void {
    if (batch.every((job) => job.state === 'completed')) return;
    const { code, retryable } = readError(error);

    if (this.cancelled || code === 'CANCELLED') {
      for (const job of batch) if (job.state !== 'completed') job.state = 'pending';
      return;
    }

    if (code === 'AUDIT_TIMEOUT' && batch.length > 1) {
      const [left, right] = splitBatch(batch);
      for (const job of batch) job.state = 'pending';
      if (right.length) this.pendingBatches.unshift(right);
      if (left.length) this.pendingBatches.unshift(left);
      return;
    }

    const canRetry = retryable && batch.every((job) => job.attempts < this.maxAttempts);
    if (canRetry) {
      for (const job of batch) {
        job.state = 'retrying';
        job.errorCode = code;
      }
      this.scheduledRetries += 1;
      const timer = setTimeout(() => {
        this.retryTimers.delete(timer);
        this.scheduledRetries -= 1;
        if (!this.cancelled) {
          for (const job of batch) job.state = 'pending';
          this.pendingBatches.unshift(batch);
        }
        this.emitProgress();
        this.pump();
        this.finishIfDone();
      }, this.backoffMs(Math.max(...batch.map((job) => job.attempts))));
      this.retryTimers.add(timer);
      return;
    }

    for (const job of batch) {
      job.state = 'failed';
      job.errorCode = code;
    }
  }

  private finishIfDone(): void {
    if (!this.running || this.activeRequests || this.pendingBatches.length || this.scheduledRetries) return;
    this.running = false;
    const outcome = {
      results: [...this.jobs.values()].flatMap((job) => job.finalResult ? [job.finalResult] : []),
      failedRowIds: [...this.jobs.values()].filter((job) => job.state === 'failed').map((job) => job.row.rowId),
      cancelled: this.cancelled
    };
    this.resolveRun?.(outcome);
    this.resolveRun = undefined;
  }

  private emitProgress(): void {
    this.onProgress?.(this.getSnapshot());
  }
}

export { splitBatch, splitIntoBatches };
