import type { AiMicroAuditItem } from '@/lib/english-checker/types';
import { normalizeSearchText } from '@/lib/english-checker/normalization/normalize-vietnamese';

export type ScopeGuardResult = {
  vietnameseSignals: string[];
  englishSignals: string[];
  contradiction: boolean;
};

export function inspectScope(vietnamese: unknown, english: unknown, audit?: AiMicroAuditItem): ScopeGuardResult {
  const vi = normalizeSearchText(vietnamese);
  const en = normalizeSearchText(english);
  const vietnameseSignals = [
    /\b(bo phan|linh kien|chi tiet)\b/u.test(vi) ? 'part' : '',
    /\b(phu kien)\b/u.test(vi) ? 'accessory' : '',
    /\b(bo|gom)\b/u.test(vi) ? 'set' : ''
  ].filter(Boolean);
  const englishSignals = [
    /\b(part|parts|component|components)\b/u.test(en) ? 'part' : '',
    /\b(accessory|accessories)\b/u.test(en) ? 'accessory' : '',
    /\b(set|kit)\b/u.test(en) ? 'set' : ''
  ].filter(Boolean);
  const contradiction = Boolean(
    audit?.clauseAudits.some(
      (clause) =>
        ['part_whole', 'set_scope'].includes(clause.clauseType) &&
        clause.englishCoverage === 'contradiction'
    )
  );

  return { vietnameseSignals, englishSignals, contradiction };
}
