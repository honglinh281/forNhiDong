import { compareDeclarations } from '@/lib/compare';
import { ROW_STATUS } from '@/lib/constants';
import { createDeclarationRow } from '@/lib/declaration';

function buildRow(source, rowNumber, overrides) {
  const { meta = {}, ...fieldOverrides } = overrides;

  return createDeclarationRow(
    source,
    {
      hsCode: '84713020',
      itemName: 'Laptop Dell Latitude',
      unit: 'Cái',
      quantity: '10',
      ...fieldOverrides
    },
    rowNumber,
    meta
  );
}

describe('compareDeclarations', () => {
  it('marks a perfect match even when rows are paired by fuzzy logic instead of HS key', () => {
    const { rows, summary } = compareDeclarations(
      [buildRow('excel', 2, { hsCode: '11111111' })],
      [buildRow('pdf', 1, { hsCode: '11111111' })]
    );

    expect(rows[0].status).toBe(ROW_STATUS.MATCH);
    expect(rows[0].matchScore).toBe(100);
    expect(summary.matchCount).toBe(1);
  });

  it('uses sequence key as the primary key when both files carry aligned STT', () => {
    const excelRows = [
      buildRow('excel', 2, {
        itemName: 'Ao thun',
        quantity: '10',
        meta: { sequenceKey: '1' }
      }),
      buildRow('excel', 3, {
        itemName: 'Quan jean',
        quantity: '5',
        meta: { sequenceKey: '2' }
      })
    ];
    const pdfRows = [
      buildRow('pdf', 1, {
        itemName: 'Quan jean',
        quantity: '10',
        meta: { sequenceKey: '1' }
      }),
      buildRow('pdf', 2, {
        itemName: 'Ao thun',
        quantity: '5',
        meta: { sequenceKey: '2' }
      })
    ];

    const { rows } = compareDeclarations(excelRows, pdfRows);

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === ROW_STATUS.MISMATCH)).toBe(true);
    expect(rows[0].pdf?.rowNumber).toBe(1);
    expect(rows[0].excel?.rowNumber).toBe(2);
  });

  it('treats Excel abbreviations and PDF full unit names as the same unit', () => {
    const { rows } = compareDeclarations(
      [buildRow('excel', 2, { unit: 'PCE', hsCode: '621143' })],
      [buildRow('pdf', 1, { unit: 'PIECES', hsCode: '621143' })]
    );

    expect(rows[0].status).toBe(ROW_STATUS.MATCH);
    expect(rows[0].fields.unit.status).toBe('match');
  });

  it('allows configured HS mapping rules after a successful fuzzy match', () => {
    const { rows, summary } = compareDeclarations(
      [buildRow('excel', 2, { hsCode: '853649', itemName: 'Relay control module' })],
      [buildRow('pdf', 1, { hsCode: '853690', itemName: 'Relay control module' })],
      {
        hsCodeMappingRules: [
          {
            excel: '853649',
            pdf: '853690',
            description: 'Rule lách HS đã được nghiệp vụ phê duyệt'
          }
        ]
      }
    );

    expect(rows[0].status).toBe(ROW_STATUS.MATCH_WITH_HS_RULE);
    expect(rows[0].fields.hsCode.status).toBe('rule-match');
    expect(summary.matchCount).toBe(1);
    expect(summary.matchWithHsRuleCount).toBe(1);
  });

  it('flags HS code mismatch after pairing on item name, quantity and unit', () => {
    const { rows } = compareDeclarations(
      [buildRow('excel', 2, { hsCode: '85044090', itemName: 'Adapter 65W USB-C' })],
      [buildRow('pdf', 1, { hsCode: '392610', itemName: 'Adapter 65W USB C' })]
    );

    expect(rows[0].status).toBe(ROW_STATUS.MISMATCH);
    expect(rows[0].reason).toBe('Sai lệch tại: HS code.');
    expect(rows[0].fields.hsCode.status).toBe('mismatch');
  });

  it('does not treat missing HS code as a parse error if the row can still be paired', () => {
    const { rows } = compareDeclarations(
      [buildRow('excel', 2, { hsCode: '' })],
      [buildRow('pdf', 1, { hsCode: '84713020' })]
    );

    expect(rows[0].status).toBe(ROW_STATUS.MISMATCH);
    expect(rows[0].reason).toBe('Sai lệch tại: HS code.');
  });

  it('marks missing rows in excel when no PDF line reaches the threshold', () => {
    const { rows } = compareDeclarations([], [buildRow('pdf', 1, {})]);

    expect(rows[0].status).toBe(ROW_STATUS.MISSING_IN_EXCEL);
  });

  it('marks missing rows in pdf when no PDF line reaches the threshold', () => {
    const { rows } = compareDeclarations([buildRow('excel', 2, {})], []);

    expect(rows[0].status).toBe(ROW_STATUS.MISSING_IN_PDF);
  });

  it('treats quantity mismatch as a mismatch row instead of two missing rows', () => {
    const { rows, summary } = compareDeclarations(
      [buildRow('excel', 2, { quantity: '10' })],
      [buildRow('pdf', 1, { quantity: '12' })]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(ROW_STATUS.MISMATCH);
    expect(rows[0].reason).toBe('Sai lệch tại: Số lượng.');
    expect(rows[0].fields.quantity.status).toBe('mismatch');
    expect(summary.mismatchCount).toBe(1);
    expect(summary.errorCount).toBe(1);
  });

  it('uses a neutral message for truly missing rows without showing score details', () => {
    const { rows } = compareDeclarations([buildRow('excel', 2, { itemName: 'Excel only row' })], []);

    expect(rows[0].status).toBe(ROW_STATUS.MISSING_IN_PDF);
    expect(rows[0].reason).toBe('Không tìm thấy dòng PDF tương ứng cho "Excel only row".');
  });

  it('sorts rows by status priority and then by pdf order within the same status group', () => {
    const excelRows = [
      buildRow('excel', 10, { itemName: 'Adapter 65W USB-C', hsCode: '85044090' }),
      buildRow('excel', 12, { itemName: 'Cable marker', hsCode: '392610' }),
      buildRow('excel', 20, { itemName: 'Excel only row', hsCode: '999999' })
    ];
    const pdfRows = [
      buildRow('pdf', 49, { itemName: 'Cable marker', hsCode: '123456' }),
      buildRow('pdf', 3, { itemName: 'Adapter 65W USB C', hsCode: '392610' })
    ];

    const { rows } = compareDeclarations(excelRows, pdfRows);

    expect(rows.map((row) => [row.status, row.pdf?.rowNumber ?? null])).toEqual([
      [ROW_STATUS.MISMATCH, 3],
      [ROW_STATUS.MISMATCH, 49],
      [ROW_STATUS.MISSING_IN_PDF, null]
    ]);
  });

  it('marks parse errors when a row is missing a required matching field', () => {
    const { rows } = compareDeclarations(
      [buildRow('excel', 2, { itemName: '' })],
      [buildRow('pdf', 1, {})]
    );

    expect(rows[0].status).toBe(ROW_STATUS.PARSE_ERROR);
    expect(rows[0].reason).toContain('Thiếu tên hàng.');
  });
});
