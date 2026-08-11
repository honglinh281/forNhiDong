import {
  extractEnglishMaterials,
  extractVietnameseMaterials,
  inspectMaterialCoverage
} from '@/lib/english-checker/audit/material-guard';
import { normalizeVietnamese } from '@/lib/english-checker/normalization/normalize-vietnamese';
import { splitVietnameseClauses } from '@/lib/english-checker/normalization/split-clauses';

describe('Vietnamese normalization and clause coverage preparation', () => {
  it('expands abbreviations only at word boundaries', () => {
    expect(normalizeVietnamese('BP van, cl TPU, kt 20mm, nsx ABC')).toBe(
      'bộ phận van, chất liệu TPU, kích thước 20 mm, nhà sản xuất ABC'
    );
    expect(normalizeVietnamese('socket')).toBe('socket');
  });

  it('ports the extended customs abbreviations from main without mutating normal words', () => {
    expect(
      normalizeVietnamese(
        'BP chuyên dùng, sd thay thế, c/l cao su, kt 8mm, ko dùng điện, đ/áp 24V, kp hàng cũ, dùng trong CN'
      )
    ).toBe(
      'bộ phận chuyên dùng, sử dụng thay thế, chất liệu cao su, kích thước 8 mm, không dùng điện, điện áp 24 V, không phải hàng cũ, dùng trong công nghiệp'
    );
    expect(normalizeVietnamese('van có đk trong 8mm')).toBe('van có đường kính trong 8 mm');
    expect(normalizeVietnamese('Kẹp cố định bằng nhựa ABS')).toBe('Kẹp cố định bằng nhựa ABS');
  });

  it('preserves colon details, unknown fragments, and marker-based clauses', () => {
    const clauses = splitVietnameseClauses(
      'BP chuyên dùng cho van điện từ: Màng van khí nén, chất liệu cao su, ghi chú lạ'
    );
    expect(clauses.map((item) => item.text)).toEqual([
      'BP chuyên',
      'dùng cho van điện từ',
      'Màng van khí nén',
      'chất liệu cao su',
      'ghi chú lạ'
    ]);
    expect(clauses.at(-1).preTypeHint).toBe('unknown');
    expect(new Set(clauses.map((item) => item.id)).size).toBe(clauses.length);
  });
});

describe('material guard', () => {
  it.each([
    ['Ốp bằng nhựa TPU', ['tpu']],
    ['Vỏ bằng inox', ['stainless_steel']],
    ['Chi tiết bằng nhựa kết hợp hợp kim nhôm', ['aluminum', 'plastic']]
  ])('extracts explicit VI material from %s', (value, expected) => {
    expect(extractVietnameseMaterials(value)).toEqual(expected);
  });

  it('normalizes English material synonyms', () => {
    expect(extractEnglishMaterials('Aluminium housing with PVC cover')).toEqual(['pvc', 'aluminum']);
  });

  it.each([
    ['Ốp bằng nhựa TPU', 'Phone case', ['tpu'], [], false],
    ['Ốp bằng nhựa TPU', 'TPU phone case', [], [], false],
    ['Ốp bằng nhựa TPU', 'Glass phone case', ['tpu'], ['glass'], true],
    ['Ốp điện thoại', 'Glass phone case', [], ['glass'], false],
    ['Vỏ nhựa kết hợp hợp kim nhôm', 'Aluminum housing', ['plastic'], [], false]
  ])('audits %s / %s bidirectionally', (vi, en, missing, unsupported, contradiction) => {
    expect(inspectMaterialCoverage(vi, en)).toMatchObject({
      missingFromEnglish: missing,
      unsupportedInEnglish: unsupported,
      contradiction
    });
  });

  it('does not infer glass from the Vietnamese marketing term cường lực', () => {
    expect(extractVietnameseMaterials('Miếng dán cường lực, chất liệu nhựa TPU')).toEqual(['tpu']);
  });

  it('does not confuse Vietnamese electrical/usage words with copper, leather, or ceramic', () => {
    expect(extractVietnameseMaterials('Đồng hồ đo dòng điện, đã qua sử dụng')).toEqual([]);
  });

  it('keeps alloy specificity instead of overclaiming material equivalence', () => {
    expect(inspectMaterialCoverage('Vỏ bằng thép không gỉ', 'Steel housing')).toMatchObject({
      missingFromEnglish: ['stainless_steel'],
      unsupportedInEnglish: [],
      contradiction: false
    });
    expect(inspectMaterialCoverage('Chi tiết bằng hợp kim đồng', 'Copper part')).toMatchObject({
      missingFromEnglish: ['copper_alloy'],
      unsupportedInEnglish: [],
      contradiction: false
    });
  });
});
