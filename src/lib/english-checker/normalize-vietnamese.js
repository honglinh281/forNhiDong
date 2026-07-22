const REPLACEMENTS = Object.freeze([
  [/(?<![\p{L}\p{N}])đk\s*trong(?![\p{L}\p{N}])/giu, 'đường kính trong'],
  [/(?<![\p{L}\p{N}])đ\/áp(?![\p{L}\p{N}])/giu, 'điện áp'],
  [/\bh\s*thống\b/giu, 'hệ thống'],
  [/\bhthống\b/giu, 'hệ thống'],
  [/\bBP\b/gu, 'Bộ phận'],
  [/\bsd\b/giu, 'sử dụng'],
  [/\bc\/l\b/giu, 'chất liệu'],
  [/\bcl\b/giu, 'chất liệu'],
  [/\bkt\b/giu, 'kích thước'],
  [/\bko\b/giu, 'không'],
  [/\bkp\b/giu, 'không phải'],
  [/\bCN\b/gu, 'công nghiệp']
]);

export function normalizeVietnameseDescription(value) {
  const original = String(value ?? '').normalize('NFKC').trim();
  let normalized = original;

  for (const [pattern, replacement] of REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized
    .replace(/(\d)\s*(mm|cm|m|v|a|w|kw|mah|wh)\b/giu, '$1 $2')
    .replace(/\s*([,:;])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

  return { original, normalized };
}
