// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';

import EnglishNameCheckerApp from '@/components/english-name-checker-app';

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

describe('EnglishNameCheckerApp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses locally, deduplicates checks, and renders the attention table', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockImplementation(async (_url, options) => {
      const payload = JSON.parse(options.body);

      return {
        ok: true,
        json: async () => ({
          results: payload.rows.map((row) =>
            row.productNameEn
              ? {
                  rowId: row.rowId,
                  status: 'Sai rõ',
                  reason: 'Tên hiện tại mô tả máy hoàn chỉnh.',
                  suggestedName: 'Pump impeller'
                }
              : {
                  rowId: row.rowId,
                  status: 'Thiếu dữ liệu',
                  reason: 'Thiếu "Tên TA".',
                  suggestedName: 'Projector stand'
                }
          )
        })
      };
    });

    render(<EnglishNameCheckerApp />);
    await user.upload(screen.getByLabelText('File Excel kiểm tra Tên TA'), await createUploadFile());

    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText('dòng hàng hóa trên 1 sheet')).toBeInTheDocument();
    expect(screen.getByText('Cột ẩn ✓')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bắt đầu đối chiếu' }));

    expect(await screen.findByRole('heading', { name: 'Kết quả kiểm tra Tên TA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cần chú ý (3)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('Pump impeller')).toHaveLength(2);
    expect(screen.getByText('Projector stand')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [, requestOptions] = global.fetch.mock.calls[0];
    const requestPayload = JSON.parse(requestOptions.body);
    expect(requestPayload.rows).toHaveLength(2);
    expect(requestOptions.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(requestOptions.body).not.toContain('UEsDB');

    await waitFor(() => {
      expect(screen.getByText('Hiển thị 3 / 3 dòng')).toBeInTheDocument();
    });
  });
});
