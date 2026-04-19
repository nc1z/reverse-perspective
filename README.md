# reverse-perspective

Understand any GitHub repository from the creator's perspective — not docs, not tutorials, but the actual engineering thought process behind it.

Point it at any public repo and get an animated, interactive breakdown served on localhost: mental model, folder tree, layer deep dives, dependency map, commit history, and more.

![demo](https://placeholder)

## How it works

1. Run the CLI and paste a GitHub URL
2. It fetches the repo structure and key files via the GitHub API
3. Sends everything to Claude (`claude -p`) with a "developer reconstruction" prompt
4. Parses the response into sections and saves to disk
5. Serves an animated frontend on localhost and opens your browser

## Getting started

**Prerequisites**

- Node.js 18+
- [Claude Code](https://claude.ai/code) installed and logged in (`claude` on your PATH)

```bash
git clone https://github.com/your-username/reverse-perspective
cd reverse-perspective
npm install
```

**Analyse a repository**

```bash
node bin/cli.js
```

You'll be prompted for a GitHub URL. The analysis takes ~30–60 seconds.

**Re-open a previous result**

```bash
node bin/cli.js serve
```

Picks from all saved analyses — no need to re-run the AI.

Or point directly at a saved folder:

```bash
node bin/cli.js serve /tmp/reverse-perspective-abc123/
```

## Optional

Set `GITHUB_TOKEN` to raise the GitHub API rate limit (useful for repos with many files):

```bash
export GITHUB_TOKEN=ghp_...
node bin/cli.js
```

## What you get

The frontend is a dark-themed, animated long-scroll page with 8 sections:

| # | Section | What it shows |
|---|---------|---------------|
| 1 | Mental model | The 3–5 core questions the codebase answers |
| 2 | Repo tree | Every top-level item annotated with why it exists |
| 3 | Layer deep dives | Per-subsystem breakdown with key abstractions and gotchas |
| 4 | Dependency map | Every dependency mapped to the layer it serves |
| 5 | Dev scaffolding | Linting, CI, tests — and why each exists |
| 6 | End-to-end flow | One command traced through every layer as an ASCII diagram |
| 7 | Commit story | The ~10 commits that would rebuild this from scratch |
| 8 | Cheat sheet | One sentence per layer |

## Tech

- **CLI** — Node.js ESM, `prompts`, `ora`
- **AI** — `claude --print` (Claude Code CLI) or `codex -p`
- **GitHub** — REST API v3, no auth required for public repos
- **Server** — Express.js
- **Frontend** — Vanilla HTML/CSS/JS, [anime.js](https://animejs.com), [highlight.js](https://highlightjs.org), [marked](https://marked.js.org)
