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

  return `You are analysing a software repository. Study the context below and return a single JSON object — no preamble, no explanation, no markdown fences, just raw JSON.

Approach this as a developer reconstructing the project from commit #1. For every layer ask:
- What problem were they solving?
- Why this abstraction and not another?
- What was written first vs later?
- What decisions look obvious now but were hard-won?

## Required JSON schema

Return exactly this structure (all fields required):

{
  "mentalModel": [
    "string — one core question the repo answers (3–5 items)"
  ],
  "repoTree": [
    { "path": "string — top-level file or folder name", "annotation": "string — one line on why it exists" }
  ],
  "layers": [
    {
      "name": "string — subsystem name",
      "content": "string — detailed markdown covering: purpose, key abstractions with code examples, key functions, design decisions, gotchas"
    }
  ],
  "dependencies": "string — markdown: each dependency mapped to the layer it serves, why it was chosen",
  "devScaffolding": "string — markdown: linting, CI, tests, pre-commit — why each exists at this project's scale",
  "e2eFlow": "string — ASCII diagram tracing the primary entry point through every layer",
  "commitStory": [
    { "n": 1, "message": "string — git commit message", "description": "string — what was actually written in this commit" }
  ],
  "summaries": [
    { "layer": "string — subsystem name", "oneLiner": "string — one sentence" }
  ]
}

## Rules

- Be specific to THIS repo. No generic advice.
- layers should cover every major subsystem — aim for 4–8 entries.
- commitStory should have ~10 entries in chronological build order.
- content fields inside layers must be valid markdown (code blocks, headings, lists).
- e2eFlow must preserve ASCII whitespace — use \\n for newlines inside the JSON string.
- Return ONLY the JSON object. Any text outside the JSON will break the parser.

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
