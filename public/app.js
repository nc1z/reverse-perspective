/* ── reverse-perspective · book UI ───────────────────────────────────────── */

const $ = id => document.getElementById(id);
const el = (tag, cls, html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const fmt = n => n >= 1_000_000 ? (n/1e6).toFixed(1)+'M' : n >= 1_000 ? (n/1e3).toFixed(1)+'k' : String(n ?? 0);

marked.setOptions({ gfm: true, breaks: true });

// ── State ──────────────────────────────────────────────────────────────────
let data       = null;
let spread     = 0;
let animating  = false;

// ── Spread definitions ─────────────────────────────────────────────────────
// Each entry: [leftRenderer, rightRenderer]
// Renderers receive (container, data)
const SPREADS = [
  [renderEndpaper,     renderCover],
  [renderTOC,          renderMentalModel],
  [renderRepoTree,     renderLayers],
  [renderDependencies, renderScaffolding],
  [renderFlow,         renderCommits],
  [renderSummary,      renderBackCover],
];

const SPREAD_LABELS = [
  '',
  'I · Mental Model',
  'II · Repository',
  'III · Dependencies',
  'IV · Flow & History',
  'V · Cheat Sheet',
];

// ── Page renderers ─────────────────────────────────────────────────────────

function renderEndpaper(container) {
  container.innerHTML = `
    <div class="endpaper" style="margin:-44px -40px -36px; height:calc(100% + 80px)">
      <div class="endpaper-pattern">
        <div class="endpaper-ornament">⊕</div>
      </div>
    </div>`;
}

function renderCover(container, d) {
  const repo = d?.repo ?? {};
  container.innerHTML = `
    <div class="cover-page" style="margin:-44px -40px -36px; height:calc(100% + 80px)">
      <div class="cover-border"></div>
      <div class="cover-corner tl">✦</div>
      <div class="cover-corner tr">✦</div>
      <div class="cover-corner bl">✦</div>
      <div class="cover-corner br">✦</div>
      <div class="cover-eyebrow">reverse-perspective</div>
      <div class="cover-title">${esc(repo.name || repo.fullName || '…')}</div>
      <div class="cover-divider"></div>
      <div class="cover-desc">${esc(repo.description || 'A developer\u2019s deep dive')}</div>
      <div class="cover-stats">
        <div class="cover-stat">
          <div class="cover-stat-value">${fmt(repo.stars)}</div>
          <div class="cover-stat-label">Stars</div>
        </div>
        <div class="cover-stat">
          <div class="cover-stat-value">${fmt(repo.forks)}</div>
          <div class="cover-stat-label">Forks</div>
        </div>
        <div class="cover-stat">
          <div class="cover-stat-value">${fmt((d?.rawTree ?? []).length)}</div>
          <div class="cover-stat-label">Files</div>
        </div>
      </div>
      <div class="cover-footer">${esc(repo.language || '')}${repo.language && repo.license ? ' · ' : ''}${esc(repo.license || '')}</div>
    </div>`;
}

function renderTOC(container) {
  const chapters = [
    'Mental Model',
    'Repository Structure',
    'Dependencies',
    'Dev Scaffolding',
    'End-to-End Flow',
    'Commit History',
    'Cheat Sheet',
  ];
  const pages = [3, 5, 7, 8, 9, 11, 13];

  let html = pageHeader('Contents', null, 'Table of Contents');
  html += '<div style="margin-top:8px">';
  chapters.forEach((name, i) => {
    html += `<div class="toc-item">
      <span class="toc-num">${String(i+1).padStart(2,'0')}</span>
      <span class="toc-name">${name}</span>
      <span class="toc-dots"></span>
      <span class="toc-page">${pages[i]}</span>
    </div>`;
  });
  html += '</div>';
  html += '<div class="page-number left">2</div>';
  container.innerHTML = html;
}

function renderMentalModel(container, d) {
  const items = d?.mentalModel ?? [];
  let html = pageHeader('I', 'Mental Model', 'The core questions this codebase answers');
  if (!items.length) {
    html += '<p class="ch-subtitle">No data parsed for this section.</p>';
  } else {
    items.forEach((text, i) => {
      html += `<div class="mm-item">
        <div class="mm-num">${String(i+1).padStart(2,'0')}</div>
        <div class="mm-text">${esc(text)}</div>
      </div>`;
    });
  }
  html += '<div class="page-number right">3</div>';
  container.innerHTML = html;
}

function renderRepoTree(container, d) {
  const annotations = d?.repoTree ?? [];
  let html = pageHeader('II', 'Repo Tree', 'Every top-level item and why it exists');

  if (annotations.length) {
    html += '<div class="tree-annotations">';
    annotations.slice(0, 18).forEach(item => {
      html += `<div class="ann-item">
        <div class="ann-path">${esc(item.path)}</div>
        <div class="ann-text">${esc(item.annotation)}</div>
      </div>`;
    });
    html += '</div>';
  } else if (d?.rawTree?.length) {
    // Fallback: render plain tree
    html += '<div class="file-tree">';
    const preview = buildTreePreview(d.rawTree.slice(0, 60));
    html += preview;
    html += '</div>';
  } else {
    html += '<p class="ch-subtitle">No tree data available.</p>';
  }

  html += '<div class="page-number left">4</div>';
  container.innerHTML = html;
  // Init interactive tree if rendered
  initTreeNodes(container);
}

function buildTreePreview(paths) {
  // Simple indent-based flat list
  return paths.map(p => {
    const depth = p.split('/').length - 1;
    const name = p.split('/').pop();
    const pad = '  '.repeat(depth);
    const isDir = !name.includes('.');
    return `<div style="padding-left:${depth * 12}px;color:${isDir ? 'var(--ink)' : 'var(--ink-2)'}">${pad}${name}</div>`;
  }).join('');
}

function initTreeNodes(container) {
  container.querySelectorAll('.tree-node.is-dir').forEach(node => {
    const wrapper = node.closest('.tree-node-wrapper');
    if (!wrapper) return;
    const children = wrapper.querySelector('.tree-children');
    if (!children) return;
    node.addEventListener('click', () => {
      const isOpen = node.classList.toggle('open');
      children.style.maxHeight = isOpen ? children.scrollHeight + 'px' : '0';
    });
  });
}

function renderLayers(container, d) {
  const layers = d?.layers ?? [];
  let html = pageHeader('II', 'Layer Deep Dives', 'How each subsystem was designed');

  if (!layers.length) {
    html += '<p class="ch-subtitle">No layers parsed.</p>';
  } else {
    layers.forEach(layer => {
      html += `<div class="layer-item">
        <div class="layer-name">${esc(layer.name)}</div>
        <div class="layer-content prose">${marked.parse(layer.content || '')}</div>
      </div>`;
    });
  }

  html += '<div class="page-number right">5</div>';
  container.innerHTML = html;
  container.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
}

function renderDependencies(container, d) {
  let html = pageHeader('III', 'Dependencies', 'Every dependency mapped to the layer it serves');
  if (d?.dependencies) {
    html += `<div class="prose">${marked.parse(d.dependencies)}</div>`;
  } else {
    html += '<p class="ch-subtitle">No dependency data available.</p>';
  }
  html += '<div class="page-number left">6</div>';
  container.innerHTML = html;
  container.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
}

function renderScaffolding(container, d) {
  let html = pageHeader('III', 'Dev Scaffolding', 'Linting, CI, tests — and why each exists');
  if (d?.devScaffolding) {
    html += `<div class="prose">${marked.parse(d.devScaffolding)}</div>`;
  } else {
    html += '<p class="ch-subtitle">No scaffolding data available.</p>';
  }
  html += '<div class="page-number right">7</div>';
  container.innerHTML = html;
  container.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
}

function renderFlow(container, d) {
  let html = pageHeader('IV', 'End-to-End Flow', 'One command traced through every layer');
  if (d?.e2eFlow) {
    html += `<div class="flow-diagram">${esc(d.e2eFlow)}</div>`;
  } else {
    html += '<p class="ch-subtitle">No flow diagram available.</p>';
  }
  html += '<div class="page-number left">8</div>';
  container.innerHTML = html;
}

function renderCommits(container, d) {
  const commits = d?.commitStory ?? [];
  let html = pageHeader('IV', 'Built From Scratch', 'The commits that would reconstruct this today');

  if (!commits.length) {
    html += '<p class="ch-subtitle">No commit story parsed.</p>';
  } else {
    html += '<div class="commits">';
    commits.forEach(c => {
      html += `<div class="commit">
        <div class="commit-n">commit ${c.n}</div>
        <div class="commit-msg">${esc(c.message)}</div>
        ${c.description ? `<div class="commit-desc">${esc(c.description)}</div>` : ''}
      </div>`;
    });
    html += '</div>';
  }

  html += '<div class="page-number right">9</div>';
  container.innerHTML = html;
}

function renderSummary(container, d) {
  const summaries = d?.summaries ?? [];
  let html = pageHeader('V', 'Cheat Sheet', 'One sentence per layer — the whole codebase in a glance');

  if (!summaries.length) {
    html += '<p class="ch-subtitle">No summaries parsed.</p>';
  } else {
    summaries.forEach(s => {
      html += `<div class="summary-item">
        <div class="summary-layer">${esc(s.layer)}</div>
        <div class="summary-text">${esc(s.oneLiner)}</div>
      </div>`;
    });
  }

  html += '<div class="page-number left">10</div>';
  container.innerHTML = html;
}

function renderBackCover(container, d) {
  const repo = d?.repo ?? {};
  container.innerHTML = `
    <div class="back-cover" style="margin:-44px -40px -36px; height:calc(100% + 80px)">
      <div class="back-cover-border"></div>
      <div class="back-cover-ornament">✦</div>
      <div class="back-cover-text">
        ${esc(repo.fullName || '')}
      </div>
    </div>`;
}

// ── Page header helper ─────────────────────────────────────────────────────
function pageHeader(eyebrow, title, subtitle) {
  return `
    ${eyebrow ? `<div class="ch-eyebrow">Chapter ${eyebrow}</div>` : ''}
    ${title   ? `<div class="ch-title">${esc(title)}</div>` : ''}
    <div class="ch-rule"></div>
    ${subtitle ? `<div class="ch-subtitle">${esc(subtitle)}</div>` : ''}
  `;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Render a spread into DOM ───────────────────────────────────────────────
function renderSpread(index, leftEl, rightEl) {
  const [leftFn, rightFn] = SPREADS[index];
  leftFn(leftEl, data);
  rightFn(rightEl, data);
}

// ── Page flip animation ────────────────────────────────────────────────────
async function flipForward() {
  if (animating || spread >= SPREADS.length - 1) return;
  animating = true;

  const next = spread + 1;
  const rightPage  = $('right-page');
  const frontContent = $('front-content');
  const backContent  = $('back-content');
  const leftContent  = $('left-content');

  // Front = current right, Back = next left
  renderSpread(spread, { innerHTML: '' }, frontContent);
  SPREADS[spread][1](frontContent, data);
  SPREADS[next][0](backContent, data);

  await anime({
    targets: rightPage,
    rotateY: [0, -180],
    duration: 700,
    easing: 'cubicBezier(0.645, 0.045, 0.355, 1.000)',
  }).finished;

  spread = next;

  // Settle: update left, reset flip, show new right front
  SPREADS[spread][0](leftContent, data);
  SPREADS[spread][1](frontContent, data);
  rightPage.style.transform = 'rotateY(0deg)';

  updateUI();
  animating = false;
}

async function flipBackward() {
  if (animating || spread <= 0) return;
  animating = true;

  const prev = spread - 1;
  const rightPage    = $('right-page');
  const frontContent = $('front-content');
  const backContent  = $('back-content');
  const leftContent  = $('left-content');

  // Front = prev right, Back = current left (what's visible now)
  SPREADS[prev][1](frontContent, data);
  SPREADS[spread][0](backContent, data);

  // Start already-flipped (back = current left is showing)
  rightPage.style.transform = 'rotateY(-180deg)';

  // Small tick so browser registers the starting transform before animating
  await new Promise(r => requestAnimationFrame(r));

  await anime({
    targets: rightPage,
    rotateY: [-180, 0],
    duration: 700,
    easing: 'cubicBezier(0.645, 0.045, 0.355, 1.000)',
  }).finished;

  spread = prev;

  SPREADS[spread][0](leftContent, data);
  rightPage.style.transform = 'rotateY(0deg)';

  updateUI();
  animating = false;
}

// ── UI state ──────────────────────────────────────────────────────────────
function updateUI() {
  $('nav-prev').disabled = spread === 0;
  $('nav-next').disabled = spread === SPREADS.length - 1;

  const label = SPREAD_LABELS[spread] || '';
  $('page-indicator').textContent = label ? `— ${label} —` : '';

  // Spine title
  const repo = data?.repo?.name || data?.repo?.fullName || '';
  $('spine-title').textContent = repo ? `${repo}  ·  reverse-perspective` : 'reverse-perspective';
}

// ── Init ──────────────────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('/api/analysis');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    $('loading').innerHTML = `
      <div class="loading-inner">
        <div style="font-size:32px;color:#c9a84c;margin-bottom:16px">✗</div>
        <div style="font-family:'Lora',serif;color:#f7f2e8;font-size:14px;font-style:italic">
          Could not load analysis<br><br>
          <span style="font-size:12px;color:#6a7a8a">${err.message}</span>
        </div>
      </div>`;
    return;
  }

  // Render initial spread (cover)
  renderSpread(0, $('left-content'), $('front-content'));
  updateUI();

  // Wire navigation
  $('nav-next').addEventListener('click', flipForward);
  $('nav-prev').addEventListener('click', flipBackward);

  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') flipForward();
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   flipBackward();
  });

  // Click on page edges to flip
  $('right-page').addEventListener('click', e => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX > rect.left + rect.width * 0.7) flipForward();
  });
  $('left-page').addEventListener('click', e => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left + rect.width * 0.3) flipBackward();
  });

  // Add keyboard hint
  const hint = el('div', 'key-hint');
  hint.textContent = '← → arrow keys to turn pages';
  document.body.appendChild(hint);

  // Dismiss loading
  anime({
    targets: '#loading',
    opacity: [1, 0],
    duration: 600,
    easing: 'easeInQuad',
    complete: () => {
      $('loading').style.display = 'none';
      $('app').style.display = 'flex';
      anime({
        targets: '.book',
        opacity: [0, 1],
        scale: [0.96, 1],
        duration: 700,
        easing: 'easeOutExpo',
      });
    },
  });
}

init();
