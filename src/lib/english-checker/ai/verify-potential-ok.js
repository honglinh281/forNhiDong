import { STRICT_OK_VERIFIER_PROMPT } from '@/lib/english-checker/prompt';
import { createOKVerificationResponseSchema } from '@/lib/english-checker/schema';
import {
  keyedResultsToRows,
  parseStructuredPass
} from '@/lib/english-checker/ai/structured-output';

export async function verifyPotentialOKRows(rows, { client, model }) {
  const responseSchema = createOKVerificationResponseSchema(rows.map((row) => row.rowId));
  const parsed = await parseStructuredPass({
    client,
    model,
    instructions: STRICT_OK_VERIFIER_PROMPT,
    input: { rows },
    responseSchema,
    formatName: 'xnk_potential_ok_verification'
  });

  return keyedResultsToRows(rows, parsed);
}
