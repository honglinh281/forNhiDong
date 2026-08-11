// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';

import EnglishNameCheckerApp from '@/components/english-name-checker-app';
import { AUDIT_BATCH_SIZE } from '@/lib/english-checker/constants';

async function createUploadFile() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Hàng hóa');
  worksheet.addRow(['STT', 'Tên hàng hóa XNK', 'Tên TA', 'Mã HS']);
  worksheet.addRow([1, 'Cánh bơm', 'Water pump', '84139190']);
  worksheet.addRow([2, ' CÁNH BƠM ', ' water   pump ', '84139190']);
  worksheet.addRow([3, 'Giá đỡ máy chiếu', null, '96200030']);
  worksheet.getColumn(3).hidden = true;
  const output = await workbook.xlsx.writeBuffer();
  const bytes = output instanceof Uint8Array ? output : new Uint8Array(output);
  const file = new File([bytes], 'hang-hoa.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  if (!file.arrayBuffer) {
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    });
  }
  return file;
}

function auditFor(item) {
  const missingEnglish = !item.currentEnglish;
  const pump = item.originalVietnamese.toLowerCase().includes('cánh bơm');
  const canonicalEnglishName = pump ? 'Pump impeller' : 'Projector stand';
  return {
    rowId: item.rowId,
    canonicalEnglishName,
    productIdentity: {
      vietnamese: pump ? 'pump impeller' : 'projector stand',
      english: item.currentEnglish,
      relation: missingEnglish ? 'uncertain' : pump ? 'different' : 'equivalent'
    },
    clauseAudits: item.clauses.map((inputClause) => ({
      clauseId: inputClause.id,
      clauseText: inputClause.text,
      clauseType: inputClause.preTypeHint === 'unknown' ? 'other' : inputClause.preTypeHint,
      normalizedFact: canonicalEnglishName,
      identityDefining: inputClause.id === 'C1',
      evidenceImportance: inputClause.id === 'C1' ? 'critical' : 'supporting',
      englishCoverage: missingEnglish ? 'missing' : pump ? 'contradiction' : 'semantic_equivalent',
      englishEvidence: missingEnglish ? null : item.currentEnglish,
      note: null
    })),
    englishClaims: [],
    unresolvedCriticalFacts: missingEnglish ? ['English name missing'] : [],
    overallConfidence: missingEnglish ? 0.9 : 0.97
  };
}

function successResponse(options) {
  const payload = JSON.parse(options.body);
  return {
    ok: true,
    status: 200,
    json: async () => ({
      requestId: payload.requestId,
      items: payload.items.map(auditFor),
      meta: { model: 'test-model', durationMs: 12 }
    })
  };
}

describe('EnglishNameCheckerApp micro-audit orchestration', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses three rows per micro batch', () => {
    expect(AUDIT_BATCH_SIZE).toBe(3);
  });

  it('parses locally, deduplicates, calls /api/audit, and renders deterministic results', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(async (_url, options) => successResponse(options));
    render(<EnglishNameCheckerApp />);
    await user.upload(screen.getByLabelText('File Excel kiểm tra Tên TA'), await createUploadFile());

    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText('dòng hàng hóa trên 1 sheet')).toBeInTheDocument();
    expect(screen.getByText('Cột ẩn ✓')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bắt đầu kiểm tra' }));

    expect(await screen.findByRole('heading', { name: 'Kết quả kiểm tra Tên TA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cần chú ý (3)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('Pump impeller')).toHaveLength(2);
    expect(screen.getByText('Projector stand')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, requestOptions] = global.fetch.mock.calls[0];
    const requestPayload = JSON.parse(requestOptions.body);
    expect(url).toBe('/api/audit');
    expect(requestPayload.items).toHaveLength(2);
    expect(requestPayload.items[0].clauses.length).toBeGreaterThan(0);
    expect(requestOptions.body).not.toContain('UEsDB');
    await waitFor(() => expect(screen.getByText('Hiển thị 3 / 3 dòng')).toBeInTheDocument());
  });

  it('splits a timed-out batch and completes the remaining micro tasks', async () => {
    const user = userEvent.setup();
    let call = 0;
    global.fetch = vi.fn(async (_url, options) => {
      call += 1;
      if (call === 1) {
        return {
          ok: false,
          status: 504,
          json: async () => ({
            error: { code: 'AUDIT_TIMEOUT', message: 'soft timeout', retryable: true }
          })
        };
      }
      return successResponse(options);
    });

    render(<EnglishNameCheckerApp />);
    await user.upload(screen.getByLabelText('File Excel kiểm tra Tên TA'), await createUploadFile());
    expect(await screen.findByText('dòng hàng hóa trên 1 sheet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bắt đầu kiểm tra' }));

    expect(await screen.findByRole('heading', { name: 'Kết quả kiểm tra Tên TA' })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(screen.queryByText('Kết quả một phần')).not.toBeInTheDocument();
  });
});
