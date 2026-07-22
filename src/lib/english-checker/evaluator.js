export function evaluateEnglishCheckResults(goldenCases, actualResults) {
  const actualById = new Map(actualResults.map((result) => [result.rowId, result]));
  let correct = 0;
  let falseOKCount = 0;
  let falseSaiRoCount = 0;
  let chuaSatOvercallCount = 0;

  for (const goldenCase of goldenCases) {
    const actual = actualById.get(goldenCase.id);

    if (!actual) {
      continue;
    }

    if (actual.status === goldenCase.expectedStatus) {
      correct += 1;
    }

    if (actual.status === 'OK' && goldenCase.expectedStatus !== 'OK') {
      falseOKCount += 1;
    }

    if (actual.status === 'Sai rõ' && goldenCase.expectedStatus !== 'Sai rõ') {
      falseSaiRoCount += 1;
    }

    if (actual.status === 'Chưa sát' && goldenCase.expectedStatus === 'OK') {
      chuaSatOvercallCount += 1;
    }
  }

  const total = goldenCases.length;

  return {
    total,
    accuracy: total ? correct / total : 0,
    falseOKCount,
    falseOKRate: total ? falseOKCount / total : 0,
    falseSaiRoCount,
    chuaSatOvercallCount
  };
}
