/* ── reverse-perspective · book UI ───────────────────────────────────────── */

const $ = id => document.getElementById(id);
const el = (tag, cls, html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const fmt = n => n >= 1_000_000 ? (n/1e6).toFixed(1)+'M' : n >= 1_000 ? (n/1e3).toFixed(1)+'k' : String(n ?? 0);
const esc = str => String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

marked.setOptions({ gfm: true, breaks: true });

// ── State ──────────────────────────────────────────────────────────────────
let data      = null;
let SPREADS   = [];   // [[leftPage, rightPage], …] — built after measurement
let spread    = 0;
let animating = false;

// A Page = { html: string, init?: (container: HTMLElement) => void }

// ── HTML helpers ──────────────────────────────────────────────────────────

function sectionHeader(eyebrow, title, subtitle) {
  return (eyebrow ? `<div class="ch-eyebrow">Chapter ${esc(eyebrow)}</div>` : '')
    + `<div class="ch-title">${esc(title)}</div>`
    + `<div class="ch-rule"></div>`
    + (subtitle ? `<div class="ch-subtitle">${esc(subtitle)}</div>` : '');
}

function contHeader(title) {
  return `<div class="cont-header"><span class="cont-title">${esc(title)}</span><span class="cont-continued"> — continued</span></div>`;
}

// Parse markdown → array of top-level block HTML strings
function markdownToBlocks(md) {
  if (!md) return [];
  const div = document.createElement('div');
  div.innerHTML = marked.parse(md);
  return Array.from(div.children).map(c => c.outerHTML);
}

// ── Fixed-page HTML builders ──────────────────────────────────────────────

function htmlEndpaper() {
  return `<div class="endpaper" style="margin:-52px -48px -44px;height:calc(100% + 96px)">
    <div class="endpaper-pattern"><div class="endpaper-ornament">⊕</div></div>
  </div>`;
}

function htmlCover(d) {
  const repo = d?.repo ?? {};
  return `<div class="cover-page" style="margin:-52px -48px -44px;height:calc(100% + 96px)">
    <div class="cover-border"></div>
    <div class="cover-corner tl">✦</div><div class="cover-corner tr">✦</div>
    <div class="cover-corner bl">✦</div><div class="cover-corner br">✦</div>
    <div class="cover-eyebrow">reverse-perspective</div>
    <div class="cover-title">${esc(repo.name || repo.fullName || '…')}</div>
    <div class="cover-divider"></div>
    <div class="cover-desc">${esc(repo.description || 'A developer\u2019s deep dive')}</div>
    <div class="cover-stats">
      <div class="cover-stat"><div class="cover-stat-value">${fmt(repo.stars)}</div><div class="cover-stat-label">Stars</div></div>
      <div class="cover-stat"><div class="cover-stat-value">${fmt(repo.forks)}</div><div class="cover-stat-label">Forks</div></div>
      <div class="cover-stat"><div class="cover-stat-value">${fmt((d?.rawTree ?? []).length)}</div><div class="cover-stat-label">Files</div></div>
    </div>
    <div class="cover-footer">${esc(repo.language || '')}${repo.language && repo.license ? ' · ' : ''}${esc(repo.license || '')}</div>
  </div>`;
}

function htmlTOC(entries) {
  let html = `<div class="ch-title">Contents</div><div class="ch-rule"></div><div style="margin-top:8px">`;
  entries.forEach((e, i) => {
    html += `<div class="toc-item">
      <span class="toc-num">${String(i+1).padStart(2,'0')}</span>
      <span class="toc-name">${esc(e.name)}</span>
      <span class="toc-dots"></span>
      <span class="toc-page">${e.pageNum}</span>
    </div>`;
  });
  html += '</div>';
  return html;
}

function htmlBackCover(d) {
  const repo = d?.repo ?? {};
  return `<div class="back-cover" style="margin:-52px -48px -44px;height:calc(100% + 96px)">
    <div class="back-cover-border"></div>
    <div class="back-cover-ornament">✦</div>
    <div class="back-cover-text">${esc(repo.fullName || '')}</div>
  </div>`;
}

// ── Per-section item builders ─────────────────────────────────────────────

function mentalModelItems(d) {
  return (d?.mentalModel ?? []).map((text, i) =>
    `<div class="mm-item">
      <div class="mm-num">${String(i+1).padStart(2,'0')}</div>
      <div class="mm-text">${esc(text)}</div>
    </div>`);
}

function repoTreeItems(d) {
  const annotations = d?.repoTree ?? [];
  if (!annotations.length && d?.rawTree?.length) {
    return d.rawTree.slice(0, 100).map(p => {
      const depth = p.split('/').length - 1;
      return `<div style="padding-left:${depth*12}px;font-family:var(--font-mono);font-size:11px;color:var(--ink-2);line-height:1.6">${esc(p.split('/').pop())}</div>`;
    });
  }
  return annotations.map(item =>
    `<div class="ann-item">
      <div class="ann-path">${esc(item.path)}</div>
      <div class="ann-text">${esc(item.annotation)}</div>
    </div>`);
}

function layerItems(d) {
  const items = [];
  for (const layer of (d?.layers ?? [])) {
    const blocks = markdownToBlocks(layer.content || '');
    const nameHTML = `<div class="layer-name">${esc(layer.name)}</div>`;
    if (!blocks.length) {
      items.push(`<div class="layer-item">${nameHTML}</div>`);
      continue;
    }
    // Keep name and first block together so headers aren't orphaned
    items.push(`<div class="layer-item">${nameHTML}<div class="prose">${blocks[0]}</div></div>`);
    for (let i = 1; i < blocks.length; i++) {
      items.push(`<div class="layer-cont prose">${blocks[i]}</div>`);
    }
  }
  return items;
}

function dependencyItems(d) {
  if (!d?.dependencies) return [];
  return markdownToBlocks(d.dependencies).map(b => `<div class="prose">${b}</div>`);
}

function scaffoldingItems(d) {
  if (!d?.devScaffolding) return [];
  return markdownToBlocks(d.devScaffolding).map(b => `<div class="prose">${b}</div>`);
}

function flowItems(d) {
  if (!d?.e2eFlow) return [];
  return [`<div class="flow-diagram">${esc(d.e2eFlow)}</div>`];
}

function commitItems(d) {
  return (d?.commitStory ?? []).map(c =>
    `<div class="commit">
      <div class="commit-n">commit ${c.n}</div>
      <div class="commit-msg">${esc(c.message)}</div>
      ${c.description ? `<div class="commit-desc">${esc(c.description)}</div>` : ''}
    </div>`);
}

function summaryItems(d) {
  return (d?.summaries ?? []).map(s =>
    `<div class="summary-item">
      <div class="summary-layer">${esc(s.layer)}</div>
      <div class="summary-text">${esc(s.oneLiner)}</div>
    </div>`);
}

// ── Paginator ─────────────────────────────────────────────────────────────
// Fills a measuring div one item at a time.
// When adding an item would overflow the page height, close the current page
// and start a new continuation page.

function paginate(measurer, maxH, headerHTML, contHTML, itemHTMLs, initFn) {
  if (!itemHTMLs.length) {
    return [{ html: headerHTML + '<p class="ch-subtitle" style="margin-top:20px;font-style:italic;color:var(--ink-3)">Nothing to display.</p>', init: initFn }];
  }

  const pages = [];
  let current = headerHTML;
  let itemsOnPage = 0;

  for (const item of itemHTMLs) {
    const candidate = current + item;
    measurer.innerHTML = candidate;

    if (measurer.scrollHeight > maxH && itemsOnPage > 0) {
      // Item doesn't fit — commit current page, start continuation
      pages.push({ html: current, init: initFn });
      current = contHTML + item;
      itemsOnPage = 1;
    } else {
      // Fits (or is the only item — must go somewhere)
      current = candidate;
      itemsOnPage++;
    }
  }

  pages.push({ html: current, init: initFn });
  return pages;
}

// ── Build all pages from data ─────────────────────────────────────────────

function buildAllPages(d) {
  // Measure the actual rendered page dimensions
  const ref = $('front-content');
  const rect = ref.getBoundingClientRect();

  // Off-screen measuring div — same class = same padding/fonts/sizes.
  // height:auto overrides the `height:100%` in .page-inner so the div grows
  // with content; scrollHeight then reflects the true content height.
  const measurer = document.createElement('div');
  measurer.className = 'page-inner';
  measurer.style.cssText = [
    'position:fixed',
    'top:-99999px',
    'left:-99999px',
    `width:${rect.width}px`,
    'height:auto',
    'overflow:visible',
    'visibility:hidden',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(measurer);

  const maxH = rect.height;
  const hlInit = cnt => cnt.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));

  const pages = [];
  // Track where each section starts (pre-TOC insertion index)
  const sectionStarts = {};

  function section(name, items, header, cont, init) {
    sectionStarts[name] = pages.length;
    pages.push(...paginate(measurer, maxH, header, cont, items, init));
  }

  // ── Fixed pages ──────────────────────────────────────────────────────────
  pages.push({ html: htmlEndpaper() });
  pages.push({ html: htmlCover(d) });

  // ── Content sections ──────────────────────────────────────────────────────
  section('Mental Model', mentalModelItems(d),
    sectionHeader('I', 'Mental Model', 'The core questions this codebase answers'),
    contHeader('Mental Model'));

  section('Repository', repoTreeItems(d),
    sectionHeader('II', 'Repository', 'Every top-level path and why it exists'),
    contHeader('Repository'),
    cnt => initTreeNodes(cnt));

  section('Layers', layerItems(d),
    sectionHeader('II', 'Layer Deep Dives', 'How each subsystem was designed'),
    contHeader('Layer Deep Dives'),
    hlInit);

  section('Dependencies', dependencyItems(d),
    sectionHeader('III', 'Dependencies', 'Every dependency mapped to the layer it serves'),
    contHeader('Dependencies'),
    hlInit);

  section('Dev Scaffolding', scaffoldingItems(d),
    sectionHeader('III', 'Dev Scaffolding', 'Linting, CI, tests \u2014 and why each exists'),
    contHeader('Dev Scaffolding'),
    hlInit);

  section('E2E Flow', flowItems(d),
    sectionHeader('IV', 'End-to-End Flow', 'One command traced through every layer'),
    contHeader('E2E Flow'));

  section('Commit Story', commitItems(d),
    sectionHeader('IV', 'Built From Scratch', 'The commits that would reconstruct this today'),
    contHeader('Commit Story'));

  section('Cheat Sheet', summaryItems(d),
    sectionHeader('V', 'Cheat Sheet', 'One sentence per layer \u2014 the whole codebase at a glance'),
    contHeader('Cheat Sheet'));

  // ── Back cover ────────────────────────────────────────────────────────────
  pages.push({ html: htmlBackCover(d) });

  measurer.remove();

  // Build TOC now that we know where each section starts.
  // TOC will be inserted at index 2, shifting all content pages by +1.
  const tocEntries = Object.entries(sectionStarts).map(([name, idx]) => ({
    name,
    // After TOC insertion at 2: page index becomes idx+1; 1-based: idx+2
    pageNum: idx + 2,
  }));
  pages.splice(2, 0, { html: htmlTOC(tocEntries) });

  // Pair into spreads: [[left, right], …]
  const spreads = [];
  for (let i = 0; i < pages.length; i += 2) {
    spreads.push([pages[i], pages[i + 1] ?? { html: '' }]);
  }
  return spreads;
}

// ── Render a page into a container ────────────────────────────────────────

function renderPage(page, container) {
  container.innerHTML = page?.html ?? '';
  page?.init?.(container);
}

// ── Page flip animation ────────────────────────────────────────────────────
const FLIP_DURATION = 700;
const FLIP_EASING   = 'cubicBezier(0.645, 0.045, 0.355, 1.000)';

async function flipForward() {
  if (animating || spread >= SPREADS.length - 1) return;
  animating = true;

  const next         = spread + 1;
  const rightPage    = $('right-page');
  const leftPage     = $('left-page');
  const frontContent = $('front-content');
  const backContent  = $('back-content');
  const leftContent  = $('left-content');

  try {
    renderPage(SPREADS[spread][1], frontContent);
    renderPage(SPREADS[next][0],   backContent);
    leftPage.style.visibility = 'hidden';

    await anime({ targets: rightPage, rotateY: [0, -180], duration: FLIP_DURATION, easing: FLIP_EASING }).finished;

    spread = next;
    renderPage(SPREADS[spread][0], leftContent);
    renderPage(SPREADS[spread][1], frontContent);
    anime.set(rightPage, { rotateY: 0 });
    leftPage.style.visibility = '';
    updateUI();
  } finally {
    animating = false;
  }
}

async function flipBackward() {
  if (animating || spread <= 0) return;
  animating = true;

  const prev         = spread - 1;
  const rightPage    = $('right-page');
  const leftPage     = $('left-page');
  const frontContent = $('front-content');
  const backContent  = $('back-content');
  const leftContent  = $('left-content');

  try {
    renderPage(SPREADS[prev][1],   frontContent);
    renderPage(SPREADS[spread][0], backContent);
    leftPage.style.visibility = 'hidden';

    anime.set(rightPage, { rotateY: -180 });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    await anime({ targets: rightPage, rotateY: [-180, 0], duration: FLIP_DURATION, easing: FLIP_EASING }).finished;

    spread = prev;
    renderPage(SPREADS[spread][0], leftContent);
    anime.set(rightPage, { rotateY: 0 });
    leftPage.style.visibility = '';
    updateUI();
  } finally {
    animating = false;
  }
}

// ── UI state ──────────────────────────────────────────────────────────────
function updateUI() {
  $('nav-prev').disabled = spread === 0;
  $('nav-next').disabled = spread === SPREADS.length - 1;

  const p1 = spread * 2 + 1;
  const p2 = p1 + 1;
  const total = SPREADS.length * 2;
  $('page-indicator').textContent = spread === 0 ? '' : `${p1} \u2013 ${p2}  /  ${total}`;

  const repo = data?.repo?.name || data?.repo?.fullName || '';
  $('spine-title').textContent = repo ? `${repo}  \u00b7  reverse-perspective` : 'reverse-perspective';
}

// ── Interactive tree ──────────────────────────────────────────────────────
function initTreeNodes(container) {
  container.querySelectorAll('.tree-node.is-dir').forEach(node => {
    const wrapper  = node.closest('.tree-node-wrapper');
    const children = wrapper?.querySelector('.tree-children');
    if (!children) return;
    node.addEventListener('click', () => {
      const isOpen = node.classList.toggle('open');
      children.style.maxHeight = isOpen ? children.scrollHeight + 'px' : '0';
    });
  });
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

  // Show app before measuring so the DOM has real dimensions
  $('loading').style.display = 'none';
  $('app').style.display     = 'flex';

  // Wait for fonts so text wrapping is accurate
  await document.fonts.ready;

  // Build all pages with overflow pagination
  SPREADS = buildAllPages(data);

  // Render initial spread (cover)
  renderPage(SPREADS[0][0], $('left-content'));
  renderPage(SPREADS[0][1], $('front-content'));
  updateUI();

  // Wire navigation
  $('nav-next').addEventListener('click', flipForward);
  $('nav-prev').addEventListener('click', flipBackward);

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') flipForward();
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   flipBackward();
  });

  $('right-page').addEventListener('click', e => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX > rect.left + rect.width * 0.7) flipForward();
  });
  $('left-page').addEventListener('click', e => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left + rect.width * 0.3) flipBackward();
  });

  document.body.appendChild(el('div', 'key-hint', '\u2190 \u2192 arrow keys to turn pages'));

  // Animate book in
  anime({ targets: '.book', opacity: [0, 1], scale: [0.96, 1], duration: 700, easing: 'easeOutExpo' });
}

// ── Dark mode ─────────────────────────────────────────────────────────────
const darkBtn = $('dark-toggle');
darkBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  darkBtn.textContent = isDark ? '\u2600 light' : '\u263d dark';
});

init();
