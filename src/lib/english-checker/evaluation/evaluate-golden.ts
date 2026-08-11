import type { CheckStatus } from '@/lib/english-checker/types';

export type GoldenExpected = { id: string; category: string; expected: CheckStatus };
export type GoldenActual = { id: string; status: CheckStatus };

export function evaluateGoldenResults(expected: GoldenExpected[], actual: GoldenActual[]) {
  const actualById = new Map(actual.map((item) => [item.id, item.status]));
  let correct = 0;
  let falseOKCount = 0;
  let humanNonOKCount = 0;
  const missesByCategory: Record<string, number> = {};

  for (const golden of expected) {
    const status = actualById.get(golden.id);
    if (status === golden.expected) correct += 1;
    else missesByCategory[golden.category] = (missesByCategory[golden.category] ?? 0) + 1;
    if (golden.expected !== 'OK') {
      humanNonOKCount += 1;
      if (status === 'OK') falseOKCount += 1;
    }
  }

  return {
    total: expected.length,
    correct,
    accuracy: expected.length ? correct / expected.length : 0,
    falseOKCount,
    humanNonOKCount,
    falseOKRate: humanNonOKCount ? falseOKCount / humanNonOKCount : 0,
    missesByCategory
  };
}
