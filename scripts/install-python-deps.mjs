import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const REQUIREMENTS_PATH = path.join(PROJECT_ROOT, 'requirements.txt');
const PYTHON_PACKAGES_DIR = path.join(PROJECT_ROOT, '.python-packages');
const STAMP_PATH = path.join(PYTHON_PACKAGES_DIR, '.requirements.hash');

const PYTHON_CANDIDATES = [process.env.PYTHON, 'python3', 'python'].filter(Boolean);

function hashRequirements(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function readCurrentStamp() {
  try {
    return await readFile(STAMP_PATH, 'utf8');
  } catch {
    return '';
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
    });
  });
}

async function findPythonExecutable() {
  for (const candidate of PYTHON_CANDIDATES) {
    try {
      await runCommand(candidate, ['--version'], {
        cwd: PROJECT_ROOT,
        env: process.env
      });
      return candidate;
    } catch {}
  }

  throw new Error('Khong tim thay python3/python de cai dat pdfplumber cho parser PDF.');
}

async function installDependencies() {
  const requirementsContent = await readFile(REQUIREMENTS_PATH, 'utf8');
  const nextStamp = hashRequirements(requirementsContent);
  const currentStamp = await readCurrentStamp();

  if (currentStamp === nextStamp) {
    console.log('Python dependencies are already up to date.');
    return;
  }

  const pythonExecutable = await findPythonExecutable();

  await rm(PYTHON_PACKAGES_DIR, { recursive: true, force: true });
  await mkdir(PYTHON_PACKAGES_DIR, { recursive: true });

  await runCommand(
    pythonExecutable,
    [
      '-m',
      'pip',
      'install',
      '--disable-pip-version-check',
      '--requirement',
      REQUIREMENTS_PATH,
      '--target',
      PYTHON_PACKAGES_DIR
    ],
    {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PIP_DISABLE_PIP_VERSION_CHECK: '1'
      }
    }
  );

  await writeFile(STAMP_PATH, nextStamp, 'utf8');
  console.log('Installed Python dependencies for PDF parsing.');
}

await access(REQUIREMENTS_PATH);
await installDependencies();
