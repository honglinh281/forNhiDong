'use client';

import { useDeferredValue, useState, useTransition } from 'react';

import { EXCEL_EXTENSIONS, PDF_EXTENSIONS, ROW_STATUS, STATUS_LABELS } from '@/lib/constants';
import { hasAllowedExtension } from '@/lib/normalize';

const FIGMA_EXCEL_ICON = 'https://www.figma.com/api/mcp/asset/c0c0160d-c929-49b2-acf9-5cbff18bdc52';
const FIGMA_PDF_ICON = 'https://www.figma.com/api/mcp/asset/b97f5cee-d22d-42d4-be6c-2f63caf6349d';

function ComparisonCell({ field }) {
  return (
    <div className={`comparison-block field-${field.status}`}>
      <div className="field-line">
        <strong>PDF:</strong>
        <span>{field.pdfValue || 'Trống'}</span>
      </div>
      <div className="field-line">
        <strong>Excel:</strong>
        <span>{field.excelValue || 'Trống'}</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = 'neutral' }) {
  return (
    <article className={`summary-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function FileBadge({ fileName, iconSrc }) {
  return (
    <div className="file-badge">
      <img alt="" aria-hidden="true" className="file-badge-icon" src={iconSrc} />
      <span>{fileName}</span>
    </div>
  );
}

function FileDropCard({
  accept,
  ariaLabel,
  dragActive,
  file,
  helpText,
  iconSrc,
  inputId,
  title,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileChange
}) {
  return (
    <label
      className={`upload-slot ${dragActive ? 'is-drag-active' : ''}`}
      htmlFor={inputId}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        accept={accept}
        aria-label={ariaLabel}
        className="visually-hidden"
        id={inputId}
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        type="file"
      />

      <span className="upload-slot-title">{title}</span>

      <div className="upload-slot-body">
        <img alt="" aria-hidden="true" className="upload-slot-icon" src={iconSrc} />

        <div className="upload-slot-copy">
          <p className="upload-slot-instruction">
            <strong>Kéo file vào</strong>
            <span>hoặc</span>
            <span className="upload-slot-button">Tải lên file</span>
          </p>
          <p className="upload-slot-help">{helpText}</p>
        </div>
      </div>

      <p className={`upload-slot-name ${file ? 'has-file' : ''}`}>{file?.name ?? 'Chưa chọn file'}</p>
    </label>
  );
}

function getVisibleRows(rows, showOnlyErrors) {
  if (!showOnlyErrors) {
    return rows;
  }

  return rows.filter((row) => row.status === ROW_STATUS.MISMATCH);
}

function getNoticeMessage({ errorMessage, excelFile, isSubmitting, pdfFile, result }) {
  if (errorMessage) {
    return errorMessage;
  }

  if (isSubmitting) {
    return 'Hệ thống đang đọc và đối chiếu dữ liệu, chờ mình một chút nhé.';
  }

  if (result) {
    if (result.summary.errorCount === 0) {
      return 'Đối chiếu xong rồi, 2 file đang khớp hoàn toàn.';
    }

    return `Đã đối chiếu xong, còn ${result.summary.errorCount} dòng cần kiểm tra lại.`;
  }

  if (excelFile && pdfFile) {
    return 'Đã nhận đủ 2 file. Bấm "Bắt đầu đối chiếu" để kiểm tra nhé.';
  }

  return 'Tải lên file lên để bắt đầu đối chiếu nhé 😉';
}

export default function CustomsCheckerApp() {
  const [excelFile, setExcelFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [result, setResult] = useState(null);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dragTarget, setDragTarget] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const deferredRows = useDeferredValue(result?.rows ?? []);
  const visibleRows = getVisibleRows(deferredRows, showOnlyErrors);
  const noticeMessage = getNoticeMessage({ errorMessage, excelFile, isSubmitting, pdfFile, result });
  const isBusy = isSubmitting || isPending;

  function updateSelectedFile(kind, file) {
    if (kind === 'excel') {
      setExcelFile(file);
    } else {
      setPdfFile(file);
    }

    setResult(null);
    setShowOnlyErrors(false);
    setErrorMessage('');
  }

  function handleDragOver(kind, event) {
    event.preventDefault();
    setDragTarget(kind);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setDragTarget(null);
  }

  function handleDrop(kind, event) {
    event.preventDefault();
    setDragTarget(null);

    const [file] = event.dataTransfer.files ?? [];

    if (file) {
      updateSelectedFile(kind, file);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!excelFile || !pdfFile) {
      setErrorMessage('Cần chọn đủ 1 file Excel và 1 file PDF trước khi đối chiếu.');
      return;
    }

    if (!hasAllowedExtension(excelFile.name, EXCEL_EXTENSIONS)) {
      setErrorMessage('File chuẩn phải là .xlsx, .xls hoặc .csv.');
      return;
    }

    if (!hasAllowedExtension(pdfFile.name, PDF_EXTENSIONS)) {
      setErrorMessage('File đối chiếu phải là .pdf.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set('excelFile', excelFile);
    formData.set('pdfFile', pdfFile);

    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        body: formData
      });

      let payload = null;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        setResult(null);
        setErrorMessage(payload?.message ?? 'Có lỗi xảy ra khi đọc file.');
        return;
      }

      startTransition(() => {
        setResult(payload);
        setShowOnlyErrors(false);
      });
    } catch {
      setResult(null);
      setErrorMessage('Không thể kết nối tới dịch vụ đối chiếu. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const summaryCards = [
    {
      label: 'Tổng số dòng',
      tone: 'neutral',
      value: result ? result.summary.totalRows : '--'
    },
    {
      label: 'Khớp',
      tone: 'success',
      value: result ? result.summary.matchCount : '--'
    },
    {
      label: 'Sai lệch',
      tone: 'warning',
      value: result ? result.summary.errorCount : '--'
    }
  ];

  return (
    <main className="checker-page">
      <section className={`notice-strip ${errorMessage ? 'is-error' : ''}`}>{noticeMessage}</section>

      <section className="content-card upload-card">
        <div className="section-copy">
          <h1>Upload file đối chiếu</h1>
          <p>Chọn 1 file danh sách chuẩn và 1 file tờ khai PDF để hệ thống đối chiếu.</p>
          <p className="section-note">
            Các viết tắt đơn vị tính trong file Excel sẽ được quy đổi tự động theo bảng nghiệp vụ.
          </p>
        </div>

        <form className="upload-layout" onSubmit={handleSubmit}>
          <div className="upload-grid">
            <FileDropCard
              accept=".xlsx,.xls,.csv"
              ariaLabel="File Excel chuẩn"
              dragActive={dragTarget === 'excel'}
              file={excelFile}
              helpText="Hỗ trợ `.xlsx`, `.xls`, `.csv`"
              iconSrc={FIGMA_EXCEL_ICON}
              inputId="excel-upload-input"
              onDragLeave={handleDragLeave}
              onDragOver={(event) => handleDragOver('excel', event)}
              onDrop={(event) => handleDrop('excel', event)}
              onFileChange={(file) => updateSelectedFile('excel', file)}
              title="File Excel"
            />

            <FileDropCard
              accept=".pdf"
              ariaLabel="File PDF tờ khai"
              dragActive={dragTarget === 'pdf'}
              file={pdfFile}
              helpText="Ưu tiên PDF Form E text/vector ở phase hiện tại"
              iconSrc={FIGMA_PDF_ICON}
              inputId="pdf-upload-input"
              onDragLeave={handleDragLeave}
              onDragOver={(event) => handleDragOver('pdf', event)}
              onDrop={(event) => handleDrop('pdf', event)}
              onFileChange={(file) => updateSelectedFile('pdf', file)}
              title="File PDF tờ khai"
            />
          </div>

          <button className="start-button" disabled={isBusy} type="submit">
            {isBusy ? 'Đang đối chiếu...' : 'Bắt đầu đối chiếu'}
          </button>
        </form>

        {errorMessage ? (
          <p aria-live="polite" className="error-banner" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <section className="content-card results-card">
        <div className="results-header">
          <div className="section-copy">
            <h2>Kết quả đối chiếu</h2>
            <div className="result-file-row">
              <span>Hiển thị kết quả đối chiếu giữa 2 file:</span>
              <FileBadge fileName={excelFile?.name ?? 'Chưa chọn file Excel'} iconSrc={FIGMA_EXCEL_ICON} />
              <span>và</span>
              <FileBadge fileName={pdfFile?.name ?? 'Chưa chọn file PDF'} iconSrc={FIGMA_PDF_ICON} />
            </div>
          </div>

        </div>

        <div className="summary-grid">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} label={card.label} tone={card.tone} value={card.value} />
          ))}
        </div>

        {result ? (
          <>
            <div className="results-filter-bar">
              <button
                aria-pressed={showOnlyErrors}
                className={`filter-chip ${showOnlyErrors ? 'is-active' : ''}`}
                disabled={result.summary.errorCount === 0}
                onClick={() => setShowOnlyErrors((current) => !current)}
                type="button"
              >
                {showOnlyErrors ? 'Đang hiển thị dòng lỗi' : 'Hiển thị sai lệch'}
              </button>
            </div>

            <div className="table-caption">
              Hiển thị {visibleRows.length} / {result.rows.length} dòng
            </div>

            {result.parserWarnings?.length ? (
              <details className="warning-panel">
                <summary>Cảnh báo server ({result.parserWarnings.length})</summary>
                <ul>
                  {result.parserWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Trạng thái</th>
                    <th>HS Code</th>
                    <th>Tên hàng</th>
                    <th>Đơn vị tính</th>
                    <th>Số lượng</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => (
                    <tr
                      className={`${index % 2 === 1 ? 'is-alt-row' : ''} row-${row.status.toLowerCase()}`}
                      key={row.id}
                    >
                      <td>
                        <span className={`status-pill status-${row.status.toLowerCase()}`}>
                          {STATUS_LABELS[row.status] ?? row.status}
                        </span>
                      </td>
                      <td>
                        <div className="hs-block">
                          <strong>{row.hsCode || 'Không đọc được'}</strong>
                          <div className="hs-meta">
                            <span>PDF: Dòng {row.pdf?.rowNumber ?? '-'}</span>
                            <span>Excel: Dòng {row.excel?.rowNumber ?? '-'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <ComparisonCell field={row.fields.itemName} />
                      </td>
                      <td>
                        <ComparisonCell field={row.fields.unit} />
                      </td>
                      <td>
                        <ComparisonCell field={row.fields.quantity} />
                      </td>
                      <td>
                        <p className="row-reason">{row.reason}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>Chưa có kết quả để hiển thị. Tải 2 file lên rồi bấm đối chiếu để xem bảng chi tiết.</p>
          </div>
        )}
      </section>
    </main>
  );
}
