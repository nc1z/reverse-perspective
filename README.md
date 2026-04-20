# reverse-perspective

Understand any GitHub repository from the creator's perspective.

Point it at any public repo and get a research paper-style breakdown served on localhost: overview, architecture, end-to-end flow, reconstruction steps, and design decisions — all written in first person as if you built it.

## Getting started

**Prerequisites**

- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (for gitingest)
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

You'll be prompted for a GitHub URL, AI provider, and model.

**Re-open a previous result**

```bash
node bin/cli.js serve
```

## Supported AI providers

| Provider | CLI | Default model |
|----------|-----|---------------|
| [Claude Code](https://claude.ai/code) | `claude` | `claude-sonnet-4-6` |
| [Codex](https://github.com/openai/codex) | `codex` | `gpt-5.4` |
| [GitHub Copilot](https://githubnext.com/projects/copilot-cli) | `copilot` | `claude-sonnet-4-6` |

## What you get

A single-page research paper with 5 sections:

| Section | What it shows |
|---------|---------------|
| Overview | 2–3 sentence summary, first person |
| Architecture | Key components and what each does |
| End-to-end flow | ASCII diagram of the primary request path |
| How I'd rebuild this | Step-by-step reconstruction in build order |
| Design decisions | Specific choices made and why |

Export to PDF, DOCX, or Markdown via the toolbar.
