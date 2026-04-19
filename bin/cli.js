#!/usr/bin/env node
import prompts from 'prompts';
import ora from 'ora';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, '..', 'tmp');
import { execFileSync } from 'child_process';

import { fetchRepo } from '../src/github.js';
import { analyze } from '../src/analyzer.js';
import { parseAnalysis } from '../src/parser.js';
import { startServer } from '../src/server.js';
import open from 'open';

// ── Banner ────────────────────────────────────────────────────────────────────
console.log('\n  reverse-perspective  —  understand any codebase from the inside out\n');

const subcommand = process.argv[2];

// ═══════════════════════════════════════════════════════════════════════════════
// serve  — re-open a previous analysis without re-running the AI
// ═══════════════════════════════════════════════════════════════════════════════
if (subcommand === 'serve') {
  const pathArg = process.argv[3]; // optional: direct path to analysis.json

  let analysisPath;

  if (pathArg) {
    // Direct path provided: node bin/cli.js serve /tmp/reverse-perspective-abc/analysis.json
    analysisPath = pathArg.endsWith('analysis.json') ? pathArg : join(pathArg, 'analysis.json');
    if (!existsSync(analysisPath)) {
      console.error(`  ✗  Not found: ${analysisPath}\n`);
      process.exit(1);
    }
  } else {
    // Scan repo tmp/ for saved analyses
    const saved = existsSync(RESULTS_DIR) ? readdirSync(RESULTS_DIR)
      .filter(d => d.startsWith('reverse-perspective-'))
      .map(d => {
        const dir = join(RESULTS_DIR, d);
        const file = join(dir, 'analysis.json');
        if (!existsSync(file)) return null;
        const stat = statSync(file);
        try {
          const data = JSON.parse(readFileSync(file, 'utf-8'));
          return { dir, file, mtime: stat.mtime, name: data.repo?.fullName || d };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime) // newest first
    : [];

    if (!saved.length) {
      console.error('  No saved analyses found.\n');
      console.error('  Run `node bin/cli.js` to analyse a repository first.\n');
      process.exit(1);
    }

    const { chosen } = await prompts(
      {
        type: 'select',
        name: 'chosen',
        message: 'Pick a saved analysis to serve',
        choices: saved.map(s => ({
          title: `${s.name}  (${s.mtime.toLocaleDateString()} ${s.mtime.toLocaleTimeString()})`,
          value: s.file,
        })),
      },
      { onCancel: () => { console.log('\n  Cancelled.\n'); process.exit(0); } }
    );

    if (!chosen) process.exit(0);
    analysisPath = chosen;
  }

  const analysis = JSON.parse(readFileSync(analysisPath, 'utf-8'));
  const spinner = ora({ text: 'Starting server…', color: 'cyan' }).start();
  const port = await startServer(analysis);
  spinner.succeed(`Ready — opening http://localhost:${port}`);
  console.log(`\n  Serving: ${analysisPath}\n`);
  await open(`http://localhost:${port}`);
  console.log('  Press Ctrl+C to stop.\n');
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// default  — fetch + analyse + serve
// ═══════════════════════════════════════════════════════════════════════════════

// Check that claude or codex is available
function findCLI() {
  for (const cli of ['claude', 'codex']) {
    try {
      execFileSync('which', [cli], { stdio: 'ignore' });
      return cli;
    } catch {}
  }
  return null;
}

const availableCLI = findCLI();
if (!availableCLI) {
  console.error('  ✗  Neither `claude` nor `codex` found on PATH.\n');
  console.error('  Install Claude Code and try again:\n');
  console.error('    https://claude.ai/code\n');
  process.exit(1);
}

// Prompt for URL
const response = await prompts(
  {
    type: 'text',
    name: 'url',
    message: 'GitHub repository URL',
    hint: 'e.g. https://github.com/expressjs/express',
    validate: (v) =>
      /github\.com\/[\w.\-]+\/[\w.\-]+/.test(v)
        ? true
        : 'Please enter a valid GitHub URL (https://github.com/owner/repo)',
  },
  {
    onCancel: () => {
      console.log('\n  Cancelled.\n');
      process.exit(0);
    },
  }
);

const { url } = response;
if (!url) process.exit(0);

const match = url.match(/github\.com\/([\w.\-]+)\/([\w.\-]+)/);
const owner = match[1];
const repo = match[2].replace(/\.git$/, '');

const spinner = ora({ text: 'Starting…', color: 'cyan' }).start();

try {
  // 1. Fetch repo
  const repoContext = await fetchRepo(owner, repo, (msg) => {
    spinner.text = msg;
  });

  const { metadata } = repoContext;
  spinner.text = `Fetched ${metadata.full_name} — ${metadata.stargazers_count?.toLocaleString()} ★`;

  // 2. Analyze
  spinner.text = `Analyzing codebase via \`${availableCLI} -p\` (this takes ~30–60s)…`;
  const markdown = await analyze(repoContext, (text) => {
    spinner.text = `Analyzing… ${text.length.toLocaleString()} characters received`;
  });

  spinner.text = 'Parsing analysis…';

  // 3. Parse
  const analysis = parseAnalysis(markdown, metadata);
  analysis.rawTree = repoContext.tree;

  // 4. Save
  const hash = createHash('md5').update(url).digest('hex').slice(0, 8);
  const tmpDir = join(RESULTS_DIR, `reverse-perspective-${hash}`);
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(join(tmpDir, 'analysis.json'), JSON.stringify(analysis, null, 2), 'utf-8');
  writeFileSync(join(tmpDir, 'analysis.md'), markdown, 'utf-8');

  // 5. Serve
  spinner.text = 'Starting local server…';
  const port = await startServer(analysis);

  spinner.succeed(`Ready — opening http://localhost:${port}`);
  console.log(`\n  Analysis saved to: ${tmpDir}`);
  console.log(`  Re-open later with: node bin/cli.js serve\n`);

  await open(`http://localhost:${port}`);
  console.log('  Press Ctrl+C to stop the server.');
  console.log('  To view again later, run: node bin/cli.js serve\n');
} catch (err) {
  spinner.fail('Something went wrong');
  console.error('\n' + err.message + '\n');
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
}
