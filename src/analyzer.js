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

  return `Repository: https://github.com/${metadata.full_name}

I want to deeply understand how this codebase was built, as if I were one of
the original developers reconstructing it from commit #1. The goal is not to
use the tool — it's to understand the engineering thought process behind it.

## How to approach this

Put yourself in the shoes of the original developer(s). For every layer, ask:
- What problem were they solving at this step?
- Why this file / folder / abstraction and not another?
- What would they have written FIRST vs later?
- What decisions look obvious now but were hard-won?

Explain the codebase in this voice:
"I am a developer building <X>. What do I have to do first? I have to set up
the repo. Then I need to decide on the data model. Then I need linting. Then..."

Reimagine what the commit history would look like if this were being built
from scratch today. Treat the repository as a story told in commits.

## Required structure

Write the response as a tree-structured deep dive, with these exact section headings:

## 1. Mental Model
The 3–5 core questions the whole repo answers, in order.
Everything in the repo should map to one of these questions.
Format as a numbered list.

## 2. Top-Level Repo Tree
Annotated file/folder map of the root. For every top-level item, one line on why it exists.
Format each line as: \`item\` — reason it exists

## 3. Per-Layer Deep Dives
One section per major subdirectory or subsystem.
For each layer use a ### heading with the layer name, then cover:
- Purpose (one sentence)
- Annotated file tree of that layer
- The KEY data structures / abstractions, with illustrative code
- The KEY functions and what they do
- Design decisions: why THIS pattern, what tradeoffs it makes
- Where this layer bites you (common bugs, gotchas, ops pain)

## 4. Dependencies
Read the manifest file as a DEPENDENCY MAP. Explain which deps serve which layer,
and why optional extras are split the way they are.

## 5. Dev Scaffolding
Linting, pre-commit, CI workflows, tests, docs config. Explain why each exists.

## 6. End-to-End Flow
An ASCII diagram showing the primary user-facing command / entry point traced
all the way through every layer, with the output directory structure it produces.

## 7. Commit History as a Story
List the ~10 commits that would build this from scratch, in order.
Format as a numbered list: commit message — what was actually written

## 8. One-Sentence Summary Per Layer
A final cheat sheet. One line per subsystem.
Format as a list: **Layer Name** — one sentence

## Rules

- Focus PURELY on how the repo works and how it was built.
- Skip getting started / install instructions.
- Don't pad with generic advice. Every paragraph must be about THIS specific repo.
- Prefer concrete examples over abstract description. Show actual code patterns.
- Be honest about uncertainty — if inferring from imports, say so.

## Repo Context

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
