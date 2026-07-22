import { PRODUCT_FACT_EXTRACTION_PROMPT } from '@/lib/english-checker/prompt';
import { createProductFactsResponseSchema } from '@/lib/english-checker/schema';
import {
  keyedResultsToRows,
  parseStructuredPass
} from '@/lib/english-checker/ai/structured-output';

export async function extractVietnameseProductFacts(rows, { client, model }) {
  const responseSchema = createProductFactsResponseSchema(rows.map((row) => row.rowId));
  const parsed = await parseStructuredPass({
    client,
    model,
    instructions: PRODUCT_FACT_EXTRACTION_PROMPT,
    input: { rows },
    responseSchema,
    formatName: 'xnk_vietnamese_product_facts'
  });

  return keyedResultsToRows(rows, parsed);
}
