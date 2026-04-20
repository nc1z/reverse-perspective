import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Skip files larger than 100KB — captures all source code while excluding
// datasets, large JSON blobs, binaries, generated files, etc.
const MAX_FILE_SIZE = 100_000;

/**
 * Run gitingest on a GitHub URL and return the LLM-ready digest.
 * Uses `uv run` so gitingest runs from the project's Python venv.
 */
export function ingest(url, onProgress) {
  onProgress?.('Running gitingest...');

  try {
    return execFileSync(
      'uv',
      ['run', 'gitingest', url, '--output', '-', '--max-size', String(MAX_FILE_SIZE)],
      {
        encoding: 'utf-8',
        cwd: ROOT,
        maxBuffer: 50 * 1024 * 1024,
        timeout: 120_000,
        stdio: ['pipe', 'pipe', 'pipe'], // suppress INFO logs from terminal
      }
    );
  } catch (err) {
    const msg = err.stderr?.toString().trim() || err.message;
    throw new Error(`gitingest failed: ${msg}`);
  }
}
