import {
  auditErrorResponseSchema,
  auditResponseSchema
} from '@/lib/english-checker/audit/schemas';
import { validateMicroAuditItems } from '@/lib/english-checker/audit/validate-clause-coverage';
import { AUDIT_CLIENT_TIMEOUT_MS } from '@/lib/english-checker/constants';
import type { AiMicroAuditItem, AuditRequestItem } from '@/lib/english-checker/types';

export class AuditRequestError extends Error {
  code: string;
  retryable: boolean;
  status?: number;

  constructor(code: string, message: string, retryable: boolean, status?: number) {
    super(message);
    this.name = 'AuditRequestError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function requestAuditBatch(
  items: AuditRequestItem[],
  signal?: AbortSignal
): Promise<AiMicroAuditItem[]> {
  const requestId = createRequestId();
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abortFromParent, { once: true });
  const timer = setTimeout(() => controller.abort(), AUDIT_CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, items }),
      signal: controller.signal
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const parsedError = auditErrorResponseSchema.safeParse(payload);
      if (parsedError.success) {
        throw new AuditRequestError(
          parsedError.data.error.code,
          parsedError.data.error.message,
          parsedError.data.error.retryable,
          response.status
        );
      }
      throw new AuditRequestError(
        response.status === 504 ? 'AUDIT_TIMEOUT' : 'UPSTREAM_ERROR',
        response.status === 504
          ? 'Audit did not finish within the soft timeout.'
          : 'Không thể gọi dịch vụ micro-audit.',
        response.status !== 400,
        response.status
      );
    }

    const parsed = auditResponseSchema.safeParse(payload);
    if (!parsed.success || parsed.data.requestId !== requestId) {
      throw new AuditRequestError('INVALID_AI_SCHEMA', 'API trả dữ liệu audit không hợp lệ.', true);
    }
    validateMicroAuditItems(items, parsed.data.items);
    return parsed.data.items;
  } catch (error) {
    if (error instanceof AuditRequestError) throw error;
    if (typeof error === 'object' && error && 'code' in error && typeof error.code === 'string') {
      throw new AuditRequestError(
        error.code,
        error instanceof Error ? error.message : 'Audit response không đầy đủ.',
        !('retryable' in error) || error.retryable !== false
      );
    }
    if (signal?.aborted) throw new AuditRequestError('CANCELLED', 'Đã hủy kiểm tra.', false);
    if (controller.signal.aborted) {
      throw new AuditRequestError('AUDIT_TIMEOUT', 'Audit did not finish within the client timeout.', true);
    }
    throw new AuditRequestError('UPSTREAM_ERROR', 'Không thể kết nối dịch vụ micro-audit.', true);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromParent);
  }
}
