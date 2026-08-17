const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/(?<![\p{L}\p{N}])đk\s*trong(?![\p{L}\p{N}])/giu, 'đường kính trong'],
  [/(?<![\p{L}\p{N}])đ\s*\/\s*áp?(?![\p{L}\p{N}])/giu, 'điện áp'],
  [/\bh\s*thống\b/giu, 'hệ thống'],
  [/\bhthống\b/giu, 'hệ thống'],
  [/\bbp\b/giu, 'bộ phận'],
  [/\bsd\b/giu, 'sử dụng'],
  [/\bc\s*\/\s*l\b/giu, 'chất liệu'],
  [/\bcl\b/giu, 'chất liệu'],
  [/\bkt\b/giu, 'kích thước'],
  [/\bko\b/giu, 'không'],
  [/\bkp\b/giu, 'không phải'],
  [/\bcs\b/giu, 'công suất'],
  [/\bnsx\b/giu, 'nhà sản xuất'],
  [/\bCN\b/gu, 'công nghiệp']
];

export function normalizeVietnamese(value: unknown): string {
  let normalized = String(value ?? '').normalize('NFKC').replace(/\r\n?/g, '\n').trim();

  for (const [pattern, replacement] of ABBREVIATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized
    .replace(/(\d)\s*(mm|cm|m|v|a|w|kw|mah|wh)\b/giu, '$1 $2')
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
