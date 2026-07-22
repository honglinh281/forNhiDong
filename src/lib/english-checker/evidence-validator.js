function normalizeEvidenceText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function collectEvidenceFacts(facts) {
  return [
    ['product identity', facts.productIdentity],
    ['product class', facts.productClass],
    ['subtype', facts.subtype],
    ...facts.distinguishingQualifiers.map((fact) => ['distinguishing qualifier', fact]),
    ['material', facts.factualConstraints.material],
    ['function', facts.factualConstraints.function],
    ['application', facts.factualConstraints.application],
    ['composition', facts.factualConstraints.composition]
  ].filter(([, fact]) => fact);
}

export function validateProductFactEvidence(facts, sourceInput) {
  const sources = [
    sourceInput.productNameVi.original,
    sourceInput.productNameVi.normalized,
    sourceInput.checkInfo.original,
    sourceInput.checkInfo.normalized,
    sourceInput.customerFeedback.original,
    sourceInput.customerFeedback.normalized
  ].map(normalizeEvidenceText);
  const invalidEvidence = collectEvidenceFacts(facts)
    .filter(([, fact]) => {
      const evidence = normalizeEvidenceText(fact.evidence);
      return !evidence || !sources.some((source) => source.includes(evidence));
    })
    .map(([label, fact]) => `${label}: ${fact.evidence}`);

  if (!invalidEvidence.length) {
    return facts;
  }

  return {
    ...facts,
    unresolvedCriticalFacts: [
      ...new Set([
        ...facts.unresolvedCriticalFacts,
        ...invalidEvidence.map((item) => `Evidence không khớp nguồn (${item})`)
      ])
    ],
    confidence: Math.min(facts.confidence, 0.79)
  };
}
