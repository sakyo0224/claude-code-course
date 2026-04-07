#!/usr/bin/env node
// Claude Code マスターコース — Static Site Builder

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { Marked } from 'marked';
import hljs from 'highlight.js';

// --- Config ---
const ROOT = process.cwd();
const COURSE_DIR = join(ROOT, '..', 'course');
const SLIDES_DIR = join(ROOT, '..', 'slides');
const STATIC_DIR = join(ROOT, 'static');
const DIST = join(ROOT, 'dist');

const SECTIONS = [
  { dir: '01_beginner', name: '初級', subtitle: 'はじめてのClaude Code', badge: 'beginner', desc: '安心して基本操作をマスター' },
  { dir: '02_intermediate', name: '中級', subtitle: '生産性を10倍にする活用術', badge: 'intermediate', desc: '日常業務で本格的に活用' },
  { dir: '03_advanced', name: '上級', subtitle: 'プロフェッショナルの技術', badge: 'advanced', desc: '自動化・外部連携・ワークフロー' },
  { dir: '04_specialist', name: 'スペシャリスト', subtitle: 'チームと組織を変革する', badge: 'specialist', desc: '組織レベルの活用と運用' },
];

const PICKUP_ARTICLES = [
  { path: 'pickup/01_usecase_50', desc: '10カテゴリ × 5事例。文書作成からデータ分析まで網羅', isPickup: true },
  { path: 'pickup/02_mcp_50', desc: 'Slack・Notion・Google など外部連携の実例集', isPickup: true },
  { path: 'pickup/03_commands_50', desc: 'スラッシュコマンドからプロンプト術まで厳選', isPickup: true },
];

// --- Markdown setup ---
const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    code(text, lang) {
      const code = text || '';
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
      const highlighted = hljs.highlight(code, { language }).value;
      const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      return `<div class="code-block"><button class="copy-btn" data-code="${escaped}" aria-label="コピー"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 0 1 2 9.5v-7A1.5 1.5 0 0 1 3.5 1h7A1.5 1.5 0 0 1 12 2.5V5"/></svg></button><pre><code class="hljs language-${language}">${highlighted}</code></pre></div>`;
    },
    heading(text, level) {
      const id = text.replace(/<[^>]+>/g, '').replace(/[^\w\u3000-\u9fff\u4e00-\u9faf\uff00-\uffef]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
      return `<h${level} id="${id}">${text}</h${level}>`;
    }
  }
});

// --- Parse index.md for navigation data ---
function parseIndex() {
  const content = readFileSync(join(COURSE_DIR, '00_index.md'), 'utf-8');
  const articles = []; // flat list: { section, dir, file, title, time, path }

  let currentSection = null;
  for (const line of content.split('\n')) {
    // Detect section headers
    const sectionMatch = line.match(/^## セクション(\d)：/);
    if (sectionMatch) {
      currentSection = parseInt(sectionMatch[1]) - 1;
      continue;
    }

    // Parse table rows with links
    const rowMatch = line.match(/\|\s*\d+\s*\|\s*\[(.+?)\]\((.+?\.md)\)\s*\|\s*(.+?)\s*\|/);
    if (rowMatch && currentSection !== null) {
      const [, title, mdPath, time] = rowMatch;
      const dir = SECTIONS[currentSection].dir;
      const file = basename(mdPath, '.md');
      articles.push({
        section: currentSection,
        dir,
        file,
        title,
        time: time.trim(),
        mdPath,
        htmlPath: `${dir}/${file}.html`,
      });
    }
  }
  return articles;
}

// --- Convert markdown to HTML ---
function convertMarkdown(mdContent) {
  // Replace .md links with .html
  let content = mdContent.replace(/\(([^)]*?)\.md\)/g, '($1.html)');
  return marked.parse(content);
}

// --- Generate TOC from markdown headings ---
function generateToc(mdContent) {
  const headings = [];
  for (const line of mdContent.split('\n')) {
    const m = line.match(/^(#{2,3})\s+(.+)/);
    if (m) {
      const level = m[1].length; // 2 or 3
      const text = m[2].trim();
      const id = text.replace(/[^\w\u3000-\u9fff\u4e00-\u9faf\uff00-\uffef]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
      headings.push({ level, text, id });
    }
  }
  if (headings.length === 0) return '';

  const items = headings.map(h => {
    const cls = h.level === 3 ? ' class="toc-h3"' : '';
    return `<li><a href="#${h.id}"${cls}>${h.text}</a></li>`;
  }).join('\n');

  return `<nav class="toc"><div class="toc-title">目次</div><ul>${items}</ul></nav>`;
}

// --- Templates ---
function sidebarHtml(articles, activePath) {
  let html = '';
  for (const sec of SECTIONS) {
    const secArticles = articles.filter(a => a.dir === sec.dir);
    const isActive = secArticles.some(a => a.htmlPath === activePath);
    const collapsedClass = isActive ? '' : ' collapsed';
    html += `
      <div class="sidebar-section">
        <div class="sidebar-section-title${collapsedClass}">
          <span>${sec.name} — ${sec.subtitle}</span>
          <span class="chevron">&#9662;</span>
        </div>
        <ul class="sidebar-links${collapsedClass}">
          ${secArticles.map(a => {
            const activeClass = a.htmlPath === activePath ? ' class="active"' : '';
            const href = `/${a.htmlPath}`;
            return `<li><a href="${href}"${activeClass}>${a.title}</a></li>`;
          }).join('\n          ')}
        </ul>
      </div>`;
  }
  return html;
}

function baseHtml({ title, body, sidebar, breadcrumb = '', meta = '', articleNav = '', toc = '', isTop = false }) {
  const mainClass = isTop ? 'main main-top' : 'main';
  const layoutStart = isTop ? '' : `<aside class="sidebar">${sidebar}</aside><div class="sidebar-overlay"></div>`;
  const contentInner = toc
    ? `<div class="article-body"><div class="article-content">${body}${articleNav}</div>${toc}</div>`
    : `${body}${articleNav}`;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Claude Code マスターコース</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header class="header">
    ${isTop ? '' : '<button class="hamburger" aria-label="メニュー"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h14M3 10h14M3 15h14"/></svg></button>'}
    <a href="/" class="header-logo">
      <span class="logo-mark">C</span>
      Claude Code マスターコース
    </a>
  </header>
  <div class="layout">
    ${layoutStart}
    <main class="${mainClass}">
      ${isTop ? body : `
      <div class="content">
        ${breadcrumb}
        ${meta}
        ${contentInner}
      </div>`}
    </main>
  </div>
  <footer class="footer">Claude Code マスターコース &copy; 2026</footer>
  <script src="/js/main.js"></script>
</body>
</html>`;
}

// --- Build article pages ---
function buildArticles(articles) {
  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    const sec = SECTIONS[art.section];
    const mdPath = join(COURSE_DIR, art.dir, `${art.file}.md`);
    const mdContent = readFileSync(mdPath, 'utf-8');
    const htmlContent = convertMarkdown(mdContent);

    const breadcrumb = `
      <nav class="breadcrumb">
        <a href="/">ホーム</a><span class="sep">/</span>
        <a href="/${art.dir}/">${sec.name}</a><span class="sep">/</span>
        <span>${art.title}</span>
      </nav>`;

    const meta = `
      <div class="article-meta">
        <span class="badge badge-${sec.badge}">${sec.name}</span>
        <span class="meta-time">${art.time}</span>
      </div>`;

    // Prev/Next nav
    const prev = i > 0 ? articles[i - 1] : null;
    const next = i < articles.length - 1 ? articles[i + 1] : null;
    let articleNav = '<nav class="article-nav">';
    if (prev) {
      articleNav += `<a href="/${prev.htmlPath}"><span class="nav-label">&larr; 前の記事</span><span class="nav-title">${prev.title}</span></a>`;
    }
    if (next) {
      articleNav += `<a href="/${next.htmlPath}" class="next"><span class="nav-label">次の記事 &rarr;</span><span class="nav-title">${next.title}</span></a>`;
    }
    articleNav += '</nav>';

    const toc = generateToc(mdContent);
    const sidebar = sidebarHtml(articles, art.htmlPath);
    const html = baseHtml({ title: art.title, body: htmlContent, sidebar, breadcrumb, meta, articleNav, toc });

    const outDir = join(DIST, art.dir);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `${art.file}.html`), html);
  }
  console.log(`  記事: ${articles.length}本`);
}

// --- Build section index pages ---
function buildSectionPages(articles) {
  for (const sec of SECTIONS) {
    const secArticles = articles.filter(a => a.dir === sec.dir);
    const listItems = secArticles.map(a =>
      `<li><a href="/${a.htmlPath}"><span class="list-title">${a.title}</span><span class="list-time">${a.time}</span></a></li>`
    ).join('\n');

    const body = `
      <h1>${sec.name} — ${sec.subtitle}</h1>
      <p style="color:var(--color-text-muted);margin-bottom:2rem;">${sec.desc}（${secArticles.length}本）</p>
      <ol class="article-list">${listItems}</ol>`;

    const sidebar = sidebarHtml(articles, null);
    const breadcrumb = `<nav class="breadcrumb"><a href="/">ホーム</a><span class="sep">/</span><span>${sec.name}</span></nav>`;
    const html = baseHtml({ title: `${sec.name} — ${sec.subtitle}`, body, sidebar, breadcrumb });

    writeFileSync(join(DIST, sec.dir, 'index.html'), html);
  }
  console.log(`  セクション一覧: ${SECTIONS.length}ページ`);
}

// --- Build slides pages ---
function buildSlides(articles) {
  const slidesOut = join(DIST, 'slides');
  mkdirSync(slidesOut, { recursive: true });

  if (!existsSync(SLIDES_DIR)) return;

  const mdFiles = readdirSync(SLIDES_DIR).filter(f => f.endsWith('.md'));
  const slidesList = [];

  for (const file of mdFiles) {
    const mdContent = readFileSync(join(SLIDES_DIR, file), 'utf-8');
    const htmlContent = convertMarkdown(mdContent);
    const titleMatch = mdContent.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1] : basename(file, '.md');
    const htmlFile = basename(file, '.md') + '.html';

    slidesList.push({ title, htmlFile });

    const sidebar = sidebarHtml(articles, null);
    const breadcrumb = `<nav class="breadcrumb"><a href="/">ホーム</a><span class="sep">/</span><a href="/slides/">追加資料</a><span class="sep">/</span><span>${title}</span></nav>`;
    const html = baseHtml({ title, body: htmlContent, sidebar, breadcrumb });
    writeFileSync(join(slidesOut, htmlFile), html);
  }

  // Slides index
  const listItems = slidesList.map(s =>
    `<li><a href="/slides/${s.htmlFile}"><span class="list-title">${s.title}</span></a></li>`
  ).join('\n');
  const body = `<h1>追加資料</h1><ul class="article-list">${listItems}</ul>`;
  const sidebar = sidebarHtml(articles, null);
  const breadcrumb = `<nav class="breadcrumb"><a href="/">ホーム</a><span class="sep">/</span><span>追加資料</span></nav>`;
  const html = baseHtml({ title: '追加資料', body, sidebar, breadcrumb });
  writeFileSync(join(slidesOut, 'index.html'), html);

  console.log(`  追加資料: ${mdFiles.length}ページ`);
}

// --- Build top page ---
function buildTopPage(articles) {
  // Pickup cards (from pickup/ directory)
  const pickupCards = PICKUP_ARTICLES.map(p => {
    const mdFile = join(COURSE_DIR, `${p.path}.md`);
    if (!existsSync(mdFile)) return '';
    const md = readFileSync(mdFile, 'utf-8');
    const titleMatch = md.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1] : basename(p.path);
    const htmlPath = `${p.path}.html`;
    return `
      <a href="/${htmlPath}" class="pickup-card pickup-card-featured">
        <div class="card-badge"><span class="badge badge-pickup">特集</span></div>
        <div class="card-title">${title}</div>
        <div class="card-desc">${p.desc}</div>
      </a>`;
  }).join('');

  // Course checklist sections
  const courseSections = SECTIONS.map((sec, i) => {
    const secArticles = articles.filter(a => a.section === i);
    const count = secArticles.length;
    const totalTime = secArticles.reduce((sum, a) => {
      const m = a.time.match(/(\d+)/);
      return sum + (m ? parseInt(m[1]) : 0);
    }, 0);
    const hours = Math.round(totalTime / 60);

    const rows = secArticles.map((a, idx) => `
          <li class="checklist-item">
            <label class="checklist-label">
              <input type="checkbox" class="checklist-cb" data-article="${a.htmlPath}">
              <span class="checklist-num">${String(idx + 1).padStart(2, '0')}</span>
              <a href="/${a.htmlPath}" class="checklist-title">${a.title}</a>
              <span class="checklist-time">${a.time}</span>
            </label>
          </li>`).join('');

    return `
      <div class="course-section" id="section-${i + 1}">
        <div class="course-section-header">
          <div>
            <span class="badge badge-${sec.badge}">${sec.name}</span>
            <h3 class="course-section-title">${sec.subtitle}</h3>
            <span class="course-section-meta">${count}本・約${hours}時間</span>
          </div>
          <div class="progress-ring" data-section="${sec.dir}">
            <span class="progress-count">0</span> / ${count}
          </div>
        </div>
        <ul class="checklist">${rows}
        </ul>
      </div>`;
  }).join('');

  const body = `
    <section class="hero">
      <h1>Claude Code マスターコース</h1>
      <p class="subtitle">AI初心者からスペシャリストへ。Claude Code のすべてを段階的にマスター。</p>
      <p class="stats">全60本・約44時間・4セクション構成</p>
      <a href="/${articles[0].htmlPath}" class="cta">はじめる</a>
    </section>

    <section class="top-section">
      <div class="search-chat">
        <h2>記事をさがす</h2>
        <p class="search-desc">やりたいことや困っていることを入力すると、関連する記事を提案します。</p>
        <div class="search-input-wrap">
          <input type="text" class="search-input" placeholder="例：メールを一括で作りたい、PDFから情報を取り出したい…" autocomplete="off">
          <button class="search-btn" aria-label="検索">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="7.5" r="5.5"/><path d="M12 12l4 4"/></svg>
          </button>
        </div>
        <div class="search-results" hidden>
          <div class="search-results-header"></div>
          <div class="search-results-list"></div>
        </div>
        <div class="search-suggestions">
          <span class="suggestion-label">よく検索される質問:</span>
          <button class="suggestion" data-q="Claude Code を始めるには？">始め方</button>
          <button class="suggestion" data-q="メールを一括で作成したい">メール一括作成</button>
          <button class="suggestion" data-q="PDFから情報を抽出したい">PDF処理</button>
          <button class="suggestion" data-q="Slackと連携するには？">Slack連携</button>
          <button class="suggestion" data-q="料金はいくら？">料金</button>
        </div>
      </div>
    </section>

    <section class="top-section">
      <h2>ピックアップ記事</h2>
      <div class="pickup-grid">${pickupCards}</div>
    </section>

    <section class="top-section">
      <div class="course-header-row">
        <h2>コース一覧</h2>
        <div class="progress-total">
          進捗: <strong class="progress-total-count">0</strong> / ${articles.length} 完了
          <div class="progress-bar"><div class="progress-bar-fill"></div></div>
        </div>
      </div>
      ${courseSections}
    </section>

    <section class="top-section">
      <h2>追加資料</h2>
      <ul class="resources-list">
        <li><a href="/slides/">全体像ガイド・できること一覧など</a></li>
      </ul>
    </section>`;

  const html = baseHtml({ title: 'ホーム', body, sidebar: '', isTop: true });
  writeFileSync(join(DIST, 'index.html'), html);
  console.log('  トップページ: 1ページ');
}

// --- Build pickup pages ---
function buildPickupPages(articles) {
  const pickupDir = join(COURSE_DIR, 'pickup');
  if (!existsSync(pickupDir)) return;

  const outDir = join(DIST, 'pickup');
  mkdirSync(outDir, { recursive: true });

  const mdFiles = readdirSync(pickupDir).filter(f => f.endsWith('.md'));
  for (const file of mdFiles) {
    const mdContent = readFileSync(join(pickupDir, file), 'utf-8');
    const htmlContent = convertMarkdown(mdContent);
    const toc = generateToc(mdContent);
    const titleMatch = mdContent.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1] : basename(file, '.md');
    const htmlFile = basename(file, '.md') + '.html';

    const sidebar = sidebarHtml(articles, null);
    const breadcrumb = `<nav class="breadcrumb"><a href="/">ホーム</a><span class="sep">/</span><span>${title}</span></nav>`;
    const meta = `<div class="article-meta"><span class="badge badge-pickup">特集</span></div>`;
    const html = baseHtml({ title, body: htmlContent, sidebar, breadcrumb, meta, toc });
    writeFileSync(join(outDir, htmlFile), html);
  }
  console.log(`  特集記事: ${mdFiles.length}ページ`);
}

// --- Build search index ---
function buildSearchIndex(articles) {
  const docs = articles.map(art => {
    const sec = SECTIONS[art.section];
    const mdContent = readFileSync(join(COURSE_DIR, art.dir, `${art.file}.md`), 'utf-8');

    // Extract learning goals
    const goalsMatch = mdContent.match(/## この記事で学ぶこと\n([\s\S]*?)(?=\n##)/);
    const goals = goalsMatch ? goalsMatch[1].replace(/^- /gm, '').trim() : '';

    // Extract summary (first 2 paragraphs of 本文 section)
    const bodyMatch = mdContent.match(/## 本文\n([\s\S]*?)(?=\n##)/);
    let summary = '';
    if (bodyMatch) {
      const paragraphs = bodyMatch[1].split('\n\n').filter(p => p.trim() && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('```'));
      summary = paragraphs.slice(0, 2).join(' ').replace(/[#*`\[\]()]/g, '').trim().slice(0, 300);
    }

    // Extract all h3 headings as keywords
    const h3s = [];
    for (const line of mdContent.split('\n')) {
      const m = line.match(/^### (.+)/);
      if (m) h3s.push(m[1]);
    }

    return {
      id: art.htmlPath,
      title: art.title,
      section: sec.name,
      badge: sec.badge,
      time: art.time,
      goals,
      summary,
      headings: h3s.join(' '),
      // Full text for deep search (stripped of markdown syntax)
      body: mdContent.replace(/```[\s\S]*?```/g, '').replace(/[#*`\[\]()>|]/g, '').replace(/---/g, '').slice(0, 2000),
    };
  });

  // Add pickup articles to search index
  const pickupDir = join(COURSE_DIR, 'pickup');
  if (existsSync(pickupDir)) {
    const pickupFiles = readdirSync(pickupDir).filter(f => f.endsWith('.md'));
    for (const file of pickupFiles) {
      const mdContent = readFileSync(join(pickupDir, file), 'utf-8');
      const titleMatch = mdContent.match(/^#\s+(.+)/m);
      const title = titleMatch ? titleMatch[1] : basename(file, '.md');
      const goalsMatch = mdContent.match(/## この記事で学ぶこと\n([\s\S]*?)(?=\n##)/);
      const goals = goalsMatch ? goalsMatch[1].replace(/^- /gm, '').trim() : '';
      const h3s = [];
      for (const line of mdContent.split('\n')) {
        const m = line.match(/^### (.+)/);
        if (m) h3s.push(m[1]);
      }
      docs.push({
        id: `pickup/${basename(file, '.md')}.html`,
        title,
        section: '特集',
        badge: 'pickup',
        time: '',
        goals,
        summary: '',
        headings: h3s.join(' '),
        body: mdContent.replace(/```[\s\S]*?```/g, '').replace(/[#*`\[\]()>|]/g, '').replace(/---/g, '').slice(0, 3000),
      });
    }
  }

  writeFileSync(join(DIST, 'search-index.json'), JSON.stringify(docs));
  console.log(`  検索インデックス: ${docs.length}件`);
}

// --- Main ---
console.log('ビルド開始...');

// Clean & prepare
if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });

// Copy static assets
cpSync(STATIC_DIR, DIST, { recursive: true });
console.log('静的ファイルをコピー');

// Parse index
const articles = parseIndex();
console.log(`${articles.length}本の記事を検出`);

// Build
buildArticles(articles);
buildSectionPages(articles);
buildSlides(articles);
buildPickupPages(articles);
buildTopPage(articles);
buildSearchIndex(articles);

console.log('\nビルド完了！ dist/ を公開してください。');
