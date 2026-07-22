import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';

import { ENGLISH_NAME_CHECK_SYSTEM_PROMPT } from '@/lib/english-checker/prompt';
import { normalizeEnglishCheckText } from '@/lib/english-checker/processing';
import {
  getPreliminarySemanticStatus,
  mapSemanticChecksToResults
} from '@/lib/english-checker/rule-engine';
import { isSemanticCheckRisky } from '@/lib/english-checker/risk-detector';
import { semanticCheckResponseSchema } from '@/lib/english-checker/schema';
import { applyEnglishSemanticCalibration } from '@/lib/english-checker/semantic-calibrations';

function tokenizeCommercialName(value) {
  return normalizeEnglishCheckText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function containsTokenSequence(containerTokens, candidateTokens) {
  if (!candidateTokens.length || candidateTokens.length > containerTokens.length) {
    return false;
  }

  return containerTokens.some((_, startIndex) =>
    candidateTokens.every((token, tokenIndex) => containerTokens[startIndex + tokenIndex] === token)
  );
}

function hasIndependentContradiction(comparison) {
  return (
    comparison.partWhole === 'different' ||
    comparison.setScope === 'different' ||
    comparison.material === 'different' ||
    comparison.function === 'different'
  );
}

export function normalizeSemanticChecks(rows, semanticChecks) {
  const rowById = new Map(rows.map((row) => [row.rowId, row]));

  return semanticChecks.map((semantic) => {
    const row = rowById.get(semantic.rowId);
    const calibrated = row ? applyEnglishSemanticCalibration(row, semantic) : semantic;

    if (
      !row?.productNameEn ||
      calibrated.comparison.unsupportedInfo ||
      hasIndependentContradiction(calibrated.comparison)
    ) {
      return calibrated;
    }

    const currentTokens = tokenizeCommercialName(row.productNameEn);
    const canonicalTokens = tokenizeCommercialName(calibrated.canonicalName);
    const sameName = currentTokens.join(' ') === canonicalTokens.join(' ');

    if (!containsTokenSequence(currentTokens, canonicalTokens)) {
      return calibrated;
    }

    return {
      ...calibrated,
      comparison: {
        ...calibrated.comparison,
        productIdentity: sameName ? 'exact' : 'equivalent'
      },
      confidence: Math.max(calibrated.confidence, sameName ? 0.9 : 0.85)
    };
  });
}

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
    throw new Error('OpenAI chưa trả đủ semantic analysis cho batch.');
  }
}

export async function analyzeEnglishNamesWithOpenAI(rows, { client, model }) {
  const response = await client.responses.parse({
    model,
    instructions: ENGLISH_NAME_CHECK_SYSTEM_PROMPT,
    input: JSON.stringify({ rows }),
    reasoning: { effort: 'low' },
    store: false,
    text: {
      format: zodTextFormat(semanticCheckResponseSchema, 'xnk_english_name_semantic_checks')
    }
  });

  if (!response.output_parsed) {
    throw new Error('OpenAI không trả về Structured Output hợp lệ.');
  }

  const parsed = semanticCheckResponseSchema.parse(response.output_parsed);
  validateResultCoverage(rows, parsed.results);
  return normalizeSemanticChecks(rows, parsed.results);
}

function mergeSemanticChecks(primaryChecks, fallbackChecks) {
  const fallbackByRowId = new Map(fallbackChecks.map((semantic) => [semantic.rowId, semantic]));
  return primaryChecks.map((semantic) => fallbackByRowId.get(semantic.rowId) || semantic);
}

export async function checkEnglishNamesWithOpenAI(
  rows,
  {
    apiKey,
    model,
    fallbackModel,
    enableFallback,
    client: providedClient
  } = {}
) {
  const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY;

  if (!resolvedApiKey && !providedClient) {
    throw new Error('OPENAI_API_KEY chưa được cấu hình trên server.');
  }

  const client = providedClient || new OpenAI({ apiKey: resolvedApiKey });
  const resolvedModel = model || process.env.OPENAI_MODEL || 'gpt-5-nano';
  const resolvedFallbackModel = fallbackModel || process.env.OPENAI_FALLBACK_MODEL || 'gpt-5-mini';
  const fallbackEnabled =
    typeof enableFallback === 'boolean' ? enableFallback : process.env.ENABLE_AI_FALLBACK !== 'false';
  const primaryChecks = await analyzeEnglishNamesWithOpenAI(rows, {
    client,
    model: resolvedModel
  });
  const primaryResults = mapSemanticChecksToResults(rows, primaryChecks);

  if (!fallbackEnabled) {
    return primaryResults;
  }

  const semanticByRowId = new Map(primaryChecks.map((semantic) => [semantic.rowId, semantic]));
  const riskyRows = rows.filter((row) =>
    isSemanticCheckRisky(
      row,
      semanticByRowId.get(row.rowId),
      getPreliminarySemanticStatus(row, semanticByRowId.get(row.rowId))
    )
  );

  if (!riskyRows.length) {
    return primaryResults;
  }

  try {
    const fallbackChecks = await analyzeEnglishNamesWithOpenAI(riskyRows, {
      client,
      model: resolvedFallbackModel
    });
    return mapSemanticChecksToResults(rows, mergeSemanticChecks(primaryChecks, fallbackChecks));
  } catch {
    return primaryResults;
  }
}
