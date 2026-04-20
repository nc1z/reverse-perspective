import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Stay well under the 1MB CLI input limit
const CHAR_LIMIT = 800_000;

// Progressive size limits — try largest first, fall back if output is still too big
const ATTEMPTS = [
  { maxSize: 100_000, label: '100 KB/file' },
  { maxSize: 10_000,  label: '10 KB/file'  },
  { maxSize: 2_000,   label: '2 KB/file (structure only)' },
];

function run(url, maxSize) {
  return execFileSync(
    'uv',
    ['run', 'gitingest', url, '--output', '-', '--max-size', String(maxSize)],
    {
      encoding: 'utf-8',
      cwd: ROOT,
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
}

/**
 * Run gitingest, automatically retrying with smaller per-file limits
 * until the output fits within the model's input limit.
 *
 * Returns { digest, structureOnly } where structureOnly=true means we
 * fell back to a minimal view and the caller should make criticalMissing
 * mandatory in the prompt.
 */
export function ingest(url, onProgress) {
  onProgress?.('Running gitingest...');

  let lastError;
  for (const { maxSize, label } of ATTEMPTS) {
    try {
      const output = run(url, maxSize);
      if (output.length <= CHAR_LIMIT) {
        return { digest: output, structureOnly: maxSize <= 2_000 };
      }
      onProgress?.(`Digest too large (${(output.length / 1000).toFixed(0)}k chars), retrying with ${label}…`);
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    const msg = lastError.stderr?.toString().trim() || lastError.message;
    throw new Error(`gitingest failed: ${msg}`);
  }

  // Even 2KB/file is too big (enormous repo) — truncate as last resort
  onProgress?.('Repository is very large — using structure-only view');
  const fallback = run(url, 2_000);
  return { digest: fallback.slice(0, CHAR_LIMIT), structureOnly: true };
}
