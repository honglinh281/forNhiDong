import { ENGLISH_COMPARISON_PROMPT } from '@/lib/english-checker/prompt';
import { createSemanticComparisonResponseSchema } from '@/lib/english-checker/schema';
import {
  keyedResultsToRows,
  parseStructuredPass
} from '@/lib/english-checker/ai/structured-output';

export async function compareEnglishNameClaims(rows, { client, model }) {
  const responseSchema = createSemanticComparisonResponseSchema(rows.map((row) => row.rowId));
  const parsed = await parseStructuredPass({
    client,
    model,
    instructions: ENGLISH_COMPARISON_PROMPT,
    input: { rows },
    responseSchema,
    formatName: 'xnk_english_name_comparisons'
  });

  return keyedResultsToRows(rows, parsed);
}
