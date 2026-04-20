import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/**
 * Run gitingest on a GitHub URL and return the LLM-ready digest.
 * Uses `uv run` to run gitingest from the project's Python dependencies.
 */
export function ingest(url, onProgress) {
  onProgress?.('Running gitingest...');

  try {
    return execFileSync('uv', ['run', 'gitingest', url, '--output', '-'], {
      encoding: 'utf-8',
      cwd: ROOT,
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120_000,
    });
  } catch (err) {
    if (err.stderr) {
      throw new Error(`gitingest failed: ${err.stderr.toString().trim()}`);
    }
    throw err;
  }
}
