import goldenCases from './golden-cases.json';

import { evaluateGoldenResults } from '@/lib/english-checker/evaluation/evaluate-golden';

describe('golden quality metrics', () => {
  it('measures False OK as the primary release metric', () => {
    const actual = goldenCases.map((item) => ({ id: item.id, status: item.expected }));
    const metrics = evaluateGoldenResults(goldenCases, actual);
    expect(metrics).toMatchObject({ total: 25, correct: 25, falseOKCount: 0, falseOKRate: 0 });
  });

  it('counts an incorrect OK only against human-reviewed non-OK rows', () => {
    const actual = goldenCases.map((item) => ({
      id: item.id,
      status: item.id === 'material-missing' ? 'OK' : item.expected
    }));
    const metrics = evaluateGoldenResults(goldenCases, actual);
    expect(metrics.falseOKCount).toBe(1);
    expect(metrics.humanNonOKCount).toBe(21);
    expect(metrics.falseOKRate).toBe(1 / 21);
    expect(metrics.missesByCategory).toEqual({ material_omission: 1 });
  });
});
