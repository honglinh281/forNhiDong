import { NextResponse } from 'next/server';

import { compareDeclarations } from '@/lib/compare';
import { EXCEL_EXTENSIONS, PDF_EXTENSIONS } from '@/lib/constants';
import { extractExcelRows } from '@/lib/excel';
import { hasAllowedExtension } from '@/lib/normalize';
import { extractPdfRows, mapPdfPlumberPayloadToResult } from '@/lib/pdf';

export const runtime = 'nodejs';

function badRequest(message) {
  return NextResponse.json({ message }, { status: 400 });
}

function isFileLike(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.name === 'string' &&
      typeof value.arrayBuffer === 'function'
  );
}

function shouldUseVercelPythonApi() {
  return process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
}

async function extractPdfRowsViaVercelPythonApi(request, pdfFile) {
  const formData = new FormData();
  formData.set('pdfFile', pdfFile);

  const endpoint = new URL('/api/parse-pdf', request.url);
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
    cache: 'no-store'
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Không gọi được dịch vụ parser PDF trên Vercel.');
  }

  const parsed = mapPdfPlumberPayloadToResult(payload);

  if (!parsed) {
    throw new Error('Không tìm thấy dòng hàng hóa nào trong PDF Form E.');
  }

  return parsed;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const excelFile = formData.get('excelFile');
    const pdfFile = formData.get('pdfFile');

    if (!isFileLike(excelFile) || !isFileLike(pdfFile)) {
      return badRequest('Vui lòng tải lên đầy đủ file Excel và file PDF.');
    }

    if (!hasAllowedExtension(excelFile.name, EXCEL_EXTENSIONS)) {
      return badRequest('File Excel phải có định dạng .xlsx, .xls hoặc .csv.');
    }

    if (!hasAllowedExtension(pdfFile.name, PDF_EXTENSIONS)) {
      return badRequest('File tờ khai phải có định dạng .pdf.');
    }

    const excelArrayBuffer = await excelFile.arrayBuffer();
    const excelResult = extractExcelRows(excelArrayBuffer);
    const pdfResult = shouldUseVercelPythonApi()
      ? await extractPdfRowsViaVercelPythonApi(request, pdfFile)
      : await extractPdfRows(await pdfFile.arrayBuffer());
    const comparison = compareDeclarations(excelResult.rows, pdfResult.rows);

    return NextResponse.json({
      summary: comparison.summary,
      rows: comparison.rows,
      parserWarnings: [...excelResult.warnings, ...pdfResult.warnings]
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Không thể xử lý cặp file vừa tải lên.');
  }
}
