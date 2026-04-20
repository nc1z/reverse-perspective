const BASE = 'https://api.github.com';
const HEADERS = {
  'User-Agent': 'reverse-perspective/0.1.0',
  'Accept': 'application/vnd.github.v3+json',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
};

/**
 * Fetch only repository metadata (stars, forks, language, etc.)
 * Code context is handled by gitingest instead.
 */
export async function fetchMetadata(owner, repo) {
  const res = await fetch(`${BASE}/repos/${owner}/${repo}`, { headers: HEADERS });
  if (res.status === 404) throw new Error(`Repository not found: ${owner}/${repo}`);
  if (res.status === 403) throw new Error('GitHub rate limit exceeded. Set GITHUB_TOKEN env var.');
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  return res.json();
}

/**
 * Fetch the raw contents of specific files by path.
 * Returns { path: content } for files that were successfully retrieved.
 */
export async function fetchFiles(owner, repo, paths) {
  const results = {};
  for (const path of paths) {
    try {
      const res = await fetch(
        `${BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
        { headers: HEADERS }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data.encoding === 'base64') {
        results[path] = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
      }
    } catch {
      // skip files that can't be fetched
    }
  }
  return results;
}
