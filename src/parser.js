/**
 * Parse the AI response into a structured analysis object.
 * Handles JSON wrapped in code fences or surrounded by prose.
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

  try { return JSON.parse(s); } catch {}

  const fenced = s.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }

  const first = s.indexOf('{');
  const last  = s.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)); } catch {}
  }

  console.error('[parser] Could not extract JSON from AI response.');
  return {};
}

// ── Normalise ──────────────────────────────────────────────────────────────

function normalise(j) {
  return {
    abstract:      asString(j.abstract),
    architecture:  asArchitecture(j.architecture),
    e2eFlow:       asString(j.e2eFlow),
    keyDecisions:  asStringArray(j.keyDecisions),
    dependencies:  asDependencies(j.dependencies),
  };
}

function asString(v) {
  return typeof v === 'string' ? v : '';
}

function asStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map(String).filter(Boolean);
}

function asArchitecture(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      name: String(item.name ?? ''),
      role: String(item.role ?? ''),
    }))
    .filter(item => item.name);
}

function asDependencies(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      name:    String(item.name    ?? ''),
      purpose: String(item.purpose ?? ''),
    }))
    .filter(item => item.name);
}

function buildRepo(metadata) {
  return {
    name:        metadata.name,
    fullName:    metadata.full_name,
    url:         `https://github.com/${metadata.full_name}`,
    description: metadata.description || '',
    stars:       metadata.stargazers_count  ?? 0,
    forks:       metadata.forks_count       ?? 0,
    language:    metadata.language          || '',
    topics:      metadata.topics            || [],
    license:     metadata.license?.name     || '',
  };
}
