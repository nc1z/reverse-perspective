import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ~100k tokens — fits comfortably within model context windows
const MAX_CHARS = 400_000;

/**
 * Run gitingest on a GitHub URL and return the LLM-ready digest.
 * Uses `uv run` to run gitingest from the project's Python dependencies.
 * Truncates output if the repo is too large for the model's context.
 */
export function ingest(url, onProgress) {
  onProgress?.('Running gitingest...');

  let output;
  try {
    output = execFileSync('uv', ['run', 'gitingest', url, '--output', '-'], {
      encoding: 'utf-8',
      cwd: ROOT,
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'], // suppress stderr logs from terminal
    });
  } catch (err) {
    const msg = err.stderr?.toString().trim() || err.message;
    throw new Error(`gitingest failed: ${msg}`);
  }

  if (output.length > MAX_CHARS) {
    onProgress?.(`Digest too large (${(output.length / 1000).toFixed(0)}k chars) — truncating to ${MAX_CHARS / 1000}k`);
    output = output.slice(0, MAX_CHARS) + '\n\n... [TRUNCATED — repository is very large, showing first portion only]\n';
  }

  return output;
}
