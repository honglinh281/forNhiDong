import { normalizeVietnameseDescription } from '@/lib/english-checker/normalize-vietnamese';

describe('Vietnamese description normalization', () => {
  it('expands boundary-delimited customs abbreviations without changing the original', () => {
    const result = normalizeVietnameseDescription(
      'BP chuyên dùng, sd thay thế, c/l cao su, kt 8mm, ko dùng điện, đ/áp 24V, dùng trong CN'
    );

    expect(result.original).toBe(
      'BP chuyên dùng, sd thay thế, c/l cao su, kt 8mm, ko dùng điện, đ/áp 24V, dùng trong CN'
    );
    expect(result.normalized).toBe(
      'Bộ phận chuyên dùng, sử dụng thay thế, chất liệu cao su, kích thước 8 mm, không dùng điện, điện áp 24 V, dùng trong công nghiệp'
    );
  });

  it('does not replace abbreviation fragments inside normal words', () => {
    expect(normalizeVietnameseDescription('Kẹp cố định bằng nhựa ABS').normalized).toBe(
      'Kẹp cố định bằng nhựa ABS'
    );
  });

  it('expands the diameter phrase used in the attached pneumatic-valve rows', () => {
    expect(normalizeVietnameseDescription('van có đk trong 8mm').normalized).toBe(
      'van có đường kính trong 8 mm'
    );
  });
});
