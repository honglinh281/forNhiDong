import { extractPdfRows } from '@/lib/pdf';

import { createSampleFormEPdfBuffer, createSamplePdfBuffer, readFixtureBuffer } from './helpers';

describe('extractPdfRows', () => {
  it('extracts rows from a Form E pdfplumber fixture', async () => {
    const pdfBuffer = await createSampleFormEPdfBuffer([
      {
        itemNumber: 1,
        itemName: "WOMEN'S LONG-SLEEVED PULLOVER",
        hsCode: '6211.43',
        quantity: '10',
        unit: 'PCE'
      },
      {
        itemNumber: 2,
        itemName: 'BROOCH',
        hsCode: '8308.90',
        quantity: '950',
        unit: 'PCE'
      }
    ]);

    const result = await extractPdfRows(pdfBuffer);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].normalized.hsCode).toBe('621143');
    expect(result.rows[0].normalized.itemName).toBe("women's long-sleeved pullover");
    expect(result.rows[1].normalized.unit).toBe('piece');
    expect(result.rows[1].normalized.quantity).toBe('950');
  });

  it('extracts structured rows from the real sample PDF fixture', async () => {
    const fixtureBuffer = await readFixtureBuffer('E26MABRTK4BX0222_nháp.pdf');

    const result = await extractPdfRows(fixtureBuffer);

    expect(result.rows.length).toBeGreaterThan(100);
    expect(result.rows[0].normalized.hsCode).toBe('621143');
  });

  it('fails clearly when the PDF has no extractable item rows', async () => {
    const pdfBuffer = await createSamplePdfBuffer(['ASEAN-CHINA FREE TRADE AREA', 'FORM E']);

    await expect(extractPdfRows(pdfBuffer)).rejects.toThrow('Không tìm thấy dòng hàng hóa nào trong PDF Form E.');
  });
});
