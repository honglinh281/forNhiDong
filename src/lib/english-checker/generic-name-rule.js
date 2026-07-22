import { ENGLISH_CHECK_GENERIC_ONLY_NAMES } from '@/lib/english-checker/constants';
import { normalizeEnglishCheckText } from '@/lib/english-checker/processing';

export function isGenericOnlyEnglishName(productNameEn) {
  const normalized = normalizeEnglishCheckText(productNameEn);

  return (
    ENGLISH_CHECK_GENERIC_ONLY_NAMES.includes(normalized) ||
    /^(?:parts?|components?)\s+(?:of|for)\b/.test(normalized)
  );
}
