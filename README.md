# reverse-perspective

Understand any GitHub repository from the creator's perspective — not docs, not tutorials, but the actual engineering thought process behind it.

Point it at any public repo and get an animated, interactive breakdown served on localhost: mental model, folder tree, layer deep dives, dependency map, commit history, and more.

![demo](https://placeholder)

## How it works

1. Run the CLI and paste a GitHub URL
2. Pick your AI provider and model
3. It fetches the repo structure and key files via the GitHub API
4. Sends everything to your chosen AI with a "developer reconstruction" prompt
5. Parses the response into sections and saves to disk
6. Serves an animated frontend on localhost and opens your browser

## Getting started

**Prerequisites**

- Node.js 18+
- At least one supported AI CLI installed and authenticated (see below)

```bash
git clone https://github.com/your-username/reverse-perspective
cd reverse-perspective
npm install
```

**Analyse a repository**

```bash
node bin/cli.js
```

You'll be prompted for a GitHub URL, your AI provider, and the model to use.

**Re-open a previous result**

```bash
node bin/cli.js serve
```

Picks from all saved analyses — no need to re-run the AI.

Or point directly at a saved folder:

```bash
node bin/cli.js serve ./tmp/reverse-perspective-abc123/
```

## Supported AI providers

The CLI detects which of these are on your PATH and shows only what's available:

| Provider | CLI | Default model |
|----------|-----|---------------|
| [Claude Code](https://claude.ai/code) | `claude` | `claude-sonnet-4-6` |
| [Codex](https://github.com/openai/codex) | `codex` | `gpt-5.4` |
| [GitHub Copilot](https://githubnext.com/projects/copilot-cli) | `copilot` | `claude-sonnet-4-6` |

The model prompt is pre-filled with the default — press Enter to accept or type any model ID supported by your provider.

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
- **AI** — adapter pattern; supports Claude Code, Codex, and GitHub Copilot CLIs
- **GitHub** — REST API v3, no auth required for public repos
- **Server** — Express.js
- **Frontend** — Vanilla HTML/CSS/JS, [anime.js](https://animejs.com), [highlight.js](https://highlightjs.org), [marked](https://marked.js.org)
