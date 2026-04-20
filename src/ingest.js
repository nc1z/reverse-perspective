import { execFileSync } from 'child_process';

/**
 * Run gitingest on a GitHub URL and return the LLM-ready digest.
 * Uses `uvx` to run gitingest without a global install.
 */
export function ingest(url, onProgress) {
  onProgress?.('Running gitingest...');

  // Try uvx first (uv tool run), fall back to gitingest directly
  const commands = [
    ['uvx', ['gitingest', url, '--output', '-']],
    ['gitingest', [url, '--output', '-']],
  ];

  for (const [binary, args] of commands) {
    try {
      execFileSync('which', [binary], { stdio: 'ignore' });
      const output = execFileSync(binary, args, {
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024, // 50MB — large repos
        timeout: 120_000,            // 2 min
      });
      return output;
    } catch (err) {
      if (err.code === 'ENOENT' || err.status === 1 && !err.stdout) continue;
      // If the command was found but failed, throw
      if (err.stderr) {
        throw new Error(`gitingest failed: ${err.stderr.toString().trim()}`);
      }
      throw err;
    }
  }

  throw new Error(
    'gitingest not found. Install it with:\n\n' +
    '  uv tool install gitingest\n\n' +
    'Or: pip install gitingest'
  );
}
