import { execFile } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { createDeclarationRow } from '@/lib/declaration';

const execFileAsync = promisify(execFile);
const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(CURRENT_DIR, '..', '..');
const PYTHON_PACKAGES_DIR = path.join(PROJECT_ROOT, '.python-packages');

const LOCAL_PYTHON_CANDIDATES = [
  path.join(PROJECT_ROOT, '.venv', 'bin', 'python'),
  path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe')
];

function scriptPath(scriptName) {
  return path.join(PROJECT_ROOT, 'scripts', scriptName);
}

function toUint8Array(bufferLike) {
  if (bufferLike instanceof Uint8Array) {
    return new Uint8Array(bufferLike.buffer, bufferLike.byteOffset, bufferLike.byteLength);
  }

  return new Uint8Array(bufferLike);
}

async function resolvePythonExecutable() {
  for (const candidatePath of LOCAL_PYTHON_CANDIDATES) {
    try {
      await access(candidatePath);
      return candidatePath;
    } catch {}
  }

  return 'python3';
}

function buildPythonEnv() {
  const pythonPathEntries = [PROJECT_ROOT, PYTHON_PACKAGES_DIR, process.env.PYTHONPATH].filter(Boolean);

  return {
    ...process.env,
    PYTHONPATH: pythonPathEntries.join(path.delimiter),
    PYTHONDONTWRITEBYTECODE: '1'
  };
}

function getReadablePdfPlumberError(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (/spawn\s+python(?:3)?\s+ENOENT/iu.test(message) || /not found/iu.test(message)) {
    return 'Máy chủ chưa có Python runtime để chạy parser PDF Form E.';
  }

  if (/ModuleNotFoundError/iu.test(message) || /No module named/iu.test(message)) {
    return 'Máy chủ chưa nạp đủ thư viện pdfplumber cho parser PDF Form E.';
  }

  return `Parser pdfplumber gặp lỗi: ${message}`;
}

function parseJsonPayload(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
}

function getNoRowsMessage(payload) {
  const warning = Array.isArray(payload?.warnings) ? payload.warnings[0] : '';

  if (warning) {
    return `Không tìm thấy dòng hàng hóa nào trong PDF Form E. Chi tiết parser: ${warning}`;
  }

  return 'Không tìm thấy dòng hàng hóa nào trong PDF Form E. Phase hiện tại chỉ hỗ trợ PDF có dữ liệu text/vector trích xuất được.';
}

function normalizeSequenceKey(value, fallbackValue) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return String(fallbackValue);
  }

  const compact = raw.replace(/\s+/g, '');

  if (/^\d+(?:\.0+)?$/u.test(compact)) {
    return String(Number(compact));
  }

  return compact.toLowerCase();
}

export function mapPdfPlumberPayloadToResult(payload, extraWarnings = []) {
  if (payload?.error) {
    throw new Error(payload.error);
  }

  if (!Array.isArray(payload?.rows) || payload.rows.length === 0) {
    return null;
  }

  return {
    rows: payload.rows.map((row, index) =>
      createDeclarationRow(
        'pdf',
        {
          hsCode: row.hsCode,
          itemName: row.itemName,
          unit: row.unit,
          quantity: row.quantity
        },
        index + 1,
        {
          extractionMethod: 'pdfplumber-form-e',
          pageNumber: row.pageNumber,
          itemNumber: row.itemNumber,
          origin: row.origin,
          orderIndex: index + 1,
          sequenceKey: normalizeSequenceKey(row.itemNumber, index + 1)
        }
      )
    ),
    warnings: [
      'PDF parser: đang dùng pdfplumber cho template Form E.',
      ...extraWarnings,
      ...(Array.isArray(payload?.warnings) ? payload.warnings : [])
    ]
  };
}

export async function extractPdfRows(bufferLike) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'nhidong-pdf-'));
  const tempPdfPath = path.join(tempDir, 'upload.pdf');

  try {
    await writeFile(tempPdfPath, Buffer.from(toUint8Array(bufferLike)));

    const pythonExecutable = await resolvePythonExecutable();
    const extractorScriptPath = scriptPath('extract_form_e_pdfplumber.py');
    const { stdout, stderr } = await execFileAsync(
      pythonExecutable,
      [extractorScriptPath, tempPdfPath],
      {
        cwd: PROJECT_ROOT,
        env: buildPythonEnv(),
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024
      }
    );

    const payload = parseJsonPayload(stdout);

    if (!payload) {
      throw new Error('Parser PDF trả về dữ liệu không hợp lệ.');
    }

    const parsed = mapPdfPlumberPayloadToResult(
      payload,
      stderr?.trim() ? [stderr.trim()] : []
    );

    if (!parsed) {
      throw new Error(getNoRowsMessage(payload));
    }

    return parsed;
  } catch (error) {
    const payload = parseJsonPayload(error?.stdout);

    if (
      error instanceof Error &&
      (error.message.startsWith('Không tìm thấy dòng hàng hóa nào trong PDF Form E.') ||
        error.message === 'Parser PDF trả về dữ liệu không hợp lệ.')
    ) {
      throw error;
    }

    if (payload?.error) {
      throw new Error(payload.error);
    }

    if (payload && (!Array.isArray(payload.rows) || payload.rows.length === 0)) {
      throw new Error(getNoRowsMessage(payload));
    }

    throw new Error(getReadablePdfPlumberError(error));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
