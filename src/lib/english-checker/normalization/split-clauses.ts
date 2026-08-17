import type { ClauseType, InputClause } from '@/lib/english-checker/types';
import { normalizeSearchText } from '@/lib/english-checker/normalization/normalize-vietnamese';

const MARKER_PATTERN =
  /(?=\b(?:chất liệu|vật liệu|c\s*\/\s*l|cl|bằng|dùng cho|dùng|sử dụng|sd|để|kích thước|kt|model|mã|hiệu|nhãn hiệu|nsx|nhà sản xuất|điện áp|đ\s*\/\s*á|công suất|cs|dòng điện|gồm|bộ phận|linh kiện|phụ kiện)\b)/giu;

const TYPE_HINTS: Array<[ClauseType, RegExp]> = [
  ['electrical', /\b(dien ap|cong suat|dong dien|volt|watt|vdc|vac|hz)\b/u],
  ['dimension', /\b(kich thuoc|kt|mm|cm|met|inch)\b/u],
  ['brand', /\b(hieu|nhan hieu|brand)\b/u],
  ['manufacturer', /\b(nsx|nha san xuat|manufacturer)\b/u],
  ['model', /\b(model|ma san pham|ma hieu)\b/u],
  ['part_whole', /\b(bo phan|linh kien|phu kien|chi tiet)\b/u],
  ['condition', /\b(moi 100|da qua su dung|used|new)\b/u],
  ['origin', /\b(xuat xu|made in)\b/u],
  ['packing', /\b(dong goi|kien|thung|hop|pcs|cai|set)\b/u],
  ['material', /\b(chat lieu|vat lieu|c l|cl|bang|nhua|tpu|pvc|abs|inox|thep|nhom|dong|cao su|go|kinh|da)\b/u],
  ['set_scope', /\b(gom|bo|set|combo)\b/u],
  ['function', /\b(dung|su dung|de|bao ve|do|kiem tra|ket noi|dieu khien)\b/u],
  ['shape', /\b(hinh|dang)\b/u]
];

function classifyFragment(fragment: string, index: number): ClauseType | 'unknown' {
  const normalized = normalizeSearchText(fragment);

  for (const [type, pattern] of TYPE_HINTS) {
    if (pattern.test(normalized)) return type;
  }

  return index === 0 ? 'product_identity' : 'unknown';
}

function splitOnColon(value: string): string[] {
  const parts: string[] = [];
  let rest = value;

  while (rest.includes(':')) {
    const index = rest.indexOf(':');
    parts.push(rest.slice(0, index));
    rest = rest.slice(index + 1);
  }

  parts.push(rest);
  return parts;
}

function splitFragment(value: string): string[] {
  return splitOnColon(value)
    .flatMap((part) => part.split(MARKER_PATTERN))
    .flatMap((part) => part.split(/[,;]+|\n+/u))
    .map((part) => part.trim().replace(/^[.\-–—]+|[.\-–—]+$/g, '').trim())
    .filter(Boolean);
}

export function splitVietnameseClauses(value: unknown): InputClause[] {
  const original = String(value ?? '').normalize('NFKC').replace(/\r\n?/g, '\n').trim();
  const fragments = splitFragment(original);

  return fragments.map((text, index) => ({
    id: `C${index + 1}`,
    text,
    preTypeHint: classifyFragment(text, index)
  }));
}

export function hasColonDetail(value: unknown): boolean {
  const [before, ...after] = String(value ?? '').split(':');
  return Boolean(before.trim() && after.join(':').trim());
}
