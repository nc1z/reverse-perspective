/* ── reverse-perspective — frontend ──────────────────────────────────────── */

// ── Helpers ────────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function el(tag, cls, html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).getFullYear();
}

// ── Marked config ──────────────────────────────────────────────────────────
marked.setOptions({ gfm: true, breaks: true });

// ── File icon map ──────────────────────────────────────────────────────────
const FILE_ICONS = {
  ts: '🔷', tsx: '⚛️', js: '🟨', jsx: '⚛️',
  py: '🐍', go: '🐹', rs: '🦀', java: '☕', rb: '💎',
  cpp: '⚙️', c: '⚙️', swift: '🍎', kt: '🤖',
  json: '📋', toml: '📋', yaml: '📋', yml: '📋',
  md: '📝', txt: '📄', sh: '⚡', css: '🎨', html: '🌐',
  sql: '🗄️', env: '🔐', gitignore: '🙈',
};

function fileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || '📄';
}

// ── Build interactive folder tree ──────────────────────────────────────────
function buildTree(paths) {
  const root = {};
  for (const path of paths) {
    const parts = path.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!node[part]) node[part] = (i < parts.length - 1) ? {} : null;
      if (node[part] !== null && typeof node[part] === 'object') node = node[part];
    }
  }
  return root;
}

function renderTreeNode(name, children, depth = 0) {
  const isDir = children !== null && typeof children === 'object';
  const wrapper = el('div', 'tree-node-wrapper');

  const node = el('div', `tree-node${isDir ? ' is-dir' : ''}`);
  node.style.setProperty('--depth', depth);

  const icon = el('span', 'icon');
  icon.textContent = isDir ? '📁' : fileIcon(name);

  const label = el('span', 'name');
  label.textContent = name + (isDir ? '/' : '');

  node.appendChild(icon);
  node.appendChild(label);

  if (isDir) {
    const chevron = el('span', 'chevron');
    chevron.textContent = '▶';
    node.appendChild(chevron);

    const childrenEl = el('div', 'tree-children');
    childrenEl.style.maxHeight = '0';
    childrenEl.style.overflow = 'hidden';

    const entries = Object.entries(children).sort(([aKey, aVal], [bKey, bVal]) => {
      // Dirs first, then files
      const aIsDir = aVal !== null && typeof aVal === 'object';
      const bIsDir = bVal !== null && typeof bVal === 'object';
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return aKey.localeCompare(bKey);
    });

    for (const [childName, childChildren] of entries) {
      childrenEl.appendChild(renderTreeNode(childName, childChildren, depth + 1));
    }

    let isOpen = depth === 0; // root level starts open
    if (isOpen) {
      node.classList.add('open');
      childrenEl.style.maxHeight = 'none';
    }

    node.addEventListener('click', () => {
      isOpen = !isOpen;
      node.classList.toggle('open', isOpen);
      if (isOpen) {
        childrenEl.style.maxHeight = childrenEl.scrollHeight + 'px';
        anime({
          targets: childrenEl.querySelectorAll(':scope > .tree-node-wrapper > .tree-node'),
          opacity: [0, 1],
          translateX: [-8, 0],
          delay: anime.stagger(30),
          duration: 200,
          easing: 'easeOutQuad',
        });
      } else {
        childrenEl.style.maxHeight = '0';
      }
    });

    wrapper.appendChild(node);
    wrapper.appendChild(childrenEl);
  } else {
    wrapper.appendChild(node);
  }

  return wrapper;
}

// ── Count-up animation ─────────────────────────────────────────────────────
function countUp(el, target, duration = 1200) {
  const formatted = fmt(target);
  if (isNaN(target) || target === 0) {
    el.textContent = formatted;
    return;
  }

  const obj = { v: 0 };
  anime({
    targets: obj,
    v: target,
    duration,
    easing: 'easeOutExpo',
    round: 1,
    update: () => { el.textContent = fmt(Math.round(obj.v)); },
    complete: () => { el.textContent = formatted; },
  });
}

// ── IntersectionObserver for scroll reveals ────────────────────────────────
const revealQueue = new Map(); // el → callback

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        const cb = revealQueue.get(entry.target);
        if (cb) {
          setTimeout(cb, 100);
          revealQueue.delete(entry.target);
        }
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
);

function onReveal(el, cb) {
  revealQueue.set(el, cb);
  observer.observe(el);
}

// ── Parallax ───────────────────────────────────────────────────────────────
function initParallax() {
  const heroGlow = $('.hero-glow');
  if (!heroGlow) return;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    heroGlow.style.transform = `translateY(${y * 0.3}px)`;
    const grid = $('.hero-bg-grid');
    if (grid) grid.style.transform = `translateY(${y * 0.15}px)`;
  }, { passive: true });
}

// ── Drag-to-scroll for layer cards ────────────────────────────────────────
function initDragScroll(el) {
  let isDown = false, startX, scrollLeft;
  el.addEventListener('mousedown', (e) => {
    isDown = true;
    startX = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
  });
  window.addEventListener('mouseup', () => { isDown = false; });
  el.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft = scrollLeft - (x - startX);
  });
}

// ── Render sections ────────────────────────────────────────────────────────

function renderHero(data) {
  const { repo } = data;

  $('#hero-title').textContent = repo.name || repo.fullName;
  $('#hero-desc').textContent = repo.description || 'No description provided.';
  $('#footer-link').href = repo.url;
  $('#footer-link').textContent = `View ${repo.fullName} on GitHub →`;
  document.title = `${repo.name} — reverse-perspective`;

  const meta = $('#hero-meta');
  if (repo.language) {
    const t = el('span', 'hero-tag lang');
    t.textContent = repo.language;
    meta.appendChild(t);
  }
  if (repo.license) {
    const t = el('span', 'hero-tag');
    t.textContent = repo.license;
    meta.appendChild(t);
  }
  for (const topic of (repo.topics || []).slice(0, 5)) {
    const t = el('span', 'hero-tag');
    t.textContent = topic;
    meta.appendChild(t);
  }
  const yr = el('span', 'hero-tag');
  yr.textContent = `Since ${fmtDate(repo.createdAt)}`;
  meta.appendChild(yr);

  const stats = [
    { value: repo.stars,      label: 'stars' },
    { value: repo.forks,      label: 'forks' },
    { value: repo.openIssues, label: 'issues' },
    { value: (data.rawTree || []).length, label: 'files' },
  ];

  const statsEl = $('#hero-stats');
  for (const s of stats) {
    const card = el('div', 'stat-card');
    const val = el('div', 'stat-value');
    val.textContent = '0';
    const lbl = el('div', 'stat-label');
    lbl.textContent = s.label;
    card.appendChild(val);
    card.appendChild(lbl);
    statsEl.appendChild(card);
    card._target = s.value;
    card._valEl = val;
  }

  const link = $('#hero-link');
  link.href = repo.url;

  // Animate hero in
  anime.timeline({ easing: 'easeOutExpo' })
    .add({ targets: '.hero-eyebrow', opacity: [0, 1], translateY: [10, 0], duration: 600 })
    .add({ targets: '#hero-title', opacity: [0, 1], translateY: [20, 0], duration: 700 }, '-=400')
    .add({ targets: '#hero-desc', opacity: [0, 1], translateY: [15, 0], duration: 600 }, '-=500')
    .add({ targets: '#hero-meta', opacity: [0, 1], translateY: [10, 0], duration: 500 }, '-=400')
    .add({
      targets: '#hero-stats',
      opacity: [0, 1],
      translateY: [15, 0],
      duration: 600,
      complete: () => {
        // Start count-up once stats are visible
        for (const card of $$('.stat-card')) {
          countUp(card._valEl, card._target);
        }
      },
    }, '-=300')
    .add({ targets: '#hero-link', opacity: [0, 1], translateY: [10, 0], duration: 400 }, '-=200');
}

function renderMentalModel(data) {
  const list = $('#mental-model-list');
  const items = data.mentalModel || [];

  if (!items.length) {
    list.innerHTML = '<p style="color:var(--text-3)">No mental model data found.</p>';
    return;
  }

  items.forEach((text, i) => {
    const card = el('div', 'mm-card');
    const num = el('div', 'mm-number');
    num.textContent = String(i + 1).padStart(2, '0');
    const txt = el('div', 'mm-text');
    txt.textContent = text;
    card.appendChild(num);
    card.appendChild(txt);
    list.appendChild(card);
  });

  onReveal($('#mental-model'), () => {
    anime({
      targets: '.mm-card',
      opacity: [0, 1],
      translateY: [30, 0],
      delay: anime.stagger(120),
      duration: 700,
      easing: 'easeOutExpo',
    });
  });
}

function renderRepoTree(data) {
  const treeEl = $('#tree-interactive');
  const annEl = $('#tree-annotations');

  // Interactive tree from raw GitHub file list
  const rawTree = data.rawTree || [];
  if (rawTree.length) {
    const treeData = buildTree(rawTree.slice(0, 400));
    const entries = Object.entries(treeData).sort(([aK, aV], [bK, bV]) => {
      const aIsDir = aV !== null && typeof aV === 'object';
      const bIsDir = bV !== null && typeof bV === 'object';
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return aK.localeCompare(bK);
    });
    for (const [name, children] of entries) {
      treeEl.appendChild(renderTreeNode(name, children, 0));
    }
  } else {
    treeEl.innerHTML = '<span style="color:var(--text-3);font-size:13px">Tree not available</span>';
  }

  // Annotation list from parser
  const annotations = data.repoTree || [];
  if (annotations.length) {
    for (const item of annotations) {
      const row = el('div', 'annotation-item');
      const path = el('div', 'ann-path');
      path.textContent = item.path;
      const text = el('div', 'ann-text');
      text.textContent = item.annotation;
      row.appendChild(path);
      row.appendChild(text);
      annEl.appendChild(row);
    }

    onReveal($('#repo-tree'), () => {
      anime({
        targets: '.annotation-item',
        opacity: [0, 1],
        translateX: [20, 0],
        delay: anime.stagger(60),
        duration: 500,
        easing: 'easeOutQuad',
      });
    });
  } else {
    annEl.innerHTML = '<span style="color:var(--text-3);font-size:14px">Annotations not parsed — see raw markdown.</span>';
  }
}

function renderLayers(data) {
  const list = $('#layers-list');
  const layers = data.layers || [];

  if (!layers.length) {
    list.innerHTML = '<p style="padding:0 40px;color:var(--text-3)">No layers parsed.</p>';
    return;
  }

  for (const layer of layers) {
    const card = el('div', 'layer-card');
    const name = el('div', 'layer-name');
    name.textContent = layer.name;
    const content = el('div', 'layer-content prose');
    content.innerHTML = marked.parse(layer.content || '');
    card.appendChild(name);
    card.appendChild(content);
    list.appendChild(card);
  }

  // Apply highlight.js to code blocks
  list.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));

  onReveal($('#layers'), () => {
    anime({
      targets: '.layer-card',
      opacity: [0, 1],
      translateX: [40, 0],
      delay: anime.stagger(100),
      duration: 700,
      easing: 'easeOutExpo',
    });
  });

  initDragScroll(list);
}

function renderProse(sectionId, contentId, markdown) {
  const el2 = $(`#${contentId}`);
  if (!markdown || !markdown.trim()) {
    el2.innerHTML = '<p style="color:var(--text-3)">No data for this section.</p>';
    return;
  }
  el2.innerHTML = marked.parse(markdown);
  el2.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
}

function renderE2EFlow(data) {
  const container = $('#e2e-content');
  const text = data.e2eFlow || '';
  if (!text.trim()) {
    container.textContent = 'No flow diagram available.';
    return;
  }

  // Render line by line for animation
  const lines = text.split('\n');
  for (const line of lines) {
    const span = el('span', 'line');
    span.textContent = line;
    container.appendChild(span);
  }

  onReveal($('#e2e-flow'), () => {
    anime({
      targets: '#e2e-content .line',
      opacity: [0, 1],
      translateX: [-6, 0],
      delay: anime.stagger(18),
      duration: 300,
      easing: 'easeOutQuad',
    });
  });
}

function renderCommitStory(data) {
  const timeline = $('#timeline');
  const commits = data.commitStory || [];

  if (!commits.length) {
    timeline.innerHTML = '<p style="color:var(--text-3)">No commit story parsed.</p>';
    return;
  }

  for (const commit of commits) {
    const item = el('div', 'commit-item');
    const dot = el('div', 'commit-dot');
    const num = el('div', 'commit-n');
    num.textContent = `commit ${commit.n}`;
    const msg = el('div', 'commit-message');
    msg.textContent = commit.message;
    const desc = el('div', 'commit-desc');
    desc.textContent = commit.description;
    item.appendChild(dot);
    item.appendChild(num);
    item.appendChild(msg);
    if (commit.description) item.appendChild(desc);
    timeline.appendChild(item);
  }

  onReveal($('#commit-story'), () => {
    anime({
      targets: '.commit-item',
      opacity: [0, 1],
      translateX: [-20, 0],
      delay: anime.stagger(100),
      duration: 600,
      easing: 'easeOutExpo',
    });
    // Animate dots pulsing in sequence
    anime({
      targets: '.commit-dot',
      borderColor: [
        { value: 'rgba(124,58,237,0.2)' },
        { value: '#7c3aed' },
      ],
      delay: anime.stagger(100),
      duration: 400,
      easing: 'easeOutQuad',
    });
  });
}

function renderSummaries(data) {
  const grid = $('#summary-grid');
  const summaries = data.summaries || [];

  if (!summaries.length) {
    grid.innerHTML = '<p style="color:var(--text-3)">No summaries parsed.</p>';
    return;
  }

  for (const s of summaries) {
    const card = el('div', 'summary-card');
    const layer = el('div', 'summary-layer');
    layer.textContent = s.layer;
    const text = el('div', 'summary-text');
    text.textContent = s.oneLiner;
    card.appendChild(layer);
    card.appendChild(text);
    grid.appendChild(card);
  }

  onReveal($('#summaries'), () => {
    anime({
      targets: '.summary-card',
      opacity: [0, 1],
      translateY: [20, 0],
      delay: anime.stagger(60),
      duration: 600,
      easing: 'easeOutExpo',
    });
  });
}

// ── Dismiss loading ────────────────────────────────────────────────────────
function showApp() {
  anime({
    targets: '#loading',
    opacity: [1, 0],
    duration: 500,
    easing: 'easeInQuad',
    complete: () => {
      $('#loading').style.display = 'none';
      $('#app').style.display = 'block';
      // Trigger initial hero animation
      requestAnimationFrame(() => renderHero(window.__data));
    },
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  let data;
  try {
    const res = await fetch('/api/analysis');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    $('#loading').innerHTML = `
      <div class="loading-inner">
        <div style="font-size:40px;margin-bottom:16px">✗</div>
        <div style="font-family:var(--font-mono);color:#f43f5e;font-size:14px">
          Failed to load analysis: ${err.message}
        </div>
      </div>`;
    return;
  }

  window.__data = data;

  // Render all sections before showing app
  renderMentalModel(data);
  renderRepoTree(data);
  renderLayers(data);
  renderProse('dependencies', 'deps-content', data.dependencies);
  renderProse('dev-scaffolding', 'scaffold-content', data.devScaffolding);
  renderE2EFlow(data);
  renderCommitStory(data);
  renderSummaries(data);

  // Observe all reveal sections
  $$('.reveal-section').forEach(s => observer.observe(s));

  initParallax();
  showApp();
}

main();
