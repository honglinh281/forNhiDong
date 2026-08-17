'use client';

import { useDeferredValue, useMemo, useRef, useState } from 'react';
import type ExcelJS from 'exceljs';

import {
  AUDIT_BATCH_SIZE,
  AUDIT_CONCURRENCY,
  ENGLISH_CHECK_EXTENSIONS,
  ENGLISH_CHECK_STATUS
} from '@/lib/english-checker/constants';
import {
  expandPartialEnglishCheckResults,
  mergeRowsWithPartialResults,
  prepareEnglishChecks,
  sortEnglishCheckResults,
  summarizeEnglishCheckResults,
  type PreparedEnglishChecks
} from '@/lib/english-checker/processing';
import { requestAuditBatch } from '@/lib/english-checker/queue/audit-client';
import { AuditQueue } from '@/lib/english-checker/queue/audit-queue';
import type {
  AuditProgressSnapshot,
  FinalAuditResult,
  ProductRow
} from '@/lib/english-checker/types';
import {
  readEnglishCheckWorkbook,
  writeEnglishCheckResults,
  type ProductSheet
} from '@/lib/english-checker/workbook';
import { hasAllowedExtension } from '@/lib/normalize';

const EXCEL_ICON_SRC = '/figma/english-checker-xls.png';
const DEBUG_ENABLED = process.env.NEXT_PUBLIC_AUDIT_DEBUG === 'true';

const RESULT_FILTERS = [
  { value: 'attention', label: 'Cần chú ý' },
  { value: 'all', label: 'Tất cả' },
  { value: ENGLISH_CHECK_STATUS.WRONG, label: ENGLISH_CHECK_STATUS.WRONG },
  { value: ENGLISH_CHECK_STATUS.CLOSE, label: ENGLISH_CHECK_STATUS.CLOSE },
  { value: ENGLISH_CHECK_STATUS.MISSING, label: ENGLISH_CHECK_STATUS.MISSING }
];

const EMPTY_PROGRESS: AuditProgressSnapshot = {
  total: 0,
  completed: 0,
  processing: 0,
  pending: 0,
  retrying: 0,
  failed: 0,
  resolved: 0,
  paused: false
};

type Analysis = {
  sheets: ProductSheet[];
  rows: ProductRow[];
  totalRows: number;
};

type DisplayResult = ProductRow & FinalAuditResult;

function FileSummary({ analysis }: { analysis: Analysis | null }) {
  if (!analysis) return null;
  return (
    <div className="english-file-summary" aria-label="Thông tin workbook">
      <div className="english-file-total">
        <strong>{analysis.totalRows}</strong>
        <span>dòng hàng hóa trên {analysis.sheets.length} sheet</span>
      </div>
      <div className="english-sheet-list">
        {analysis.sheets.map((sheet) => (
          <div className="english-sheet-row" key={sheet.name}>
            <span><strong>{sheet.name}</strong> · {sheet.rowCount} dòng</span>
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

function AuditProgress({
  progress,
  onPause,
  onResume,
  onCancel
}: {
  progress: AuditProgressSnapshot;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  const percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  return (
    <section className="content-card english-progress-card" aria-live="polite">
      <div className="english-progress-heading">
        <div className="section-copy">
          <h2>{progress.paused ? 'Đã tạm dừng' : 'Đang kiểm tra Tên TA'}</h2>
          <p>Đã hoàn tất {progress.completed} / {progress.total} dòng</p>
        </div>
        <div className="english-queue-actions">
          {progress.paused ? (
            <button type="button" onClick={onResume}>Tiếp tục</button>
          ) : (
            <button type="button" onClick={onPause}>Tạm dừng</button>
          )}
          <button type="button" onClick={onCancel}>Hủy</button>
        </div>
      </div>
      <div
        aria-label={`Tiến độ ${percent}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="english-progress-track"
        role="progressbar"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="english-progress-stats">
        <span>Hoàn tất: {progress.completed}</span>
        <span>Đang xử lý: {progress.processing}</span>
        <span>Chờ: {progress.pending}</span>
        <span>Thử lại: {progress.retrying}</span>
        <span>Lỗi: {progress.failed}</span>
      </div>
      <p className="english-progress-note">
        Workbook nằm trong trình duyệt; mỗi request chỉ gửi tối đa {AUDIT_BATCH_SIZE} tên hàng hóa.
      </p>
    </section>
  );
}

function ResultSummary({ summary }: { summary: ReturnType<typeof summarizeEnglishCheckResults> }) {
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
          <span>{card.label}</span><strong>{card.value}</strong>
        </article>
      ))}
    </div>
  );
}

function filterResults(rows: DisplayResult[], filter: string): DisplayResult[] {
  if (filter === 'all') return rows;
  if (filter === 'attention') return rows.filter((row) => row.status !== ENGLISH_CHECK_STATUS.OK);
  return rows.filter((row) => row.status === filter);
}

function getFilterCount(summary: ReturnType<typeof summarizeEnglishCheckResults>, filter: string): number {
  if (filter === 'all') return summary.total;
  if (filter === 'attention') return summary.close + summary.wrong + summary.missing;
  if (filter === ENGLISH_CHECK_STATUS.WRONG) return summary.wrong;
  if (filter === ENGLISH_CHECK_STATUS.CLOSE) return summary.close;
  if (filter === ENGLISH_CHECK_STATUS.MISSING) return summary.missing;
  return 0;
}

function AuditDebugDetails({ row }: { row: DisplayResult }) {
  if (!DEBUG_ENABLED || !row.audit) return null;
  return (
    <details className="english-audit-details">
      <summary>Chi tiết audit</summary>
      <p>Identity: {row.audit.productIdentity.relation} · Risk: {row.riskScore}</p>
      <p>
        Material VI: {row.guards?.material.vietnameseMaterials.join(', ') || '—'} · EN:{' '}
        {row.guards?.material.englishMaterials.join(', ') || '—'}
      </p>
      <ul>
        {row.audit.clauseAudits.map((clause) => (
          <li key={clause.clauseId}>
            {clause.clauseId} · {clause.clauseType} · {clause.englishCoverage}: {clause.normalizedFact}
          </li>
        ))}
      </ul>
      {row.audit.englishClaims.length ? (
        <ul>
          {row.audit.englishClaims.map((claim) => (
            <li key={claim.claimId}>
              EN {claim.claimType}: {claim.normalizedFact} · {claim.vietnameseSupport}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}

export default function EnglishNameCheckerApp() {
  const workbookRef = useRef<ExcelJS.Workbook | null>(null);
  const fileRequestIdRef = useRef(0);
  const queueRef = useRef<AuditQueue | null>(null);
  const preparedRef = useRef<PreparedEnglishChecks | null>(null);
  const uniqueResultsRef = useRef(new Map<string, FinalAuditResult>());
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [results, setResults] = useState<DisplayResult[]>([]);
  const [filter, setFilter] = useState('attention');
  const [dragActive, setDragActive] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'parsing' | 'ready' | 'checking' | 'complete' | 'partial'>('idle');
  const [progress, setProgress] = useState<AuditProgressSnapshot>(EMPTY_PROGRESS);
  const [errorMessage, setErrorMessage] = useState('');

  const deferredResults = useDeferredValue(results);
  const sortedResults = useMemo(() => sortEnglishCheckResults(deferredResults), [deferredResults]);
  const summary = useMemo(() => summarizeEnglishCheckResults(deferredResults), [deferredResults]);
  const visibleResults = useMemo(() => filterResults(sortedResults, filter), [filter, sortedResults]);
  const isParsing = phase === 'parsing';
  const isChecking = phase === 'checking';
  const showResults = (phase === 'complete' || phase === 'partial') && results.length > 0;

  function refreshPartialResults(nextAnalysis: Analysis, prepared: PreparedEnglishChecks) {
    const expanded = expandPartialEnglishCheckResults(prepared, [...uniqueResultsRef.current.values()]);
    setResults(mergeRowsWithPartialResults(nextAnalysis.rows, expanded));
  }

  async function selectFile(nextFile: File | null) {
    queueRef.current?.cancel();
    const requestId = fileRequestIdRef.current + 1;
    fileRequestIdRef.current = requestId;
    setFile(nextFile);
    setAnalysis(null);
    setResults([]);
    setFilter('attention');
    setErrorMessage('');
    setProgress(EMPTY_PROGRESS);
    workbookRef.current = null;
    preparedRef.current = null;
    uniqueResultsRef.current = new Map();
    if (!nextFile) { setPhase('idle'); return; }
    if (!hasAllowedExtension(nextFile.name, ENGLISH_CHECK_EXTENSIONS)) {
      setPhase('idle'); setErrorMessage('Chỉ hỗ trợ file .xlsx.'); return;
    }
    setPhase('parsing');
    try {
      const parsed = await readEnglishCheckWorkbook(await nextFile.arrayBuffer());
      if (fileRequestIdRef.current !== requestId) return;
      workbookRef.current = parsed.workbook;
      setAnalysis({ sheets: parsed.sheets, rows: parsed.rows, totalRows: parsed.totalRows });
      setPhase('ready');
    } catch (error) {
      if (fileRequestIdRef.current !== requestId) return;
      setPhase('idle');
      setErrorMessage(error instanceof Error ? error.message : 'Không thể đọc workbook vừa chọn.');
    }
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault(); setDragActive(false);
    const [nextFile] = Array.from(event.dataTransfer.files ?? []);
    if (nextFile) void selectFile(nextFile);
  }

  function finishQueue(outcome: Awaited<ReturnType<AuditQueue['start']>>) {
    if (!analysis || !preparedRef.current) return;
    refreshPartialResults(analysis, preparedRef.current);
    if (outcome.cancelled) {
      setPhase(uniqueResultsRef.current.size ? 'partial' : 'ready');
      setErrorMessage('Đã hủy. Các dòng hoàn tất vẫn được giữ lại.');
    } else if (outcome.failedRowIds.length) {
      setPhase('partial');
      setErrorMessage(`${outcome.failedRowIds.length} micro-task chưa hoàn tất. Bạn có thể thử lại riêng các dòng lỗi.`);
    } else {
      setPhase('complete');
      setErrorMessage('');
    }
  }

  async function handleCheck(event: React.FormEvent) {
    event.preventDefault();
    if (!analysis || !workbookRef.current) {
      setErrorMessage('Vui lòng chọn một file .xlsx hợp lệ trước khi kiểm tra.'); return;
    }
    if (!analysis.totalRows) { setErrorMessage('Không tìm thấy dòng hàng hóa nào để kiểm tra.'); return; }
    setErrorMessage(''); setResults([]); setFilter('attention'); setPhase('checking');
    const prepared = prepareEnglishChecks(analysis.rows);
    preparedRef.current = prepared;
    uniqueResultsRef.current = new Map();
    refreshPartialResults(analysis, prepared);
    const queue = new AuditQueue(
      prepared.uniqueRows.map((row) => ({
        row,
        requestItem: prepared.requestItemsByRowId.get(row.rowId)!,
        weight: prepared.groupsByUniqueRowId.get(row.rowId)?.length ?? 1
      })),
      {
        batchSize: AUDIT_BATCH_SIZE,
        concurrency: AUDIT_CONCURRENCY,
        initialCompleted: prepared.deterministicResults.length,
        request: requestAuditBatch,
        onProgress: setProgress,
        onResult: (result) => {
          uniqueResultsRef.current.set(result.rowId, result);
          refreshPartialResults(analysis, prepared);
        }
      }
    );
    queueRef.current = queue;
    finishQueue(await queue.start());
  }

  async function handleRetryFailed() {
    if (!queueRef.current) return;
    setPhase('checking'); setErrorMessage('');
    finishQueue(await queueRef.current.retryFailed());
  }

  async function handleDownload() {
    if (!file || !analysis || !workbookRef.current || !results.length) return;
    setErrorMessage('');
    try {
      const output = await writeEnglishCheckResults(workbookRef.current, analysis.sheets, results);
      const blob = new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name.replace(/\.xlsx$/i, '') + '_ket-qua-check-ten-ta.xlsx';
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tạo file Excel kết quả.');
    }
  }

  return (
    <div className="checker-page checker-page-embedded english-checker">
      <section className="content-card english-upload-card">
        <div className="section-copy">
          <h1>Upload file</h1>
          <p>Kiểm tra strict semantic coverage giữa “Tên TA” và “Tên hàng hóa XNK”.</p>
        </div>
        <form className="english-upload-form" onSubmit={handleCheck}>
          <label
            className={`upload-slot english-upload-slot ${dragActive ? 'is-drag-active' : ''}`}
            htmlFor="english-checker-file-input"
            onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDrop={handleDrop}
          >
            <input
              accept=".xlsx"
              aria-label="File Excel kiểm tra Tên TA"
              className="visually-hidden"
              id="english-checker-file-input"
              onChange={(event) => void selectFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <span className="upload-slot-title">File Excel</span>
            <div className="upload-slot-body english-upload-body">
              <img alt="" aria-hidden="true" className="upload-slot-icon" src={EXCEL_ICON_SRC} />
              <div className="upload-slot-copy">
                <p className="upload-slot-instruction"><strong>Kéo file vào</strong><span>hoặc</span><span className="upload-slot-button">Tải lên file</span></p>
                <p className="upload-slot-help">Hỗ trợ “.xlsx”</p>
              </div>
            </div>
            <p className={`upload-slot-name ${file ? 'has-file' : ''}`}>
              {isParsing ? 'Đang đọc workbook...' : file?.name ?? 'Chưa chọn file'}
            </p>
          </label>
          <FileSummary analysis={analysis} />
          <button className="start-button english-start-button" disabled={!analysis || isParsing || isChecking} type="submit">
            {isChecking ? 'Đang kiểm tra...' : 'Bắt đầu kiểm tra'}
          </button>
        </form>
        {errorMessage ? <p aria-live="polite" className="error-banner" role="alert">{errorMessage}</p> : null}
      </section>

      {isChecking ? (
        <AuditProgress
          progress={progress}
          onPause={() => queueRef.current?.pause()}
          onResume={() => queueRef.current?.resume()}
          onCancel={() => queueRef.current?.cancel()}
        />
      ) : null}

      {showResults ? (
        <section className="content-card english-results-card">
          <div className="english-results-heading">
            <div className="section-copy">
              <h2>Kết quả kiểm tra Tên TA</h2>
              <p>{file?.name}{phase === 'partial' ? ' · Kết quả một phần' : ''}</p>
            </div>
            <div className="english-result-actions">
              {phase === 'partial' && progress.failed > 0 ? (
                <button className="download-button" onClick={() => void handleRetryFailed()} type="button">Thử lại dòng lỗi</button>
              ) : null}
              <button className="download-button" onClick={() => void handleDownload()} type="button">
                {phase === 'partial' ? 'Download kết quả một phần' : 'Download Excel kết quả'}
              </button>
            </div>
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
          <div className="table-caption">Hiển thị {visibleResults.length} / {results.length} dòng</div>
          {visibleResults.length ? (
            <div className="table-shell english-table-shell">
              <table>
                <thead><tr><th>Sheet</th><th>STT</th><th>Dòng Excel</th><th>Tên hàng hóa XNK</th><th>Tên TA hiện tại</th><th>Trạng thái</th><th>Lý do</th><th>Tên TA đề xuất</th></tr></thead>
                <tbody>
                  {visibleResults.map((row, index) => (
                    <tr className={index % 2 === 1 ? 'is-alt-row' : ''} key={row.rowId}>
                      <td>{row.sheet}</td><td>{row.stt ?? '—'}</td><td>{row.excelRow}</td>
                      <td className="english-name-cell">{row.productNameVi || 'Trống'}</td>
                      <td className="english-name-cell">{row.productNameEn || 'Trống'}</td>
                      <td><span className="english-status-pill" data-status={row.status}>{row.status}</span></td>
                      <td className="english-reason-cell">{row.reason || '—'}<AuditDebugDetails row={row} /></td>
                      <td className="english-suggestion-cell">{row.suggestedName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty-state"><p>Không có dòng nào trong bộ lọc này.</p></div>}
        </section>
      ) : null}
    </div>
  );
}
