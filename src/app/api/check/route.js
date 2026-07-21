import { NextResponse } from 'next/server';

import { checkEnglishNamesWithOpenAI } from '@/lib/english-checker/ai';
import { expandEnglishCheckResults, prepareEnglishChecks } from '@/lib/english-checker/processing';
import { checkRequestSchema, checkResponseSchema } from '@/lib/english-checker/schema';

export const runtime = 'nodejs';
export const maxDuration = 60;

function jsonError(message, status) {
  return NextResponse.json({ message }, { status });
}

async function runOpenAIWithRetry(rows) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await checkEnglishNamesWithOpenAI(rows);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
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
    const uniqueResults = prepared.uniqueRows.length ? await runOpenAIWithRetry(prepared.uniqueRows) : [];
    const results = expandEnglishCheckResults(rows, prepared, uniqueResults).map(
      ({ rowId, status, reason, suggestedName }) => ({ rowId, status, reason, suggestedName })
    );
    const validatedResponse = checkResponseSchema.parse({ results });

    return NextResponse.json(validatedResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể kiểm tra Tên TA.';
    const status = message.includes('OPENAI_API_KEY') ? 503 : 502;
    return jsonError(message, status);
  }
}
