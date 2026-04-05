// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CustomsCheckerApp from '@/components/customs-checker-app';

describe('CustomsCheckerApp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows validation when wrong file types are selected', async () => {
    const user = userEvent.setup({ applyAccept: false });

    render(<CustomsCheckerApp />);

    await user.upload(screen.getByLabelText('File Excel chuẩn'), new File(['demo'], 'sai.txt', { type: 'text/plain' }));
    await user.upload(screen.getByLabelText('File PDF tờ khai'), new File(['demo'], 'sai.docx', { type: 'application/octet-stream' }));
    await user.click(screen.getByRole('button', { name: 'Bắt đầu đối chiếu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('File chuẩn phải là .xlsx, .xls hoặc .csv.');
  });

  it('renders comparison result from the API response', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: {
          totalRows: 3,
          matchCount: 1,
          mismatchCount: 1,
          missingInExcelCount: 0,
          missingInPdfCount: 0,
          duplicateCount: 0,
          parseErrorCount: 1,
          errorCount: 2
        },
        parserWarnings: ['PDF parser: đang dùng pdfplumber cho template Form E.'],
        rows: [
          {
            id: 'row-0',
            hsCode: '85044090',
            status: 'MATCH',
            reason: 'Dữ liệu khớp hoàn toàn.',
            pdf: { rowNumber: 3 },
            excel: { rowNumber: 4 },
            fields: {
              itemName: {
                status: 'match',
                pdfValue: 'Bo sac laptop',
                excelValue: 'Bo sac laptop'
              },
              unit: {
                status: 'match',
                pdfValue: 'BO',
                excelValue: 'BO'
              },
              quantity: {
                status: 'match',
                pdfValue: '5',
                excelValue: '5'
              }
            }
          },
          {
            id: 'row-parse-error',
            hsCode: '',
            status: 'PARSE_ERROR',
            reason: 'Thiếu hoặc không đọc được HS code.',
            pdf: { rowNumber: 6 },
            excel: null,
            fields: {
              itemName: {
                status: 'error',
                pdfValue: 'Lanyard',
                excelValue: ''
              },
              unit: {
                status: 'missing',
                pdfValue: 'SETS',
                excelValue: ''
              },
              quantity: {
                status: 'missing',
                pdfValue: '10',
                excelValue: ''
              }
            }
          },
          {
            id: 'row-1',
            hsCode: '84713020',
            status: 'MISMATCH',
            reason: 'Sai lệch tại: Số lượng.',
            pdf: { rowNumber: 1 },
            excel: { rowNumber: 2 },
            fields: {
              itemName: {
                status: 'match',
                pdfValue: 'Laptop Dell Latitude',
                excelValue: 'Laptop Dell Latitude'
              },
              unit: {
                status: 'match',
                pdfValue: 'Cái',
                excelValue: 'Cái'
              },
              quantity: {
                status: 'mismatch',
                pdfValue: '12',
                excelValue: '10'
              }
            }
          }
        ]
      })
    });

    render(<CustomsCheckerApp />);

    await user.upload(
      screen.getByLabelText('File Excel chuẩn'),
      new File(['demo'], 'hang-hoa.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
    );
    await user.upload(screen.getByLabelText('File PDF tờ khai'), new File(['demo'], 'to-khai.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Bắt đầu đối chiếu' }));

    expect(await screen.findByText('Kết quả đối chiếu')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/compare',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      })
    );
    expect(screen.getByText('84713020')).toBeInTheDocument();
    expect(screen.getByText('85044090')).toBeInTheDocument();
    expect(screen.getByText('Không đọc được')).toBeInTheDocument();
    expect(screen.getByText('Sai lệch tại: Số lượng.')).toBeInTheDocument();

    const warningDisclosure = screen.getByText('Cảnh báo server (1)').closest('details');
    expect(warningDisclosure).not.toHaveAttribute('open');

    await user.click(screen.getByText('Cảnh báo server (1)'));
    expect(warningDisclosure).toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: 'Hiển thị sai lệch' }));
    expect(screen.queryByText('85044090')).not.toBeInTheDocument();
    expect(screen.getByText('84713020')).toBeInTheDocument();
    expect(screen.queryByText('Không đọc được')).not.toBeInTheDocument();
  });

  it('shows the loading animation in the results area while comparing files', async () => {
    const user = userEvent.setup();
    let resolveFetch;

    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    render(<CustomsCheckerApp />);

    await user.upload(
      screen.getByLabelText('File Excel chuẩn'),
      new File(['demo'], 'hang-hoa.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
    );
    await user.upload(screen.getByLabelText('File PDF tờ khai'), new File(['demo'], 'to-khai.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Bắt đầu đối chiếu' }));

    expect(await screen.findByTitle('Hiệu ứng loading đối chiếu')).toBeInTheDocument();
    expect(screen.getByText('Đang xử lý dữ liệu đối chiếu')).toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => ({
        summary: {
          totalRows: 0,
          matchCount: 0,
          mismatchCount: 0,
          missingInExcelCount: 0,
          missingInPdfCount: 0,
          duplicateCount: 0,
          parseErrorCount: 0,
          errorCount: 0
        },
        parserWarnings: [],
        rows: []
      })
    });

    await waitFor(() => {
      expect(screen.queryByTitle('Hiệu ứng loading đối chiếu')).not.toBeInTheDocument();
    });
  });
});
