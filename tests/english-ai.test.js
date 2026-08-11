import { runMicroAudit } from '@/lib/english-checker/ai/run-micro-audit';

const input = {
  rowId: 'row-1',
  originalVietnamese: 'Ốp điện thoại bằng nhựa TPU',
  normalizedVietnamese: 'Ốp điện thoại bằng nhựa TPU',
  currentEnglish: 'TPU phone case',
  clauses: [
    { id: 'C1', text: 'Ốp điện thoại', preTypeHint: 'product_identity' },
    { id: 'C2', text: 'bằng nhựa TPU', preTypeHint: 'material' }
  ],
  secondaryContext: { checkInfo: '', customerFeedback: '' },
  glossaryHints: []
};

function audit(clauseIds = ['C1', 'C2']) {
  return {
    rowId: 'row-1',
    canonicalEnglishName: 'TPU phone case',
    productIdentity: { vietnamese: 'phone case', english: 'phone case', relation: 'equivalent' },
    clauseAudits: clauseIds.map((clauseId) => ({
      clauseId,
      clauseText: clauseId === 'C1' ? 'Ốp điện thoại' : 'bằng nhựa TPU',
      clauseType: clauseId === 'C1' ? 'product_identity' : 'material',
      normalizedFact: clauseId === 'C1' ? 'phone case' : 'TPU',
      identityDefining: true,
      evidenceImportance: 'critical',
      englishCoverage: clauseId === 'C1' ? 'semantic_equivalent' : 'explicit',
      englishEvidence: clauseId === 'C1' ? 'phone case' : 'TPU',
      note: null
    })),
    englishClaims: [],
    unresolvedCriticalFacts: [],
    overallConfidence: 0.97
  };
}

describe('runMicroAudit', () => {
  it('uses Responses Structured Outputs and returns facts only', async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: { items: [audit()] } });
    const result = await runMicroAudit([input], {
      client: { responses: { parse } },
      model: 'audit-model',
      timeoutMs: 5_000
    });

    expect(result.model).toBe('audit-model');
    expect(result.items[0]).not.toHaveProperty('status');
    expect(parse.mock.calls[0][0].text.format).toBeDefined();
    expect(JSON.parse(parse.mock.calls[0][0].input)).toEqual({ items: [input] });
  });

  it('rejects incomplete clause coverage and retries once with repair instructions', async () => {
    const parse = vi.fn()
      .mockResolvedValueOnce({ output_parsed: { items: [audit(['C1'])] } })
      .mockResolvedValueOnce({ output_parsed: { items: [audit()] } });
    const result = await runMicroAudit([input], {
      client: { responses: { parse } },
      model: 'audit-model',
      timeoutMs: 5_000
    });

    expect(result.items[0].clauseAudits).toHaveLength(2);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[1][0].instructions).toContain('SCHEMA REPAIR');
  });
});
