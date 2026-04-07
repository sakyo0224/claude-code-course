// Claude Code マスターコース — UI Script
const BASE = document.querySelector('meta[name="base-path"]')?.content || '';

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initMobileMenu();
  highlightActivePage();
  initTocHighlight();
  initCopyButtons();
  initChecklist();
  initSearch();
});

// --- Sidebar section toggle ---
function initSidebar() {
  document.querySelectorAll('.sidebar-section-title').forEach(title => {
    title.addEventListener('click', () => {
      const links = title.nextElementSibling;
      if (!links) return;
      const isCollapsed = links.classList.toggle('collapsed');
      title.classList.toggle('collapsed', isCollapsed);
    });
  });
}

// --- Mobile hamburger menu ---
function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (!hamburger || !sidebar) return;

  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('visible');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  });
}

// --- Highlight current page in sidebar ---
function highlightActivePage() {
  const path = window.location.pathname;
  document.querySelectorAll('.sidebar-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && path.endsWith(href.replace(/^\.\.\//, '').replace(/^\.\//, ''))) {
      link.classList.add('active');
      // expand parent section
      const section = link.closest('.sidebar-section');
      if (section) {
        const links = section.querySelector('.sidebar-links');
        const title = section.querySelector('.sidebar-section-title');
        links?.classList.remove('collapsed');
        title?.classList.remove('collapsed');
      }
    }
  });

  // Collapse non-active sections on article pages
  document.querySelectorAll('.sidebar-section').forEach(section => {
    const hasActive = section.querySelector('.sidebar-links a.active');
    if (!hasActive) {
      const links = section.querySelector('.sidebar-links');
      const title = section.querySelector('.sidebar-section-title');
      links?.classList.add('collapsed');
      title?.classList.add('collapsed');
    }
  });
}

// --- Article Search ---
async function initSearch() {
  const input = document.querySelector('.search-input');
  const btn = document.querySelector('.search-btn');
  const resultsContainer = document.querySelector('.search-results');
  const resultsHeader = document.querySelector('.search-results-header');
  const resultsList = document.querySelector('.search-results-list');
  if (!input || !resultsContainer) return;

  // Load index
  let docs = [];
  let searchIndex = null;
  try {
    const res = await fetch(`${BASE}/search-index.json`);
    docs = await res.json();

    // Build MiniSearch instance
    const { default: MiniSearch } = await import('https://cdn.jsdelivr.net/npm/minisearch@7/dist/es/index.min.js');
    searchIndex = new MiniSearch({
      fields: ['title', 'goals', 'summary', 'headings', 'body'],
      storeFields: ['title', 'section', 'badge', 'time', 'goals', 'summary'],
      searchOptions: {
        boost: { title: 3, goals: 2, headings: 1.5, summary: 1, body: 0.5 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
    searchIndex.addAll(docs);
  } catch (e) {
    console.warn('Search index load failed:', e);
    return;
  }

  function doSearch(query) {
    if (!query.trim()) {
      resultsContainer.hidden = true;
      return;
    }

    const results = searchIndex.search(query, { limit: 5 });
    resultsContainer.hidden = false;

    if (results.length === 0) {
      resultsHeader.textContent = '';
      resultsList.innerHTML = `<div class="search-no-results">「${query}」に一致する記事が見つかりませんでした。<br>別のキーワードで試してみてください。</div>`;
      return;
    }

    resultsHeader.textContent = `「${query}」に関連する記事（${results.length}件）`;
    resultsList.innerHTML = results.map((r, i) => {
      const snippet = r.summary || r.goals || '';
      return `
        <a href="${BASE}/${r.id}" class="search-result-card">
          <span class="search-result-rank">${i + 1}</span>
          <div class="search-result-body">
            <div class="search-result-title">${r.title}</div>
            <div class="search-result-meta">
              <span class="badge badge-${r.badge}">${r.section}</span>
              <span class="meta-time">${r.time}</span>
            </div>
            ${snippet ? `<div class="search-result-snippet">${snippet}</div>` : ''}
          </div>
        </a>`;
    }).join('');
  }

  // Events
  btn.addEventListener('click', () => doSearch(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(input.value); });

  // Debounced auto-search
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => doSearch(input.value), 300);
  });

  // Suggestion buttons
  document.querySelectorAll('.suggestion').forEach(s => {
    s.addEventListener('click', () => {
      input.value = s.dataset.q;
      doSearch(s.dataset.q);
      input.focus();
    });
  });
}

// --- Copy button for code blocks ---
function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-code')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.5l3 3 7-7"/></svg>';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 0 1 2 9.5v-7A1.5 1.5 0 0 1 3.5 1h7A1.5 1.5 0 0 1 12 2.5V5"/></svg>';
        }, 2000);
      });
    });
  });
}

// --- Checklist progress (localStorage) ---
function initChecklist() {
  const checkboxes = document.querySelectorAll('.checklist-cb');
  if (checkboxes.length === 0) return;

  const STORAGE_KEY = 'claude-course-progress';

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function updateProgress() {
    const data = load();
    const total = checkboxes.length;
    const done = Object.values(data).filter(Boolean).length;

    // Total progress
    const totalCount = document.querySelector('.progress-total-count');
    const barFill = document.querySelector('.progress-bar-fill');
    if (totalCount) totalCount.textContent = done;
    if (barFill) barFill.style.width = `${(done / total) * 100}%`;

    // Per-section progress
    document.querySelectorAll('.course-section').forEach(section => {
      const cbs = section.querySelectorAll('.checklist-cb');
      const sectionDone = Array.from(cbs).filter(cb => cb.checked).length;
      const countEl = section.querySelector('.progress-count');
      if (countEl) countEl.textContent = sectionDone;
    });
  }

  // Restore state
  const data = load();
  checkboxes.forEach(cb => {
    const key = cb.dataset.article;
    if (data[key]) {
      cb.checked = true;
      cb.closest('.checklist-item')?.classList.add('completed');
    }

    cb.addEventListener('change', () => {
      const d = load();
      d[key] = cb.checked;
      save(d);
      cb.closest('.checklist-item')?.classList.toggle('completed', cb.checked);
      updateProgress();
    });
  });

  updateProgress();
}

// --- TOC scroll highlight ---
function initTocHighlight() {
  const tocLinks = document.querySelectorAll('.toc a');
  if (tocLinks.length === 0) return;

  const headings = [];
  tocLinks.forEach(link => {
    const id = decodeURIComponent(link.getAttribute('href').slice(1));
    const el = document.getElementById(id);
    if (el) headings.push({ el, link });
  });

  if (headings.length === 0) return;

  function update() {
    const scrollY = window.scrollY + 80;
    let current = headings[0];
    for (const h of headings) {
      if (h.el.offsetTop <= scrollY) current = h;
    }
    tocLinks.forEach(l => l.classList.remove('active'));
    current.link.classList.add('active');
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
}
