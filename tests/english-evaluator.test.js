import goldenCases from './golden-cases.json';

import { evaluateEnglishCheckResults } from '@/lib/english-checker/evaluator';

describe('golden dataset evaluator', () => {
  it('tracks False OK Rate as a first-class metric', () => {
    const matchingResults = goldenCases.map((item) => ({
      rowId: item.id,
      status: item.expectedStatus
    }));
    const metrics = evaluateEnglishCheckResults(goldenCases, matchingResults);

    expect(goldenCases.length).toBeGreaterThanOrEqual(20);
    expect(metrics).toEqual({
      total: goldenCases.length,
      accuracy: 1,
      falseOKCount: 0,
      falseOKRate: 0,
      falseSaiRoCount: 0,
      chuaSatOvercallCount: 0
    });
  });

  it('counts an unsafe OK against the primary metric', () => {
    const metrics = evaluateEnglishCheckResults(
      goldenCases.slice(0, 2),
      [
        { rowId: goldenCases[0].id, status: 'OK' },
        { rowId: goldenCases[1].id, status: goldenCases[1].expectedStatus }
      ]
    );

    expect(metrics.falseOKCount).toBe(1);
    expect(metrics.falseOKRate).toBe(0.5);
  });
});
