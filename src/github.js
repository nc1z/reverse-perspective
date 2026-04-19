const BASE = 'https://api.github.com';
const HEADERS = {
  'User-Agent': 'reverse-perspective/0.1.0',
  'Accept': 'application/vnd.github.v3+json',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
};

async function ghFetch(path) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (res.status === 404) throw new Error(`Repository not found: ${path}`);
  if (res.status === 403) throw new Error('GitHub rate limit exceeded. Set GITHUB_TOKEN env var to increase limits.');
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${path}`);
  return res.json();
}

async function getFileContent(owner, repo, filePath) {
  try {
    const data = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`);
    if (data.encoding === 'base64') {
      return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    }
    return data.content || null;
  } catch {
    return null;
  }
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.cpp', '.c', '.rb', '.swift', '.kt', '.scala', '.ex', '.exs', '.zig'];
const SKIP_DIRS = ['node_modules', 'vendor', '.git', 'dist', 'build', '__pycache__', '.next', 'target', 'coverage'];

export async function fetchRepo(owner, repo, onProgress) {
  onProgress?.('Fetching repository metadata...');
  const metadata = await ghFetch(`/repos/${owner}/${repo}`);

  onProgress?.('Fetching file tree...');
  let tree = [];
  try {
    const branch = metadata.default_branch || 'main';
    const treeData = await ghFetch(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    tree = (treeData.tree || [])
      .filter(f => f.type === 'blob')
      .map(f => f.path)
      .filter(p => !SKIP_DIRS.some(d => p.includes(`/${d}/`) || p.startsWith(`${d}/`)));
  } catch (e) {
    onProgress?.(`Warning: Could not fetch tree — ${e.message}`);
  }

  onProgress?.('Fetching README...');
  const readme =
    (await getFileContent(owner, repo, 'README.md')) ||
    (await getFileContent(owner, repo, 'readme.md')) ||
    (await getFileContent(owner, repo, 'README.rst')) ||
    (await getFileContent(owner, repo, 'README')) ||
    '';

  onProgress?.('Fetching manifest file...');
  let manifest = null;
  for (const name of ['package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'pom.xml', 'requirements.txt', 'Gemfile', 'build.gradle']) {
    const content = await getFileContent(owner, repo, name);
    if (content) {
      manifest = { name, content };
      break;
    }
  }

  // Pick up to 15 interesting source files — prioritize entry points and core modules
  const PRIORITY_NAMES = ['index', 'main', 'app', 'server', 'cli', 'core', 'base', 'mod', 'lib'];
  const sourceFiles = tree
    .filter(p => SOURCE_EXTENSIONS.some(ext => p.endsWith(ext)))
    .sort((a, b) => {
      const aName = a.split('/').pop().replace(/\.[^.]+$/, '');
      const bName = b.split('/').pop().replace(/\.[^.]+$/, '');
      const aPri = PRIORITY_NAMES.some(n => aName.toLowerCase().includes(n)) ? 0 : 1;
      const bPri = PRIORITY_NAMES.some(n => bName.toLowerCase().includes(n)) ? 0 : 1;
      return aPri - bPri || a.split('/').length - b.split('/').length;
    })
    .slice(0, 15);

  const sourceContents = {};
  for (const filePath of sourceFiles) {
    onProgress?.(`Reading ${filePath}...`);
    const content = await getFileContent(owner, repo, filePath);
    if (content) {
      sourceContents[filePath] = content.length > 4000 ? content.slice(0, 4000) + '\n// ... (truncated)' : content;
    }
  }

  return { metadata, tree, readme, manifest, sourceFiles: sourceContents };
}
