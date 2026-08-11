import { finalizeAuditResult } from '@/lib/english-checker/audit/status-mapper';
import { createAuditRequestItem } from '@/lib/english-checker/processing';

function row(productNameVi, productNameEn) {
  return {
    rowId: 'row-1', sheet: 'Data', excelRow: 2, stt: 1,
    productNameVi, productNameEn, checkInfo: '', customerFeedback: ''
  };
}

function clause(clauseId, clauseText, overrides = {}) {
  return {
    clauseId,
    clauseText,
    clauseType: 'product_identity',
    normalizedFact: clauseText,
    identityDefining: true,
    evidenceImportance: 'critical',
    englishCoverage: 'semantic_equivalent',
    englishEvidence: 'supported',
    note: null,
    ...overrides
  };
}

function audit(sourceRow, overrides = {}) {
  const request = createAuditRequestItem(sourceRow);
  const base = {
    rowId: sourceRow.rowId,
    canonicalEnglishName: sourceRow.productNameEn || 'Canonical English name',
    productIdentity: {
      vietnamese: sourceRow.productNameVi,
      english: sourceRow.productNameEn || '',
      relation: 'equivalent'
    },
    clauseAudits: request.clauses.map((item) => clause(item.id, item.text)),
    englishClaims: [],
    unresolvedCriticalFacts: [],
    overallConfidence: 0.96
  };
  return { ...base, ...overrides, productIdentity: { ...base.productIdentity, ...overrides.productIdentity } };
}

function finalize(sourceRow, overrides = {}) {
  const request = createAuditRequestItem(sourceRow);
  return finalizeAuditResult(sourceRow, request, audit(sourceRow, overrides));
}

describe('deterministic strict status mapper', () => {
  it('blocks OK when an explicit Vietnamese material is missing', () => {
    const source = row('Ốp điện thoại bằng kính', 'Phone case');
    const result = finalize(source, {
      canonicalEnglishName: 'Glass phone case',
      clauseAudits: [
        clause('C1', 'Ốp điện thoại'),
        clause('C2', 'bằng kính', { clauseType: 'material', normalizedFact: 'glass', englishCoverage: 'missing' })
      ]
    });
    expect(result).toMatchObject({ status: 'Chưa sát', suggestedName: 'Glass phone case' });
    expect(result.reason).toContain('glass/kính');
  });

  it('overrides an optimistic AI audit when English adds unsupported material', () => {
    const result = finalize(row('Ốp điện thoại', 'Glass phone case'), {
      canonicalEnglishName: 'Phone case'
    });
    expect(result.status).toBe('Sai rõ');
    expect(result.reason).toContain('không hỗ trợ');
  });

  it('detects deterministic material contradiction', () => {
    const result = finalize(row('Miếng dán màn hình, chất liệu nhựa TPU', 'Tempered glass screen protector'), {
      canonicalEnglishName: 'TPU screen protector'
    });
    expect(result.status).toBe('Sai rõ');
    expect(result.reason).toContain('TPU');
    expect(result.reason).toContain('glass/kính');
  });

  it('never lets a generic-only English name become OK', () => {
    const result = finalize(row('Mô-đun transistor IGBT dùng cho biến tần', 'Module'), {
      canonicalEnglishName: 'IGBT transistor module'
    });
    expect(result.status).toBe('Chưa sát');
    expect(result.suggestedName).toBe('IGBT transistor module');
  });

  it('maps a different identity to Sai rõ with a specific reason', () => {
    const result = finalize(row('Dây đeo kính', 'Eyeglasses bag'), {
      canonicalEnglishName: 'Eyeglass strap',
      productIdentity: { vietnamese: 'eyeglass strap', english: 'eyeglasses bag', relation: 'different' }
    });
    expect(result).toMatchObject({ status: 'Sai rõ', suggestedName: 'Eyeglass strap' });
    expect(result.reason).toContain('eyeglasses bag');
    expect(result.reason).toContain('eyeglass strap');
  });

  it('requires positive proof before returning OK', () => {
    const source = row('Ốp điện thoại bằng nhựa TPU', 'TPU phone case');
    const request = createAuditRequestItem(source);
    const result = finalizeAuditResult(source, request, audit(source, {
      canonicalEnglishName: 'TPU phone case',
      clauseAudits: request.clauses.map((item) => clause(item.id, item.text, {
        clauseType: item.preTypeHint === 'unknown' ? 'other' : item.preTypeHint,
        englishCoverage: item.preTypeHint === 'material' ? 'explicit' : 'semantic_equivalent'
      }))
    }));
    expect(result).toMatchObject({ status: 'OK', reason: '', suggestedName: '' });
  });

  it('never auto-OKs uncertainty or low confidence', () => {
    expect(finalize(row('Giá đỡ máy chiếu', 'Projector stand'), {
      overallConfidence: 0.7,
      canonicalEnglishName: 'Projector stand'
    }).status).toBe('Chưa sát');
    expect(finalize(row('Giá đỡ máy chiếu', 'Projector stand'), {
      unresolvedCriticalFacts: ['product subtype'],
      canonicalEnglishName: 'Projector stand'
    }).status).toBe('Chưa sát');
  });
});
