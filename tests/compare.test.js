import { compareDeclarations } from '@/lib/compare';
import { ROW_STATUS } from '@/lib/constants';
import { createDeclarationRow } from '@/lib/declaration';

function buildRow(source, rowNumber, overrides) {
  return createDeclarationRow(
    source,
    {
      hsCode: '84713020',
      itemName: 'Laptop Dell Latitude',
      unit: 'Cái',
      quantity: '10',
      ...overrides
    },
    rowNumber
  );
}

describe('compareDeclarations', () => {
  it('marks a perfect match', () => {
    const { rows, summary } = compareDeclarations([buildRow('excel', 2, {})], [buildRow('pdf', 1, {})]);

    expect(rows[0].status).toBe(ROW_STATUS.MATCH);
    expect(summary.matchCount).toBe(1);
  });

  it('treats Excel abbreviations and PDF full unit names as the same unit', () => {
    const { rows } = compareDeclarations(
      [buildRow('excel', 2, { unit: 'PCE' })],
      [buildRow('pdf', 1, { unit: 'PIECES' })]
    );

    expect(rows[0].status).toBe(ROW_STATUS.MATCH);
    expect(rows[0].fields.unit.status).toBe('match');
  });

  it('matches KGM in Excel with KGS N.W. in PDF', () => {
    const { rows } = compareDeclarations(
      [buildRow('excel', 2, { unit: 'KGM' })],
      [buildRow('pdf', 1, { unit: 'KGS N.W.' })]
    );

    expect(rows[0].status).toBe(ROW_STATUS.MATCH);
    expect(rows[0].fields.unit.status).toBe('match');
  });

  it('marks mismatch when quantity differs', () => {
    const { rows } = compareDeclarations(
      [buildRow('excel', 2, { quantity: '10' })],
      [buildRow('pdf', 1, { quantity: '12' })]
    );

    expect(rows[0].status).toBe(ROW_STATUS.MISMATCH);
    expect(rows[0].fields.quantity.status).toBe('mismatch');
  });

  it('marks missing rows in excel', () => {
    const { rows } = compareDeclarations([], [buildRow('pdf', 1, {})]);

    expect(rows[0].status).toBe(ROW_STATUS.MISSING_IN_EXCEL);
  });

  it('marks missing rows in pdf', () => {
    const { rows } = compareDeclarations([buildRow('excel', 2, {})], []);

    expect(rows[0].status).toBe(ROW_STATUS.MISSING_IN_PDF);
  });

  it('marks duplicated hs codes', () => {
    const excelRows = [buildRow('excel', 2, {}), buildRow('excel', 3, {})];
    const pdfRows = [buildRow('pdf', 1, {})];
    const { rows } = compareDeclarations(excelRows, pdfRows);

    expect(rows[0].status).toBe(ROW_STATUS.DUPLICATE_HSCODE);
  });

  it('marks parse errors when a row is missing required data', () => {
    const { rows } = compareDeclarations(
      [buildRow('excel', 2, {})],
      [buildRow('pdf', 1, { hsCode: '' })]
    );

    expect(rows[0].status).toBe(ROW_STATUS.PARSE_ERROR);
    expect(rows[0].reason).toContain('Thiếu hoặc không đọc được HS code.');
  });
});
