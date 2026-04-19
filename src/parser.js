/**
 * Parses Claude's markdown response into a structured JSON object
 * for the frontend to consume.
 */
export function parseAnalysis(markdown, metadata) {
  const sections = splitBySections(markdown);

  return {
    repo: {
      name: metadata.name,
      fullName: metadata.full_name,
      url: `https://github.com/${metadata.full_name}`,
      description: metadata.description || '',
      stars: metadata.stargazers_count ?? 0,
      forks: metadata.forks_count ?? 0,
      language: metadata.language || 'Unknown',
      topics: metadata.topics || [],
      createdAt: metadata.created_at,
      pushedAt: metadata.pushed_at,
      openIssues: metadata.open_issues_count ?? 0,
      license: metadata.license?.name || null,
    },
    mentalModel: extractMentalModel(sections.mentalModel || ''),
    repoTree: extractAnnotatedTree(sections.repoTree || ''),
    layers: extractLayers(sections.layers || ''),
    dependencies: sections.dependencies || '',
    devScaffolding: sections.devScaffolding || '',
    e2eFlow: sections.e2eFlow || '',
    commitStory: extractCommitStory(sections.commitStory || ''),
    summaries: extractSummaries(sections.summaries || ''),
    rawMarkdown: markdown,
  };
}

/**
 * Split the markdown into named sections by detecting the 8 required headings.
 */
function splitBySections(markdown) {
  const SECTION_PATTERNS = [
    { key: 'mentalModel',    re: /mental\s*model/i },
    { key: 'repoTree',       re: /top.?level\s*repo\s*tree|repo\s*tree|repository\s*tree/i },
    { key: 'layers',         re: /per.?layer\s*deep\s*dive|layer\s*deep\s*dive|deep\s*dive/i },
    { key: 'dependencies',   re: /dependencies|dependency|manifest/i },
    { key: 'devScaffolding', re: /dev\s*scaffolding|scaffolding|ci\s*\/?\s*cd/i },
    { key: 'e2eFlow',        re: /end.to.end\s*flow|e2e\s*flow|end.to.end/i },
    { key: 'commitStory',    re: /commit\s*history|commit\s*story/i },
    { key: 'summaries',      re: /one.sentence\s*summary|cheat\s*sheet|summary\s*per\s*layer/i },
  ];

  const result = {};
  let currentKey = null;
  let currentLines = [];

  const flush = () => {
    if (currentKey) result[currentKey] = currentLines.join('\n').trim();
  };

  for (const line of markdown.split('\n')) {
    // Only match on heading lines (##, ###)
    if (/^#{1,3}\s/.test(line)) {
      const heading = line.replace(/^#+\s*/, '');
      const matched = SECTION_PATTERNS.find(({ re }) => re.test(heading));
      if (matched) {
        flush();
        currentKey = matched.key;
        currentLines = [];
        continue;
      }
    }
    if (currentKey) currentLines.push(line);
  }
  flush();

  return result;
}

function extractMentalModel(text) {
  const items = [];
  for (const line of text.split('\n')) {
    // Match: "1. question", "- question", "* question"
    const m = line.match(/^\s*(?:\d+[.)]\s+|\*\s+|-\s+)(.{10,})$/);
    if (m) items.push(m[1].trim().replace(/\*\*/g, ''));
  }
  // Fallback: return non-empty lines as paragraphs
  if (!items.length) {
    return text.split('\n').map(l => l.trim()).filter(l => l.length > 15).slice(0, 5);
  }
  return items;
}

function extractAnnotatedTree(text) {
  const items = [];
  for (const line of text.split('\n')) {
    // Match: "`src/` — reason" or "src/ — reason" or "- `foo` — reason"
    const m = line.match(/[`']?([\w.\-/]+(?:\/)?)[`']?\s+[—–-]+\s+(.+)/);
    if (m) {
      items.push({ path: m[1].trim(), annotation: m[2].trim().replace(/\*\*/g, '') });
    }
  }
  return items;
}

function extractLayers(text) {
  // Split on ### headings within the layers section
  const layers = [];
  const parts = text.split(/\n(?=###\s)/);
  for (const part of parts) {
    const lines = part.split('\n');
    const heading = lines[0].replace(/^#+\s*/, '').trim();
    if (!heading || heading.length < 2) continue;
    layers.push({
      name: heading,
      content: lines.slice(1).join('\n').trim(),
    });
  }
  return layers;
}

function extractCommitStory(text) {
  const commits = [];
  let n = 0;
  for (const line of text.split('\n')) {
    // "1. feat: init repo — sets up package.json" or "- commit message — description"
    const m = line.match(/^\s*(?:\d+[.)]\s+|-\s+|\*\s+)(.+)/);
    if (m) {
      n++;
      const full = m[1].trim().replace(/\*\*/g, '');
      // Try to split on dash separator
      const sep = full.match(/^(.+?)\s+[—–-]{1,2}\s+(.+)$/);
      if (sep) {
        commits.push({ n, message: sep[1].trim(), description: sep[2].trim() });
      } else {
        commits.push({ n, message: full, description: '' });
      }
    }
  }
  return commits;
}

function extractSummaries(text) {
  const summaries = [];
  for (const line of text.split('\n')) {
    // "**Layer** — one liner" or "- **Layer**: one liner"
    const m = line.match(/^\s*[-*\d.)]*\s*\*\*(.+?)\*\*\s*[—–:\-]+\s*(.+)$/);
    if (m) {
      summaries.push({ layer: m[1].trim(), oneLiner: m[2].trim() });
      continue;
    }
    // "- Layer Name — one liner" (no bold)
    const m2 = line.match(/^\s*[-*\d.)]+\s+(.+?)\s+[—–]{1,2}\s+(.+)$/);
    if (m2 && m2[2].trim().length > 10) {
      summaries.push({ layer: m2[1].trim().replace(/\*\*/g, ''), oneLiner: m2[2].trim() });
    }
  }
  return summaries;
}
