import { spawn, execFileSync } from 'child_process';
import { adapters } from './adapters/index.js';

/**
 * Check which adapters have their binary available on PATH.
 * Returns the subset that are usable right now.
 */
export function availableAdapters() {
  return adapters.filter(adapter => {
    try {
      execFileSync('which', [adapter.binary], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  });
}

function buildPrompt(repoContext) {
  const { metadata, tree, readme, manifest, sourceFiles } = repoContext;

  const treeStr = tree.slice(0, 250).join('\n');
  const readmeTrunc = readme.length > 2500 ? readme.slice(0, 2500) + '\n... (truncated)' : readme;
  const manifestContent = manifest?.content?.slice(0, 2500) || 'Not found';

  let sourceStr = '';
  for (const [filePath, content] of Object.entries(sourceFiles)) {
    sourceStr += `\n### ${filePath}\n\`\`\`\n${content}\n\`\`\`\n`;
  }

  const context = `
## Repository Metadata
- Full name: ${metadata.full_name}
- Description: ${metadata.description || 'N/A'}
- Stars: ${metadata.stargazers_count?.toLocaleString()}
- Forks: ${metadata.forks_count?.toLocaleString()}
- Open issues: ${metadata.open_issues_count}
- Primary language: ${metadata.language || 'Unknown'}
- Created: ${metadata.created_at}
- Last push: ${metadata.pushed_at}
- Topics: ${(metadata.topics || []).join(', ') || 'none'}
- License: ${metadata.license?.name || 'none'}

## File Tree (${tree.length} total files, showing first 250)
\`\`\`
${treeStr}
\`\`\`

## README
${readmeTrunc}

## Manifest (${manifest?.name || 'none found'})
\`\`\`
${manifestContent}
\`\`\`

## Key Source Files
${sourceStr}
`.trim();

  return `You are producing a one-page technical summary of a software repository. Be ruthlessly concise — every word must earn its place. Return a single JSON object, no preamble, no markdown fences, just raw JSON.

## Required JSON schema

{
  "abstract": "string — 2-3 sentences MAX. What does this repo do and what is its core technical approach?",
  "architecture": [
    { "name": "string — component name", "role": "string — one sentence: what it does" }
  ],
  "e2eFlow": "string — compact ASCII diagram tracing the primary entry point through the system. Use \\n for newlines. No prose, diagram only.",
  "keyDecisions": [
    "string — one concrete design/architecture decision, one sentence each"
  ],
  "dependencies": [
    { "name": "string — package name", "purpose": "string — one short phrase" }
  ]
}

## Rules

- abstract: 2-3 sentences, no fluff, specific to this repo.
- architecture: 4-6 components MAX. One sentence per component. Cover only the major layers.
- e2eFlow: trace the single most important user-facing path. 10-15 lines MAX. ASCII art preferred.
- keyDecisions: 3-5 items MAX. Concrete decisions only — not generic best practices.
- dependencies: production dependencies only. Skip dev tools.
- Return ONLY the JSON object.

## Repository context

${context}`;
}

/**
 * Run the analysis using the given adapter.
 *
 * @param {object} repoContext  - output of github.fetchRepo()
 * @param {object} adapter      - one of the adapters from src/adapters/
 * @param {string} model        - model ID to pass to the adapter
 * @param {function} onChunk    - called with accumulated text as chunks arrive
 * @returns {Promise<string>}   - full analysis markdown
 */
export async function analyze(repoContext, adapter, model, onChunk) {
  const prompt = buildPrompt(repoContext);
  const args = adapter.args(model);

  return new Promise((resolve, reject) => {
    const child = spawn(adapter.binary, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.env.HOME || process.cwd(),
    });

    let accumulated = '';
    let stderrBuf = '';

    child.stdout.on('data', (chunk) => {
      accumulated += chunk.toString();
      onChunk?.(accumulated);
    });

    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
    });

    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error(`'${adapter.binary}' not found on PATH`));
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      const final = adapter.transformOutput(accumulated);

      if (!final) {
        const detail = stderrBuf.trim()
          ? `\n\nstderr:\n${stderrBuf.trim()}`
          : '\n\n(no stderr output)';
        reject(new Error(`${adapter.hint} exited with code ${code} and produced no output${detail}`));
        return;
      }

      if (code !== 0 && stderrBuf.trim()) {
        process.stderr.write(`\n[warn] ${adapter.hint} stderr:\n${stderrBuf.trim()}\n`);
      }

      resolve(final);
    });

    child.stdin.write(prompt, 'utf-8');
    child.stdin.end();
  });
}
