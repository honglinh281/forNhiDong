const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bbp\b/giu, 'bộ phận'],
  [/\bsd\b/giu, 'sử dụng'],
  [/\bc\s*\/\s*l\b/giu, 'chất liệu'],
  [/\bcl\b/giu, 'chất liệu'],
  [/\bkt\b/giu, 'kích thước'],
  [/\bko\b/giu, 'không'],
  [/\bđ\s*\/\s*á\b/giu, 'điện áp'],
  [/\bcs\b/giu, 'công suất'],
  [/\bnsx\b/giu, 'nhà sản xuất']
];

export function normalizeVietnamese(value: unknown): string {
  let normalized = String(value ?? '').normalize('NFKC').replace(/\r\n?/g, '\n').trim();

  for (const [pattern, replacement] of ABBREVIATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/giu, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
