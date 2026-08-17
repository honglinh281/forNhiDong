import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { ZodError } from 'zod';

import { MICRO_AUDIT_SYSTEM_PROMPT } from '@/lib/english-checker/ai/prompt';
import { aiMicroAuditResponseSchema } from '@/lib/english-checker/audit/schemas';
import { IncompleteAuditError, validateMicroAuditItems } from '@/lib/english-checker/audit/validate-clause-coverage';
import { AUDIT_SOFT_TIMEOUT_MS } from '@/lib/english-checker/constants';
import type { AiMicroAuditItem, AuditRequestItem } from '@/lib/english-checker/types';

export class AuditTimeoutError extends Error {
  code = 'AUDIT_TIMEOUT' as const;
  retryable = true;

  constructor() {
    super('Audit did not finish within the soft timeout.');
    this.name = 'AuditTimeoutError';
  }
}

export class InvalidAiSchemaError extends Error {
  code = 'INVALID_AI_SCHEMA' as const;
  retryable = true;

  constructor(message = 'OpenAI không trả về Structured Output hợp lệ.') {
    super(message);
    this.name = 'InvalidAiSchemaError';
  }
}

function isSchemaError(error: unknown): boolean {
  return error instanceof ZodError || error instanceof InvalidAiSchemaError || error instanceof IncompleteAuditError;
}

export async function runMicroAudit(
  items: AuditRequestItem[],
  {
    apiKey,
    model,
    client: providedClient,
    timeoutMs
  }: {
    apiKey?: string;
    model?: string;
    client?: OpenAI;
    timeoutMs?: number;
  } = {}
): Promise<{ items: AiMicroAuditItem[]; model: string }> {
  const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY;
  if (!resolvedApiKey && !providedClient) {
    throw new Error('OPENAI_API_KEY chưa được cấu hình trên server.');
  }

  const client = providedClient || new OpenAI({ apiKey: resolvedApiKey });
  const resolvedModel = model || process.env.OPENAI_AUDIT_MODEL || process.env.OPENAI_MODEL || 'gpt-5-mini';
  const controller = new AbortController();
  const softTimeout = timeoutMs ?? Number(process.env.AUDIT_SOFT_TIMEOUT_MS || AUDIT_SOFT_TIMEOUT_MS);
  const timer = setTimeout(() => controller.abort(new AuditTimeoutError()), softTimeout);
  let lastError: unknown;

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const instructions = attempt === 0
          ? MICRO_AUDIT_SYSTEM_PROMPT
          : `${MICRO_AUDIT_SYSTEM_PROMPT}\n\nSCHEMA REPAIR: The previous output was incomplete or invalid. Return every rowId and exactly one ClauseAudit for every supplied clauseId.`;
        const response = await client.responses.parse(
          {
            model: resolvedModel,
            instructions,
            input: JSON.stringify({ items }),
            reasoning: { effort: 'low' },
            store: false,
            text: { format: zodTextFormat(aiMicroAuditResponseSchema, 'xnk_micro_audit') }
          },
          { signal: controller.signal }
        );

        if (!response.output_parsed) throw new InvalidAiSchemaError();
        const parsed = aiMicroAuditResponseSchema.parse(response.output_parsed);
        validateMicroAuditItems(items, parsed.items);
        return { items: parsed.items, model: resolvedModel };
      } catch (error) {
        if (controller.signal.aborted) throw new AuditTimeoutError();
        lastError = error;
        if (attempt === 0 && isSchemaError(error)) continue;
        throw error;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  throw lastError ?? new InvalidAiSchemaError();
}
