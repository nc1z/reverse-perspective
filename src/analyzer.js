import { spawn, execFileSync } from 'child_process';

/**
 * Detect which CLI to use: prefers `claude`, falls back to `codex`.
 * Throws if neither is on PATH.
 */
function detectCLI() {
  for (const cli of ['claude', 'codex']) {
    try {
      execFileSync('which', [cli], { stdio: 'ignore' });
      return cli;
    } catch {
      // not found, try next
    }
  }
  throw new Error(
    'Neither `claude` nor `codex` found on PATH.\n' +
    '  Install Claude Code: https://claude.ai/code'
  );
}

/**
 * Build CLI args for the detected tool.
 * claude: --print --output-format stream-json --include-partial-messages
 * codex:  -p  (quiet / non-interactive mode)
 */
function buildArgs(cli) {
  if (cli === 'claude') {
    return ['--print', '--output-format', 'text'];
  }
  // codex CLI uses -p for non-interactive mode
  return ['-p'];
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

export async function analyze(repoContext, onChunk) {
  const cli = detectCLI();
  const args = buildArgs(cli);
  const prompt = buildPrompt(repoContext);

  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      // Use a neutral cwd so claude doesn't pick up unrelated project context
      cwd: process.env.HOME || process.cwd(),
    });

    let accumulated = '';

    child.stdout.on('data', (chunk) => {
      accumulated += chunk.toString();
      onChunk?.(accumulated);
    });

    let stderrBuf = '';
    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
    });

    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error(`'${cli}' not found on PATH. Install Claude Code: https://claude.ai/code`));
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      const final = accumulated.trim();

      if (!final) {
        const detail = stderrBuf.trim()
          ? `\n\nstderr:\n${stderrBuf.trim()}`
          : '\n\n(no stderr output)';
        reject(new Error(`${cli} exited with code ${code} and produced no output${detail}`));
        return;
      }

      if (code !== 0) {
        // Got output but non-zero exit — log stderr as a warning and continue
        if (stderrBuf.trim()) {
          process.stderr.write(`\n[warn] ${cli} stderr:\n${stderrBuf.trim()}\n`);
        }
      }

      resolve(final);
    });

    // Write prompt to stdin and close it
    child.stdin.write(prompt, 'utf-8');
    child.stdin.end();
  });
}
