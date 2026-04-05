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
    const excelRows = [buildRow('excel', 50, {}), buildRow('excel', 51, {})];
    const pdfRows = [buildRow('pdf', 49, {})];
    const { rows, summary } = compareDeclarations(excelRows, pdfRows);

    expect(rows[0].status).toBe(ROW_STATUS.DUPLICATE_HSCODE);
    expect(rows[0].reason).toContain('HS code 84713020 bị trùng');
    expect(summary.duplicateCount).toBe(1);
  });

  it('sorts rows by pdf order before excel-only rows', () => {
    const excelRows = [
      buildRow('excel', 10, { hsCode: '85044090', itemName: 'Bo sac laptop' }),
      buildRow('excel', 12, { hsCode: '392610', itemName: 'Lanyard' }),
      buildRow('excel', 13, { hsCode: '392610', itemName: 'Lanyard 2' }),
      buildRow('excel', 20, { hsCode: '999999', itemName: 'Excel only row' })
    ];
    const pdfRows = [
      buildRow('pdf', 49, { hsCode: '392610', itemName: 'Lanyard' }),
      buildRow('pdf', 3, { hsCode: '85044090', itemName: 'Bo sac laptop', quantity: '12' })
    ];
    const { rows } = compareDeclarations(excelRows, pdfRows);

    expect(rows.map((row) => row.pdf?.rowNumber ?? null)).toEqual([3, 49, null]);
    expect(rows[0].status).toBe(ROW_STATUS.MISMATCH);
    expect(rows[1].status).toBe(ROW_STATUS.DUPLICATE_HSCODE);
    expect(rows[2].status).toBe(ROW_STATUS.MISSING_IN_PDF);
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
