import type { MaterialGuardResult } from '@/lib/english-checker/types';
import { normalizeSearchText } from '@/lib/english-checker/normalization/normalize-vietnamese';

type CanonicalMaterial =
  | 'glass'
  | 'tpu'
  | 'pvc'
  | 'abs'
  | 'pp'
  | 'pe'
  | 'plastic'
  | 'steel'
  | 'stainless_steel'
  | 'aluminum'
  | 'copper'
  | 'copper_alloy'
  | 'brass'
  | 'rubber'
  | 'wood'
  | 'textile'
  | 'leather'
  | 'synthetic_leather'
  | 'paper'
  | 'ceramic';

const MATERIAL_ALIASES: ReadonlyArray<[CanonicalMaterial, readonly string[]]> = [
  ['stainless_steel', ['stainless steel', 'thep khong gi', 'inox']],
  ['synthetic_leather', ['synthetic leather', 'artificial leather', 'da tong hop', 'da nhan tao', 'pu leather']],
  ['copper_alloy', ['copper alloy', 'hop kim dong']],
  ['glass', ['tempered glass', 'glass', 'kinh toi', 'thuy tinh', 'kinh']],
  ['tpu', ['nhua tpu', 'tpu']],
  ['pvc', ['nhua pvc', 'pvc']],
  ['abs', ['nhua abs', 'abs']],
  ['pp', ['nhua pp', 'polypropylene', 'pp']],
  ['pe', ['nhua pe', 'polyethylene', 'pe']],
  ['aluminum', ['aluminum alloy', 'aluminium alloy', 'hop kim nhom', 'aluminum', 'aluminium', 'nhom']],
  ['brass', ['brass', 'dong thau']],
  ['copper', ['copper', 'dong']],
  ['rubber', ['rubber', 'cao su']],
  ['wood', ['wooden', 'wood', 'go']],
  ['textile', ['textile', 'fabric', 'vai']],
  ['leather', ['genuine leather', 'leather', 'da that', 'da']],
  ['paper', ['paper', 'giay']],
  ['ceramic', ['ceramic', 'porcelain', 'gom', 'su']],
  ['steel', ['carbon steel', 'alloy steel', 'steel', 'thep']],
  ['plastic', ['plastic', 'nhua']]
];

const VI_MATERIAL_ALIASES: ReadonlyArray<[CanonicalMaterial, readonly string[]]> = [
  ['stainless_steel', ['stainless steel', 'thép không gỉ', 'inox']],
  ['synthetic_leather', ['synthetic leather', 'artificial leather', 'da tổng hợp', 'da nhân tạo', 'pu leather']],
  ['copper_alloy', ['copper alloy', 'hợp kim đồng']],
  ['glass', ['tempered glass', 'glass', 'kính tôi', 'thủy tinh', 'kính']],
  ['tpu', ['nhựa tpu', 'tpu']],
  ['pvc', ['nhựa pvc', 'pvc']],
  ['abs', ['nhựa abs', 'abs']],
  ['pp', ['nhựa pp', 'polypropylene', 'pp']],
  ['pe', ['nhựa pe', 'polyethylene', 'pe']],
  ['aluminum', ['aluminum alloy', 'aluminium alloy', 'hợp kim nhôm', 'aluminum', 'aluminium', 'nhôm']],
  ['brass', ['brass', 'đồng thau']],
  ['copper', ['copper', 'đồng']],
  ['rubber', ['rubber', 'cao su']],
  ['wood', ['wooden', 'wood', 'gỗ']],
  ['textile', ['textile', 'fabric', 'vải']],
  ['leather', ['genuine leather', 'leather', 'da thật', 'da']],
  ['paper', ['paper', 'giấy']],
  ['ceramic', ['ceramic', 'porcelain', 'gốm', 'sứ']],
  ['steel', ['carbon steel', 'alloy steel', 'steel', 'thép']],
  ['plastic', ['plastic', 'nhựa']]
];

const BROADER_MATERIAL: Partial<Record<CanonicalMaterial, CanonicalMaterial>> = {
  stainless_steel: 'steel',
  copper_alloy: 'copper'
};

function containsPhrase(text: string, phrase: string): boolean {
  return (` ${text} `).includes(` ${phrase} `);
}

function extractFromAliases(
  normalized: string,
  aliasesByMaterial: ReadonlyArray<[CanonicalMaterial, readonly string[]]>
): CanonicalMaterial[] {
  const materials: CanonicalMaterial[] = [];
  let masked = ` ${normalized} `;

  for (const [canonical, aliases] of aliasesByMaterial) {
    const matched = aliases.some((alias) => containsPhrase(masked.trim(), alias));
    if (!matched) continue;
    materials.push(canonical);

    // Prevent broad aliases such as steel/plastic/leather from double-counting a specific material.
    for (const alias of aliases) {
      masked = masked.replaceAll(` ${alias} `, ' ');
    }
  }

  return [...new Set(materials)];
}

export function extractVietnameseMaterials(value: unknown): CanonicalMaterial[] {
  const normalized = String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/đồng (?:hồ|bộ)/gu, ' ');
  return extractFromAliases(normalized, VI_MATERIAL_ALIASES);
}

export function extractEnglishMaterials(value: unknown): CanonicalMaterial[] {
  return extractFromAliases(normalizeSearchText(value), MATERIAL_ALIASES);
}

export function inspectMaterialCoverage(
  vietnamese: unknown,
  english: unknown
): MaterialGuardResult {
  const vietnameseMaterials = extractVietnameseMaterials(vietnamese);
  const englishMaterials = extractEnglishMaterials(english);
  const viSet = new Set(vietnameseMaterials);
  const enSet = new Set(englishMaterials);
  const missingFromEnglish = vietnameseMaterials.filter((material) => !enSet.has(material));
  const unsupportedInEnglish = englishMaterials.filter((englishMaterial) =>
    !viSet.has(englishMaterial) &&
    !vietnameseMaterials.some((viMaterial) => BROADER_MATERIAL[viMaterial] === englishMaterial)
  );
  const hasCompatibleMaterial = vietnameseMaterials.some((viMaterial) =>
    englishMaterials.some((englishMaterial) =>
      viMaterial === englishMaterial ||
      BROADER_MATERIAL[viMaterial] === englishMaterial ||
      BROADER_MATERIAL[englishMaterial] === viMaterial
    )
  );

  return {
    vietnameseMaterials,
    englishMaterials,
    missingFromEnglish,
    unsupportedInEnglish,
    contradiction:
      vietnameseMaterials.length > 0 &&
      englishMaterials.length > 0 &&
      !hasCompatibleMaterial
  };
}

export function formatMaterial(material: string): string {
  return ({
    glass: 'glass/kính',
    tpu: 'TPU',
    pvc: 'PVC',
    abs: 'ABS',
    pp: 'PP',
    pe: 'PE',
    plastic: 'plastic/nhựa',
    steel: 'steel/thép',
    stainless_steel: 'stainless steel/inox',
    aluminum: 'aluminum/nhôm',
    copper: 'copper/đồng',
    copper_alloy: 'copper alloy/hợp kim đồng',
    brass: 'brass/đồng thau',
    rubber: 'rubber/cao su',
    wood: 'wood/gỗ',
    textile: 'textile/vải',
    leather: 'leather/da',
    synthetic_leather: 'synthetic leather/da tổng hợp',
    paper: 'paper/giấy',
    ceramic: 'ceramic/gốm sứ'
  } as Record<string, string>)[material] ?? material;
}
