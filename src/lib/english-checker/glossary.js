import companyGlossary from '@/lib/domain/glossary.json';

function normalizeGlossaryText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function getRelevantGlossaryEntries(...values) {
  const text = normalizeGlossaryText(values.filter(Boolean).join(' '));

  return companyGlossary.filter((entry) => text.includes(normalizeGlossaryText(entry.vi)));
}

export { companyGlossary };
