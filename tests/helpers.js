import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as XLSX from 'xlsx';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(TEST_DIR, 'fixtures');

export async function createSamplePdfBuffer(lines) {
  const pdfDocument = await PDFDocument.create();
  const page = pdfDocument.addPage([595, 842]);
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica);

  let currentY = 780;

  for (const line of lines) {
    page.drawText(line, {
      x: 42,
      y: currentY,
      size: 11,
      font
    });

    currentY -= 20;
  }

  return Buffer.from(await pdfDocument.save());
}

export async function createSampleFormEPdfBuffer(rows) {
  const pdfDocument = await PDFDocument.create();
  const page = pdfDocument.addPage([700, 900]);
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica);

  const headerRows = [24, 24, 24];
  const headerRowHeight = 42;
  const dataRowHeight = Math.max(110, rows.length * 16 + 20);
  const rowHeights = [...headerRows, headerRowHeight, dataRowHeight];
  const colWidths = [60, 80, 250, 80, 70, 100];
  const left = 40;
  const top = 820;
  const totalWidth = colWidths.reduce((sum, value) => sum + value, 0);
  const totalHeight = rowHeights.reduce((sum, value) => sum + value, 0);

  let y = top;

  for (let rowIndex = 0; rowIndex <= rowHeights.length; rowIndex += 1) {
    page.drawLine({
      start: { x: left, y },
      end: { x: left + totalWidth, y },
      thickness: 1,
      color: rgb(0, 0, 0)
    });
    y -= rowHeights[rowIndex] ?? 0;
  }

  let x = left;

  for (let columnIndex = 0; columnIndex <= colWidths.length; columnIndex += 1) {
    page.drawLine({
      start: { x, y: top },
      end: { x, y: top - totalHeight },
      thickness: 1,
      color: rgb(0, 0, 0)
    });
    x += colWidths[columnIndex] ?? 0;
  }

  const cells = [
    ['', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    [
      '5.item',
      '6.Marks',
      '7.Number and type of packages, description of products',
      '8.Origin criteria',
      '9.Gross weight',
      '10.Number'
    ],
    [
      rows.map((row) => String(row.itemNumber)).join('\n'),
      'N/M',
      rows.map((row) => `${row.itemName} HS CODE : ${row.hsCode}`).join('\n'),
      rows.map((row) => row.origin ?? 'WO').join('\n'),
      rows.map((row) => row.origin ?? 'CN').join('\n'),
      rows.map((row) => `${row.quantity} ${row.unit}`).join('\n')
    ]
  ];

  let rowTop = top;

  for (let rowIndex = 0; rowIndex < cells.length; rowIndex += 1) {
    let cellLeft = left;

    for (let columnIndex = 0; columnIndex < colWidths.length; columnIndex += 1) {
      const text = cells[rowIndex][columnIndex] ?? '';
      const lines = text.split('\n');

      lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: cellLeft + 4,
          y: rowTop - 14 - lineIndex * 12,
          size: 8,
          font,
          color: rgb(0, 0, 0)
        });
      });

      cellLeft += colWidths[columnIndex];
    }

    rowTop -= rowHeights[rowIndex];
  }

  return Buffer.from(await pdfDocument.save());
}

export function createSampleExcelBuffer(rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hang hoa');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export async function readFixtureBuffer(fileName) {
  return readFile(path.join(FIXTURES_DIR, fileName));
}
