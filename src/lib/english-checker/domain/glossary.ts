import { normalizeSearchText } from '@/lib/english-checker/normalization/normalize-vietnamese';

export const DOMAIN_GLOSSARY = Object.freeze([
  { vi: 'màng van khí nén', preferredEnglish: 'pneumatic valve diaphragm' },
  { vi: 'dây đeo kính', preferredEnglish: 'eyeglass strap' },
  { vi: 'đầu bơm lốp', preferredEnglish: 'tire inflator chuck' },
  { vi: 'vỏ bảo vệ đầu nối', preferredEnglish: 'connector protective cover' },
  { vi: 'thanh nạy lốp', preferredEnglish: 'tire lever' },
  { vi: 'mô-đun transistor IGBT', preferredEnglish: 'IGBT transistor module' },
  { vi: 'bộ khóa cửa', preferredEnglish: 'door lock set' }
]);

export function findGlossaryHints(vietnamese: string) {
  const haystack = normalizeSearchText(vietnamese);

  return DOMAIN_GLOSSARY.filter((entry) =>
    haystack.includes(normalizeSearchText(entry.vi))
  ).map(({ vi, preferredEnglish }) => ({ vi, preferredEnglish }));
}
