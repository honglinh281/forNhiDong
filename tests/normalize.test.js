import {
  normalizeHsCode,
  normalizeQuantity,
  normalizeText,
  normalizeUnit,
  safeNormalizeQuantity
} from '@/lib/normalize';

describe('normalize helpers', () => {
  it('normalizes hs code by keeping digits only', () => {
    expect(normalizeHsCode('84.71.30 20')).toBe('84713020');
  });

  it('normalizes text by trimming and lowercasing', () => {
    expect(normalizeText('  Bộ   Vi Xử Lý  ')).toBe('bộ vi xử lý');
  });

  it('normalizes unit aliases from the customs abbreviation sheet', () => {
    expect(normalizeUnit('PCE')).toBe('piece');
    expect(normalizeUnit('PIECES')).toBe('piece');
    expect(normalizeUnit('PIECE/PIECES')).toBe('piece');
    expect(normalizeUnit('PR')).toBe('pair');
    expect(normalizeUnit('PAIRS')).toBe('pair');
    expect(normalizeUnit('KGM')).toBe('kilogram_net');
    expect(normalizeUnit('KGS N.W.')).toBe('kilogram_net');
    expect(normalizeUnit('KGSN.W.')).toBe('kilogram_net');
    expect(normalizeUnit('MTR')).toBe('meter');
    expect(normalizeUnit('METERS')).toBe('meter');
    expect(normalizeUnit('MTK')).toBe('square_meter');
    expect(normalizeUnit('SQUARE METERS')).toBe('square_meter');
    expect(normalizeUnit('MTQ')).toBe('cubic_meter');
    expect(normalizeUnit('CUBIC METRES')).toBe('cubic_meter');
  });

  it('normalizes quantities across punctuation styles', () => {
    expect(normalizeQuantity('1.000')).toBe('1000');
    expect(normalizeQuantity('1,000')).toBe('1000');
    expect(normalizeQuantity('1000.00')).toBe('1000');
    expect(normalizeQuantity('1.234,50')).toBe('1234.5');
  });

  it('reports invalid quantity values', () => {
    expect(safeNormalizeQuantity('abc')).toEqual({
      normalized: '',
      error: 'Không đọc được số lượng từ giá trị "abc".'
    });
  });
});
