/* ── reverse-perspective · research paper UI ─────────────────────────────── */

const $ = id => document.getElementById(id);
const esc = str => String(str ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = n => n >= 1_000_000 ? (n/1e6).toFixed(1)+'M'
              : n >= 1_000 ? (n/1e3).toFixed(1)+'k'
              : String(n ?? 0);

async function init() {
  let data;
  try {
    const res = await fetch('/api/analysis');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    $('loading').innerHTML = `<span style="font-size:13px;color:#888">${err.message}</span>`;
    return;
  }

  window.__data = data;
  const { repo, overview, architecture, reconstruction, e2eFlow, decisions } = data;

  // Header
  $('repo-name').textContent = repo.name || repo.fullName;
  const urlEl = $('repo-url');
  urlEl.textContent = `github.com/${repo.fullName}`;
  urlEl.href = repo.url;

  const meta = [repo.language, repo.license].filter(Boolean).join(' · ');
  $('repo-stats').innerHTML = `
    <div class="stat-line">
      <span class="stat-value">${fmt(repo.stars)}</span> stars ·
      <span class="stat-value">${fmt(repo.forks)}</span> forks
    </div>
    ${meta ? `<div class="stat-line" style="margin-top:4px">${esc(meta)}</div>` : ''}`;

  // Overview
  $('overview').textContent = overview || '\u2014';

  // Architecture
  $('architecture').innerHTML = (architecture ?? []).map((item, i) => `
    <div class="arch-item">
      <div class="arch-num">${String(i + 1).padStart(2, '0')}</div>
      <div>
        <div class="arch-name">${esc(item.name)}</div>
        <div class="arch-role">${esc(item.role)}</div>
      </div>
    </div>`).join('');

  // E2E Flow
  $('flow').textContent = e2eFlow || '\u2014';

  // Reconstruction
  $('reconstruction').innerHTML = (reconstruction ?? [])
    .map(step => `<li>${esc(step)}</li>`).join('');

  // Decisions
  $('decisions').innerHTML = (decisions ?? [])
    .map(d => `<li>${esc(d)}</li>`).join('');

  // Show
  $('loading').style.display = 'none';
  $('app').hidden = false;
}

// Dark mode
$('dark-toggle').addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  $('dark-toggle').textContent = dark ? 'light' : 'dark';
});

// Export dropdown
const exportBtn = $('export-btn');
const exportMenu = $('export-menu');

exportBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  exportMenu.classList.toggle('open');
});
document.addEventListener('click', () => exportMenu.classList.remove('open'));

exportMenu.addEventListener('click', (e) => {
  const format = e.target.dataset.format;
  if (!format) return;
  exportMenu.classList.remove('open');

  if (format === 'pdf') exportPDF();
  else if (format === 'docx') exportDOCX();
  else if (format === 'md') exportMarkdown();
});

function exportPDF() {
  // Use browser print to PDF
  window.print();
}

function exportDOCX() {
  // Generate a simple HTML blob that Word can open
  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Export</title></head>
<body>${document.querySelector('.paper').innerHTML}</body></html>`;

  const blob = new Blob([html], { type: 'application/msword' });
  downloadBlob(blob, `${getFilename()}.doc`);
}

function exportMarkdown() {
  const d = window.__data;
  if (!d) return;

  const lines = [
    `# ${d.repo.name || d.repo.fullName}`,
    '',
    `> ${d.overview}`,
    '',
    '## Architecture',
    '',
    ...(d.architecture ?? []).map((a, i) => `${i+1}. **${a.name}** — ${a.role}`),
    '',
    '## End-to-End Flow',
    '',
    '```',
    d.e2eFlow || '',
    '```',
    '',
    '## How I\'d Rebuild This',
    '',
    ...(d.reconstruction ?? []).map((s, i) => `${i+1}. ${s}`),
    '',
    '## Design Decisions',
    '',
    ...(d.decisions ?? []).map(d => `- ${d}`),
    '',
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  downloadBlob(blob, `${getFilename()}.md`);
}

function getFilename() {
  return window.__data?.repo?.name || 'reverse-perspective';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

init();
