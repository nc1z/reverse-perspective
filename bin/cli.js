#!/usr/bin/env node
import prompts from 'prompts';
import ora from 'ora';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, '..', 'tmp');

import { fetchRepo } from '../src/github.js';
import { analyze, availableAdapters } from '../src/analyzer.js';
import { parseAnalysis } from '../src/parser.js';
import { startServer } from '../src/server.js';
import open from 'open';

const onCancel = () => { console.log('\n  Cancelled.\n'); process.exit(0); };

// ── Banner ────────────────────────────────────────────────────────────────────
console.log('\n  reverse-perspective  —  understand any codebase from the inside out\n');

const subcommand = process.argv[2];

// ═══════════════════════════════════════════════════════════════════════════════
// serve  — re-open a previous analysis without re-running the AI
// ═══════════════════════════════════════════════════════════════════════════════
if (subcommand === 'serve') {
  const pathArg = process.argv[3];

  let analysisPath;

  if (pathArg) {
    analysisPath = pathArg.endsWith('analysis.json') ? pathArg : join(pathArg, 'analysis.json');
    if (!existsSync(analysisPath)) {
      console.error(`  ✗  Not found: ${analysisPath}\n`);
      process.exit(1);
    }
  } else {
    const saved = existsSync(RESULTS_DIR)
      ? readdirSync(RESULTS_DIR)
          .filter(d => d.startsWith('reverse-perspective-'))
          .map(d => {
            const dir = join(RESULTS_DIR, d);
            const file = join(dir, 'analysis.json');
            if (!existsSync(file)) return null;
            const stat = statSync(file);
            try {
              const data = JSON.parse(readFileSync(file, 'utf-8'));
              return { file, mtime: stat.mtime, name: data.repo?.fullName || d };
            } catch { return null; }
          })
          .filter(Boolean)
          .sort((a, b) => b.mtime - a.mtime)
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
      { onCancel }
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
  // Keep the process alive so the server keeps running
}

// ═══════════════════════════════════════════════════════════════════════════════
// default  — fetch + analyse + serve
// ═══════════════════════════════════════════════════════════════════════════════

// Check which AI adapters are available on this machine
const ready = availableAdapters();
if (!ready.length) {
  console.error('  ✗  No supported AI CLI found on PATH.\n');
  console.error('  Install one of:\n');
  console.error('    Claude Code  →  https://claude.ai/code');
  console.error('    Codex CLI    →  https://github.com/openai/codex');
  console.error('    Copilot CLI  →  https://githubnext.com/projects/copilot-cli\n');
  process.exit(1);
}

// 1. GitHub URL
const { url } = await prompts(
  {
    type: 'text',
    name: 'url',
    message: 'GitHub repository URL',
    hint: 'e.g. https://github.com/expressjs/express',
    validate: v =>
      /github\.com\/[\w.\-]+\/[\w.\-]+/.test(v)
        ? true
        : 'Please enter a valid GitHub URL (https://github.com/owner/repo)',
  },
  { onCancel }
);
if (!url) process.exit(0);

// 2. AI provider
const { adapterId } = await prompts(
  {
    type: 'select',
    name: 'adapterId',
    message: 'AI provider',
    choices: ready.map(a => ({
      title: a.label,
      description: a.hint,
      value: a.id,
    })),
  },
  { onCancel }
);
if (!adapterId) process.exit(0);

const adapter = ready.find(a => a.id === adapterId);

// 3. Model
const { model } = await prompts(
  {
    type: 'text',
    name: 'model',
    message: 'Model',
    initial: adapter.defaultModel,
  },
  { onCancel }
);
if (!model) process.exit(0);

// 3. Parse owner/repo
const match = url.match(/github\.com\/([\w.\-]+)\/([\w.\-]+)/);
const owner = match[1];
const repo  = match[2].replace(/\.git$/, '');

const spinner = ora({ text: 'Starting…', color: 'cyan' }).start();

try {
  // Fetch
  const repoContext = await fetchRepo(owner, repo, msg => { spinner.text = msg; });
  const { metadata } = repoContext;
  spinner.text = `Fetched ${metadata.full_name} — ${metadata.stargazers_count?.toLocaleString()} ★`;

  // Analyse
  const analyzeStart = Date.now();
  const elapsedTimer = setInterval(() => {
    const secs = Math.floor((Date.now() - analyzeStart) / 1000);
    spinner.text = `Analyzing via ${adapter.hint} (${model}) — ${secs}s elapsed`;
  }, 1000);
  spinner.text = `Analyzing via ${adapter.hint} (${model}) — 0s elapsed`;

  let markdown;
  try {
    markdown = await analyze(repoContext, adapter, model, () => {});
  } finally {
    clearInterval(elapsedTimer);
  }

  // Parse
  spinner.text = 'Parsing analysis…';
  const analysis = parseAnalysis(markdown, metadata);
  analysis.rawTree = repoContext.tree;

  // Save
  const hash = createHash('md5').update(url).digest('hex').slice(0, 8);
  const tmpDir = join(RESULTS_DIR, `reverse-perspective-${hash}`);
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(join(tmpDir, 'analysis.json'), JSON.stringify(analysis, null, 2), 'utf-8');
  writeFileSync(join(tmpDir, 'analysis.md'), markdown, 'utf-8');

  // Serve
  spinner.text = 'Starting local server…';
  const port = await startServer(analysis);

  spinner.succeed(`Ready — opening http://localhost:${port}`);
  console.log(`\n  Analysis saved to: ${tmpDir}`);
  console.log('  Press Ctrl+C to stop the server.');
  console.log(`  To view again later, run: node bin/cli.js serve ${tmpDir}\n`);

  await open(`http://localhost:${port}`);
} catch (err) {
  spinner.fail('Something went wrong');
  console.error('\n' + err.message + '\n');
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
}
