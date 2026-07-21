import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';

import { ENGLISH_CHECK_STATUS } from '@/lib/english-checker/constants';
import { ENGLISH_NAME_CHECK_SYSTEM_PROMPT } from '@/lib/english-checker/prompt';
import { checkResponseSchema } from '@/lib/english-checker/schema';

function validateResultCoverage(rows, results) {
  const expectedIds = new Set(rows.map((row) => row.rowId));
  const receivedIds = new Set();

  for (const result of results) {
    if (!expectedIds.has(result.rowId) || receivedIds.has(result.rowId)) {
      throw new Error('OpenAI trả về danh sách rowId không hợp lệ.');
    }

    receivedIds.add(result.rowId);
  }

  if (receivedIds.size !== expectedIds.size) {
    throw new Error('OpenAI chưa trả đủ kết quả cho batch.');
  }
}

function enforceDeterministicOutput(rows, results) {
  const rowById = new Map(rows.map((row) => [row.rowId, row]));

  return results.map((result) => {
    const row = rowById.get(result.rowId);

    if (!row.productNameEn?.trim()) {
      if (!result.suggestedName?.trim()) {
        throw new Error('OpenAI chưa đề xuất Tên TA cho dòng đang thiếu dữ liệu.');
      }

      return {
        ...result,
        status: ENGLISH_CHECK_STATUS.MISSING,
        reason: 'Thiếu "Tên TA".',
        suggestedName: result.suggestedName || null
      };
    }

    if (result.status === ENGLISH_CHECK_STATUS.OK) {
      return { ...result, reason: null, suggestedName: null };
    }

    return result;
  });
}

export async function checkEnglishNamesWithOpenAI(rows, { apiKey, model, client: providedClient } = {}) {
  const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY;

  if (!resolvedApiKey && !providedClient) {
    throw new Error('OPENAI_API_KEY chưa được cấu hình trên server.');
  }

  const client = providedClient || new OpenAI({ apiKey: resolvedApiKey });
  const response = await client.responses.parse({
    model: model || process.env.OPENAI_MODEL || 'gpt-5-nano',
    instructions: ENGLISH_NAME_CHECK_SYSTEM_PROMPT,
    input: JSON.stringify({ rows }),
    reasoning: { effort: 'low' },
    store: false,
    text: {
      format: zodTextFormat(checkResponseSchema, 'xnk_english_name_check_results')
    }
  });

  if (!response.output_parsed) {
    throw new Error('OpenAI không trả về Structured Output hợp lệ.');
  }

  const parsed = checkResponseSchema.parse(response.output_parsed);
  validateResultCoverage(rows, parsed.results);
  return enforceDeterministicOutput(rows, parsed.results);
}
