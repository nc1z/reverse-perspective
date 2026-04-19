/**
 * Parse the AI response into a structured analysis object.
 * The AI is asked to return raw JSON, but we handle common failure modes:
 *   - JSON wrapped in a ```json ... ``` code fence
 *   - Leading/trailing prose before/after the JSON object
 *   - Partially truncated responses
 */

export function parseAnalysis(raw, metadata) {
  const json = extractJSON(raw);
  const sections = normalise(json);

  return {
    repo: buildRepo(metadata),
    ...sections,
    rawMarkdown: raw,
  };
}

// ── JSON extraction ────────────────────────────────────────────────────────

function extractJSON(text) {
  const s = text.trim();

  // 1. Direct parse
  try { return JSON.parse(s); } catch {}

  // 2. Strip a ```json ... ``` or ``` ... ``` fence
  const fenced = s.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }

  // 3. Find the outermost { ... } span and try that
  const first = s.indexOf('{');
  const last  = s.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)); } catch {}
  }

  console.error('[parser] Could not extract JSON from AI response. Raw output saved to analysis.md.');
  return {};
}

// ── Normalise — fill in defaults so the frontend never sees undefined ──────

function normalise(j) {
  return {
    mentalModel:   asStringArray(j.mentalModel),
    repoTree:      asRepoTree(j.repoTree),
    layers:        asLayers(j.layers),
    dependencies:  asString(j.dependencies),
    devScaffolding:asString(j.devScaffolding),
    e2eFlow:       asString(j.e2eFlow),
    commitStory:   asCommitStory(j.commitStory),
    summaries:     asSummaries(j.summaries),
  };
}

function asString(v) {
  return typeof v === 'string' ? v : '';
}

function asStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map(String).filter(Boolean);
}

function asRepoTree(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      path:       String(item.path       ?? ''),
      annotation: String(item.annotation ?? ''),
    }))
    .filter(item => item.path);
}

function asLayers(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      name:    String(item.name    ?? 'Unnamed layer'),
      content: String(item.content ?? ''),
    }))
    .filter(item => item.name);
}

function asCommitStory(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter(item => item && typeof item === 'object')
    .map((item, i) => ({
      n:           Number(item.n ?? i + 1),
      message:     String(item.message     ?? ''),
      description: String(item.description ?? ''),
    }))
    .filter(item => item.message);
}

function asSummaries(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      layer:    String(item.layer    ?? ''),
      oneLiner: String(item.oneLiner ?? ''),
    }))
    .filter(item => item.layer);
}

function buildRepo(metadata) {
  return {
    name:        metadata.name,
    fullName:    metadata.full_name,
    url:         `https://github.com/${metadata.full_name}`,
    description: metadata.description || '',
    stars:       metadata.stargazers_count  ?? 0,
    forks:       metadata.forks_count       ?? 0,
    language:    metadata.language          || 'Unknown',
    topics:      metadata.topics            || [],
    createdAt:   metadata.created_at,
    pushedAt:    metadata.pushed_at,
    openIssues:  metadata.open_issues_count ?? 0,
    license:     metadata.license?.name     || null,
  };
}
