import { NextResponse } from 'next/server';

import { runMicroAudit, AuditTimeoutError, InvalidAiSchemaError } from '@/lib/english-checker/ai/run-micro-audit';
import { auditRequestSchema } from '@/lib/english-checker/audit/schemas';
import { IncompleteAuditError } from '@/lib/english-checker/audit/validate-clause-coverage';

export const runtime = 'nodejs';
export const maxDuration = 60;

type AuditErrorCode =
  | 'INVALID_INPUT'
  | 'AUDIT_TIMEOUT'
  | 'UPSTREAM_RATE_LIMIT'
  | 'UPSTREAM_ERROR'
  | 'INVALID_AI_SCHEMA'
  | 'INCOMPLETE_CLAUSE_COVERAGE'
  | 'UNKNOWN_ERROR';

function errorResponse(
  code: AuditErrorCode,
  message: string,
  retryable: boolean,
  status: number
) {
  return NextResponse.json({ error: { code, message, retryable } }, { status });
}

function getStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error && 'status' in error && typeof error.status === 'number') {
    return error.status;
  }
  return undefined;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let rawPayload: unknown;

  try {
    rawPayload = await request.json();
  } catch {
    return errorResponse('INVALID_INPUT', 'Request body phải là JSON hợp lệ.', false, 400);
  }

  const parsed = auditRequestSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return errorResponse('INVALID_INPUT', 'Mỗi request phải chứa từ 1 đến 5 audit item hợp lệ.', false, 400);
  }

  const { requestId, items } = parsed.data;

  try {
    const result = await runMicroAudit(items);
    const durationMs = Date.now() - startedAt;
    console.info('english_audit_complete', {
      requestId,
      itemCount: items.length,
      durationMs,
      model: result.model,
      statusCode: 200
    });
    return NextResponse.json({
      requestId,
      items: result.items,
      meta: { model: result.model, durationMs }
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const upstreamStatus = getStatus(error);
    let code: AuditErrorCode = 'UNKNOWN_ERROR';
    let status = 500;
    let retryable = true;
    let message = 'Không thể hoàn tất micro-audit.';

    if (error instanceof AuditTimeoutError || /timed?\s*out|timeout|aborted/iu.test(String((error as Error)?.message))) {
      code = 'AUDIT_TIMEOUT';
      status = 504;
      message = 'Audit did not finish within the soft timeout.';
    } else if (error instanceof IncompleteAuditError) {
      code = 'INCOMPLETE_CLAUSE_COVERAGE';
      status = 502;
      message = error.message;
    } else if (error instanceof InvalidAiSchemaError) {
      code = 'INVALID_AI_SCHEMA';
      status = 502;
      message = error.message;
    } else if (upstreamStatus === 429) {
      code = 'UPSTREAM_RATE_LIMIT';
      status = 429;
      message = 'Dịch vụ AI đang giới hạn tần suất.';
    } else if (upstreamStatus && upstreamStatus >= 500) {
      code = 'UPSTREAM_ERROR';
      status = 502;
      message = 'Dịch vụ AI tạm thời không khả dụng.';
    } else if (String((error as Error)?.message).includes('OPENAI_API_KEY')) {
      code = 'UPSTREAM_ERROR';
      status = 503;
      retryable = false;
      message = 'OPENAI_API_KEY chưa được cấu hình trên server.';
    }

    console.error('english_audit_failed', {
      requestId,
      itemCount: items.length,
      durationMs,
      statusCode: status,
      errorCode: code
    });
    return errorResponse(code, message, retryable, status);
  }
}
