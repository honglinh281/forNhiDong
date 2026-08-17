const { runMicroAuditMock } = vi.hoisted(() => ({ runMicroAuditMock: vi.fn() }));

vi.mock('@/lib/english-checker/ai/run-micro-audit', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, runMicroAudit: runMicroAuditMock };
});

import { AuditTimeoutError } from '@/lib/english-checker/ai/run-micro-audit';
import { maxDuration, POST } from '@/app/api/audit/route';

function requestItem(rowId = 'Sheet1::2') {
  return {
    rowId,
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
}

function auditItem(rowId = 'Sheet1::2') {
  return {
    rowId,
    canonicalEnglishName: 'TPU phone case',
    productIdentity: { vietnamese: 'ốp điện thoại', english: 'phone case', relation: 'equivalent' },
    clauseAudits: [
      {
        clauseId: 'C1', clauseText: 'Ốp điện thoại', clauseType: 'product_identity',
        normalizedFact: 'phone case', identityDefining: true, evidenceImportance: 'critical',
        englishCoverage: 'semantic_equivalent', englishEvidence: 'phone case', note: null
      },
      {
        clauseId: 'C2', clauseText: 'bằng nhựa TPU', clauseType: 'material',
        normalizedFact: 'TPU', identityDefining: true, evidenceImportance: 'critical',
        englishCoverage: 'explicit', englishEvidence: 'TPU', note: null
      }
    ],
    englishClaims: [],
    unresolvedCriticalFacts: [],
    overallConfidence: 0.97
  };
}

describe('POST /api/audit', () => {
  beforeEach(() => runMicroAuditMock.mockReset());

  it('is a short stateless micro-task route', () => {
    expect(maxDuration).toBe(60);
  });

  it('returns structured semantic facts without a business status', async () => {
    runMicroAuditMock.mockResolvedValue({ items: [auditItem()], model: 'audit-model' });
    const response = await POST(new Request('http://localhost/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: 'req-1', items: [requestItem()] })
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.requestId).toBe('req-1');
    expect(payload.items[0].canonicalEnglishName).toBe('TPU phone case');
    expect(payload.items[0]).not.toHaveProperty('status');
    expect(runMicroAuditMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a request larger than five rows', async () => {
    const response = await POST(new Request('http://localhost/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: 'req-too-large',
        items: Array.from({ length: 6 }, (_, index) => requestItem(`row-${index}`))
      })
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_INPUT');
    expect(runMicroAuditMock).not.toHaveBeenCalled();
  });

  it('uses the predictable timeout error contract', async () => {
    runMicroAuditMock.mockImplementationOnce(() => {
      throw new AuditTimeoutError();
    });
    const response = await POST(new Request('http://localhost/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: 'req-timeout', items: [requestItem()] })
    }));
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({
      error: {
        code: 'AUDIT_TIMEOUT',
        message: 'Audit did not finish within the soft timeout.',
        retryable: true
      }
    });
  });
});
