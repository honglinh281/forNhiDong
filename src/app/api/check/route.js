import { NextResponse } from 'next/server';

import { checkEnglishNamesWithOpenAI } from '@/lib/english-checker/ai';
import { ENGLISH_CHECK_BATCH_SIZE } from '@/lib/english-checker/constants';
import { expandEnglishCheckResults, prepareEnglishChecks } from '@/lib/english-checker/processing';
import { checkRequestSchema, checkResponseSchema } from '@/lib/english-checker/schema';

export const runtime = 'nodejs';
export const maxDuration = 300;

function jsonError(message, status) {
  return NextResponse.json({ message }, { status });
}

function isTimeoutError(error) {
  const message = error instanceof Error ? error.message : String(error);

  return error?.name === 'APIConnectionTimeoutError' || /timed?\s*out|timeout|ETIMEDOUT/iu.test(message);
}

function getServerBatchSize() {
  const configured = Number(process.env.AI_BATCH_SIZE);

  if (Number.isInteger(configured) && configured >= 1 && configured <= 10) {
    return configured;
  }

  return ENGLISH_CHECK_BATCH_SIZE;
}

function splitIntoBatches(rows, batchSize) {
  const batches = [];

  for (let index = 0; index < rows.length; index += batchSize) {
    batches.push(rows.slice(index, index + batchSize));
  }

  return batches;
}

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return jsonError('Request body phải là JSON hợp lệ.', 400);
  }

  const parsedRequest = checkRequestSchema.safeParse(payload);

  if (!parsedRequest.success) {
    return jsonError('Dữ liệu kiểm tra không đúng định dạng hoặc vượt quá 100 dòng mỗi request.', 400);
  }

  try {
    const rows = parsedRequest.data.rows;
    const prepared = prepareEnglishChecks(rows);
    const uniqueResults = [];

    for (const batch of splitIntoBatches(prepared.uniqueRows, getServerBatchSize())) {
      uniqueResults.push(...(await checkEnglishNamesWithOpenAI(batch)));
    }
    const results = expandEnglishCheckResults(rows, prepared, uniqueResults).map(
      ({ rowId, status, reason, suggestedName }) => ({ rowId, status, reason, suggestedName })
    );
    const validatedResponse = checkResponseSchema.parse({ results });

    return NextResponse.json(validatedResponse);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Không thể kiểm tra Tên TA.';
    const timedOut = isTimeoutError(error);
    const message = timedOut
      ? 'Dịch vụ AI xử lý quá thời gian. Vui lòng thử lại sau ít phút.'
      : rawMessage;
    const status = rawMessage.includes('OPENAI_API_KEY') ? 503 : timedOut ? 504 : 502;
    return jsonError(message, status);
  }
}
