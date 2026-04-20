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
