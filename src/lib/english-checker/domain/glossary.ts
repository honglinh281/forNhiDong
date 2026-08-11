import { normalizeSearchText } from '@/lib/english-checker/normalization/normalize-vietnamese';

export const DOMAIN_GLOSSARY = Object.freeze([
  { vi: 'màng van khí nén', preferredEnglish: 'pneumatic valve diaphragm' },
  { vi: 'dây đeo kính', preferredEnglish: 'eyeglass strap' },
  { vi: 'đầu bơm lốp', preferredEnglish: 'tire inflator chuck' },
  { vi: 'vỏ bảo vệ đầu nối', preferredEnglish: 'connector protective cover' },
  { vi: 'thanh nạy lốp', preferredEnglish: 'tire lever' },
  { vi: 'lõi lọc dầu thủy lực', preferredEnglish: 'hydraulic oil filter element' },
  { vi: 'mô-đun transistor IGBT', preferredEnglish: 'IGBT transistor module' },
  { vi: 'máy ảnh chụp lấy ảnh ngay', preferredEnglish: 'instant camera' },
  { vi: 'van điều áp khí nén', preferredEnglish: 'pneumatic pressure regulator' },
  { vi: 'chốt đẩy khuôn', preferredEnglish: 'mold ejector pin' },
  { vi: 'van lọc chữ Y', preferredEnglish: 'Y-strainer valve' },
  { vi: 'bơm màng tăng áp', preferredEnglish: 'diaphragm booster pump' },
  { vi: 'đầu bàn chải đánh răng', preferredEnglish: 'toothbrush head' },
  { vi: 'đầu mũi hàn', preferredEnglish: 'soldering tip' },
  { vi: 'dây cáp âm thanh quang', preferredEnglish: 'optical audio cable' },
  { vi: 'bộ nguồn chuyển mạch AC-DC', preferredEnglish: 'AC-DC switching power supply' },
  { vi: 'bộ khóa cửa', preferredEnglish: 'door lock set' }
]);

export function findGlossaryHints(vietnamese: string) {
  const haystack = normalizeSearchText(vietnamese);

  return DOMAIN_GLOSSARY.filter((entry) =>
    haystack.includes(normalizeSearchText(entry.vi))
  ).map(({ vi, preferredEnglish }) => ({ vi, preferredEnglish }));
}
