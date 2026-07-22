import { zodTextFormat } from 'openai/helpers/zod';

export async function parseStructuredPass({
  client,
  model,
  instructions,
  input,
  responseSchema,
  formatName,
  reasoningEffort = 'medium',
  attempts = 2
}) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await client.responses.parse({
        model,
        instructions,
        input: JSON.stringify(input),
        reasoning: { effort: reasoningEffort },
        store: false,
        text: {
          format: zodTextFormat(responseSchema, formatName)
        }
      });

      if (!response.output_parsed) {
        throw new Error('OpenAI không trả về Structured Output hợp lệ.');
      }

      return responseSchema.parse(response.output_parsed);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function keyedResultsToRows(rows, parsed) {
  return rows.map((row) => ({
    rowId: row.rowId,
    ...parsed.results[row.rowId]
  }));
}
