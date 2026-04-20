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

  const { repo, abstract, architecture, e2eFlow, keyDecisions, dependencies } = data;

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

  // Abstract
  $('abstract').textContent = abstract || '—';

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
  $('flow').textContent = e2eFlow || '—';

  // Key decisions
  $('decisions').innerHTML = (keyDecisions ?? [])
    .map(d => `<li>${esc(d)}</li>`).join('');

  // Dependencies
  $('deps').innerHTML = `<div class="deps-grid">${
    (dependencies ?? []).map(d => `
      <div class="dep-item">
        <span class="dep-name">${esc(d.name)}</span>
        <span class="dep-purpose">${esc(d.purpose)}</span>
      </div>`).join('')
  }</div>`;

  // Show page
  $('loading').style.display = 'none';
  $('app').hidden = false;
}

// Dark mode
$('dark-toggle').addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  $('dark-toggle').textContent = dark ? 'light' : 'dark';
});

init();
