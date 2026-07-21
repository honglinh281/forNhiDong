'use client';

import { useDeferredValue, useMemo, useRef, useState } from 'react';

import {
  ENGLISH_CHECK_BATCH_SIZE,
  ENGLISH_CHECK_CONCURRENCY,
  ENGLISH_CHECK_EXTENSIONS,
  ENGLISH_CHECK_STATUS
} from '@/lib/english-checker/constants';
import {
  expandEnglishCheckResults,
  prepareEnglishChecks,
  sortEnglishCheckResults,
  summarizeEnglishCheckResults
} from '@/lib/english-checker/processing';
import { checkResponseSchema } from '@/lib/english-checker/schema';
import { readEnglishCheckWorkbook, writeEnglishCheckResults } from '@/lib/english-checker/workbook';
import { hasAllowedExtension } from '@/lib/normalize';

const EXCEL_ICON_SRC = '/figma/english-checker-xls.png';

const RESULT_FILTERS = [
  { value: 'attention', label: 'Cần chú ý' },
  { value: 'all', label: 'Tất cả' },
  { value: ENGLISH_CHECK_STATUS.WRONG, label: ENGLISH_CHECK_STATUS.WRONG },
  { value: ENGLISH_CHECK_STATUS.CLOSE, label: ENGLISH_CHECK_STATUS.CLOSE },
  { value: ENGLISH_CHECK_STATUS.MISSING, label: ENGLISH_CHECK_STATUS.MISSING }
];

function splitIntoBatches(rows, batchSize) {
  const batches = [];

  for (let index = 0; index < rows.length; index += batchSize) {
    batches.push(rows.slice(index, index + batchSize));
  }

  return batches;
}

async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
}

async function requestCheckBatch(rows, signal) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
        signal
      });
      let payload = null;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Không thể gọi dịch vụ kiểm tra Tên TA.');
      }

      return checkResponseSchema.parse(payload).results;
    } catch (error) {
      lastError = error;

      if (signal.aborted) {
        throw error;
      }
    }
  }

  throw lastError;
}

function FileSummary({ analysis }) {
  if (!analysis) {
    return null;
  }

  return (
    <div className="english-file-summary" aria-label="Thông tin workbook">
      <div className="english-file-total">
        <strong>{analysis.totalRows}</strong>
        <span>dòng hàng hóa trên {analysis.sheets.length} sheet</span>
      </div>

      <div className="english-sheet-list">
        {analysis.sheets.map((sheet) => (
          <div className="english-sheet-row" key={sheet.name}>
            <span>
              <strong>{sheet.name}</strong> · {sheet.rowCount} dòng
            </span>
            <span className="english-detection-badges">
              <span>Tên hàng hóa XNK ✓</span>
              <span>Tên TA ✓</span>
              {sheet.englishNameHidden ? <span>Cột ẩn ✓</span> : null}
              {sheet.englishNameDetection === 'hs-fallback' ? <span>Fallback trước Mã HS ✓</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnglishCheckLoading({ progress }) {
  const percent = progress.total ? Math.round((progress.resolved / progress.total) * 100) : 0;

  return (
    <section className="content-card english-progress-card" aria-live="polite">
      <div className="section-copy">
        <h2>Đang kiểm tra Tên TA</h2>
        <p>Đã xử lý {progress.resolved} / {progress.total} dòng</p>
      </div>
      <div
        aria-label={`Tiến độ ${percent}%`}
        aria-valuemax="100"
        aria-valuemin="0"
        aria-valuenow={percent}
        className="english-progress-track"
        role="progressbar"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="english-progress-note">
        Workbook vẫn nằm trong trình duyệt; server chỉ nhận các cặp tên cần kiểm tra.
      </p>
    </section>
  );
}

function ResultSummary({ summary }) {
  const cards = [
    { label: 'Tổng đã kiểm tra', value: summary.total, tone: 'neutral' },
    { label: 'OK', value: summary.ok, tone: 'ok' },
    { label: 'Chưa sát', value: summary.close, tone: 'close' },
    { label: 'Sai rõ', value: summary.wrong, tone: 'wrong' },
    { label: 'Thiếu dữ liệu', value: summary.missing, tone: 'missing' }
  ];

  return (
    <div className="english-summary-grid">
      {cards.map((card) => (
        <article className={`english-summary-card tone-${card.tone}`} key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </div>
  );
}

function filterResults(rows, filter) {
  if (filter === 'all') {
    return rows;
  }

  if (filter === 'attention') {
    return rows.filter((row) => row.status !== ENGLISH_CHECK_STATUS.OK);
  }

  return rows.filter((row) => row.status === filter);
}

function getFilterCount(summary, filter) {
  if (filter === 'all') return summary.total;
  if (filter === 'attention') return summary.close + summary.wrong + summary.missing;
  if (filter === ENGLISH_CHECK_STATUS.WRONG) return summary.wrong;
  if (filter === ENGLISH_CHECK_STATUS.CLOSE) return summary.close;
  if (filter === ENGLISH_CHECK_STATUS.MISSING) return summary.missing;
  return 0;
}

export default function EnglishNameCheckerApp() {
  const workbookRef = useRef(null);
  const fileRequestIdRef = useRef(0);
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [results, setResults] = useState([]);
  const [filter, setFilter] = useState('attention');
  const [dragActive, setDragActive] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState({ resolved: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState('');
  const [checkFailed, setCheckFailed] = useState(false);

  const deferredResults = useDeferredValue(results);
  const sortedResults = useMemo(() => sortEnglishCheckResults(deferredResults), [deferredResults]);
  const summary = useMemo(() => summarizeEnglishCheckResults(deferredResults), [deferredResults]);
  const visibleResults = useMemo(() => filterResults(sortedResults, filter), [filter, sortedResults]);
  const isParsing = phase === 'parsing';
  const isChecking = phase === 'checking';

  async function selectFile(nextFile) {
    const requestId = fileRequestIdRef.current + 1;
    fileRequestIdRef.current = requestId;
    setFile(nextFile);
    setAnalysis(null);
    setResults([]);
    setFilter('attention');
    setCheckFailed(false);
    setErrorMessage('');
    workbookRef.current = null;

    if (!nextFile) {
      setPhase('idle');
      return;
    }

    if (!hasAllowedExtension(nextFile.name, ENGLISH_CHECK_EXTENSIONS)) {
      setPhase('idle');
      setErrorMessage('Chỉ hỗ trợ file .xlsx.');
      return;
    }

    setPhase('parsing');

    try {
      const parsed = await readEnglishCheckWorkbook(await nextFile.arrayBuffer());

      if (fileRequestIdRef.current !== requestId) {
        return;
      }

      workbookRef.current = parsed.workbook;
      setAnalysis({ sheets: parsed.sheets, rows: parsed.rows, totalRows: parsed.totalRows });
      setPhase('ready');
    } catch (error) {
      if (fileRequestIdRef.current !== requestId) {
        return;
      }

      setPhase('idle');
      setErrorMessage(error instanceof Error ? error.message : 'Không thể đọc workbook vừa chọn.');
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    const [nextFile] = event.dataTransfer.files ?? [];

    if (nextFile) {
      selectFile(nextFile);
    }
  }

  async function handleCheck(event) {
    event.preventDefault();

    if (!analysis || !workbookRef.current) {
      setErrorMessage('Vui lòng chọn một file .xlsx hợp lệ trước khi kiểm tra.');
      return;
    }

    if (!analysis.totalRows) {
      setErrorMessage('Không tìm thấy dòng hàng hóa nào để kiểm tra.');
      return;
    }

    setErrorMessage('');
    setCheckFailed(false);
    setResults([]);
    setFilter('attention');
    setPhase('checking');

    const prepared = prepareEnglishChecks(analysis.rows);
    const deterministicCount = prepared.deterministicResults.length;
    const batches = splitIntoBatches(prepared.uniqueRows, ENGLISH_CHECK_BATCH_SIZE);
    const uniqueResults = [];
    const controller = new AbortController();
    setProgress({ resolved: deterministicCount, total: analysis.totalRows });

    try {
      await runWithConcurrency(batches, ENGLISH_CHECK_CONCURRENCY, async (batch) => {
        const batchResults = await requestCheckBatch(batch, controller.signal);
        uniqueResults.push(...batchResults);
        const resolvedRows = batch.reduce(
          (total, row) => total + (prepared.groupsByUniqueRowId.get(row.rowId)?.length ?? 0),
          0
        );
        setProgress((current) => ({ ...current, resolved: current.resolved + resolvedRows }));
      });

      const expandedResults = expandEnglishCheckResults(analysis.rows, prepared, uniqueResults);
      setResults(expandedResults);
      setProgress({ resolved: analysis.totalRows, total: analysis.totalRows });
      setPhase('complete');
    } catch (error) {
      controller.abort();
      setPhase('ready');
      setCheckFailed(true);
      setErrorMessage(
        error instanceof Error ? error.message : 'Quá trình kiểm tra bị gián đoạn. Vui lòng thử lại.'
      );
    }
  }

  async function handleDownload() {
    if (!file || !analysis || !workbookRef.current || !results.length) {
      return;
    }

    setErrorMessage('');

    try {
      const output = await writeEnglishCheckResults(workbookRef.current, analysis.sheets, results);
      const blob = new Blob([output], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name.replace(/\.xlsx$/i, '') + '_ket-qua-check-ten-ta.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tạo file Excel kết quả.');
    }
  }

  return (
    <div className="checker-page checker-page-embedded english-checker">
      <section className="content-card english-upload-card">
        <div className="section-copy">
          <h1>Upload file</h1>
          <p>Kiểm tra “Tên TA” bằng cách đối chiếu với “Tên hàng hóa XNK” trong workbook.</p>
        </div>

        <form className="english-upload-form" onSubmit={handleCheck}>
          <label
            className={`upload-slot english-upload-slot ${dragActive ? 'is-drag-active' : ''}`}
            htmlFor="english-checker-file-input"
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDrop={handleDrop}
          >
            <input
              accept=".xlsx"
              aria-label="File Excel kiểm tra Tên TA"
              className="visually-hidden"
              id="english-checker-file-input"
              onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
              type="file"
            />

            <span className="upload-slot-title">File Excel</span>
            <div className="upload-slot-body english-upload-body">
              <img alt="" aria-hidden="true" className="upload-slot-icon" src={EXCEL_ICON_SRC} />
              <div className="upload-slot-copy">
                <p className="upload-slot-instruction">
                  <strong>Kéo file vào</strong>
                  <span>hoặc</span>
                  <span className="upload-slot-button">Tải lên file</span>
                </p>
                <p className="upload-slot-help">Hỗ trợ “.xlsx”</p>
              </div>
            </div>

            <p className={`upload-slot-name ${file ? 'has-file' : ''}`}>
              {isParsing ? 'Đang đọc workbook...' : file?.name ?? 'Chưa chọn file'}
            </p>
          </label>

          <FileSummary analysis={analysis} />

          <button className="start-button english-start-button" disabled={!analysis || isParsing || isChecking} type="submit">
            {isChecking ? 'Đang kiểm tra...' : checkFailed ? 'Thử lại' : 'Bắt đầu đối chiếu'}
          </button>
        </form>

        {errorMessage ? (
          <p aria-live="polite" className="error-banner" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>

      {isChecking ? <EnglishCheckLoading progress={progress} /> : null}

      {phase === 'complete' ? (
        <section className="content-card english-results-card">
          <div className="english-results-heading">
            <div className="section-copy">
              <h2>Kết quả kiểm tra Tên TA</h2>
              <p>{file?.name}</p>
            </div>
            <button className="download-button" onClick={handleDownload} type="button">
              Download Excel kết quả
            </button>
          </div>

          <ResultSummary summary={summary} />

          <div className="english-filter-bar" aria-label="Lọc kết quả">
            {RESULT_FILTERS.map((item) => (
              <button
                aria-pressed={filter === item.value}
                className={`filter-chip ${filter === item.value ? 'is-active' : ''}`}
                disabled={getFilterCount(summary, item.value) === 0}
                key={item.value}
                onClick={() => setFilter(item.value)}
                type="button"
              >
                {item.label} ({getFilterCount(summary, item.value)})
              </button>
            ))}
          </div>

          <div className="table-caption">
            Hiển thị {visibleResults.length} / {results.length} dòng
          </div>

          {visibleResults.length ? (
            <div className="table-shell english-table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Sheet</th>
                    <th>STT</th>
                    <th>Dòng Excel</th>
                    <th>Tên hàng hóa XNK</th>
                    <th>Tên TA hiện tại</th>
                    <th>Trạng thái</th>
                    <th>Lý do</th>
                    <th>Tên TA đề xuất</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleResults.map((row, index) => (
                    <tr className={index % 2 === 1 ? 'is-alt-row' : ''} key={row.rowId}>
                      <td>{row.sheet}</td>
                      <td>{row.stt ?? '—'}</td>
                      <td>{row.excelRow}</td>
                      <td className="english-name-cell">{row.productNameVi ?? 'Trống'}</td>
                      <td className="english-name-cell">{row.productNameEn ?? 'Trống'}</td>
                      <td>
                        <span className="english-status-pill" data-status={row.status}>{row.status}</span>
                      </td>
                      <td className="english-reason-cell">{row.reason ?? '—'}</td>
                      <td className="english-suggestion-cell">{row.suggestedName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>Không có dòng nào trong bộ lọc này.</p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
