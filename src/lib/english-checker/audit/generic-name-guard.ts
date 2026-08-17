import { ENGLISH_CHECK_GENERIC_ONLY_NAMES } from '@/lib/english-checker/constants';
import { normalizeSearchText } from '@/lib/english-checker/normalization/normalize-vietnamese';

export function hasGenericEnglishName(value: unknown): boolean {
  const normalized = normalizeSearchText(value);
  return ENGLISH_CHECK_GENERIC_ONLY_NAMES.includes(normalized as never);
}
