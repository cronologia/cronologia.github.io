#!/usr/bin/env node
'use strict';
/**
 * build-chronology.js — master chronology for the Cronologia portal.
 *
 * Fetches every project's public dataset (raw.githubusercontent.com, branch
 * main), merges all events into one timeline tagged by project, and writes
 * chronology/index.html. Zero dependencies (Node 18+, global fetch).
 *
 * fsp predates the shared schema: its meetings[] are adapted into events.
 *
 * Usage: node build-chronology.js
 */

const fs = require('fs');
const path = require('path');

const SITE = 'https://cronologia.github.io';
const RAW = 'https://raw.githubusercontent.com/cronologia';

// Project registry: accent colors mirror each site's identity.
const PROJECTS = [
  { id: 'fsp', label: 'Foro de São Paulo', color: '#b8252b', dark: '#7a1418', file: 'data/forum.json' },
  { id: 'fsspx', label: 'FSSPX', color: '#1e4f8f', dark: '#12365f', file: 'data/chronology.json' },
  { id: 'tl', label: 'Teologia da Libertação', color: '#1b7a3d', dark: '#114f27', file: 'data/chronology.json' },
  { id: 'tariqa', label: 'Tariqa Maryamiyya', color: '#0e7490', dark: '#0a4e60', file: 'data/chronology.json' },
  { id: 'perennialism', label: 'Perennialism', color: '#5b21b6', dark: '#3b1580', file: 'data/chronology.json' },
  { id: 'celam', label: 'CELAM', color: '#831843', dark: '#5a0f2e', file: 'data/chronology.json' },
  { id: 'grupopuebla', label: 'Grupo de Puebla', color: '#c2410c', dark: '#8a2d08', file: 'data/chronology.json' },
  { id: 'tfp', label: 'TFP', color: '#713f12', dark: '#4a290b', file: 'data/chronology.json' },
  { id: 'rcc', label: 'RCC', color: '#be185d', dark: '#831244', file: 'data/chronology.json' },
];

const ANALYTICS = `  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-R9LV1QZHVE"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-R9LV1QZHVE');
  </script>`;

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function adaptFsp(data) {
  return (data.meetings || []).map((m) => ({
    year: m.year,
    date: m.dates || String(m.year),
    dateVerified: m.datesVerified !== false,
    title: `${m.edition ? `${m.edition} ` : ''}Encontro — ${m.city}, ${m.country}`,
    text: m.notes || '',
    place: `${m.city}, ${m.country}`,
    link: `${SITE}/fsp/meetings/${m.year}.html`,
  }));
}

function adaptStandard(data, id) {
  return (data.events || []).map((ev) => ({
    year: ev.year,
    date: ev.date || String(ev.year),
    dateVerified: ev.dateVerified !== false,
    title: ev.title,
    text: ev.text || '',
    place: ev.place || '',
    link: `${SITE}/${id}/#chronology`,
  }));
}

function renderPage(events, counts, generatedAt) {
  const chipCss = PROJECTS.map(
    (p) => `    .chip-${p.id} { --pc: ${p.color}; --pd: ${p.dark}; }\n    .ev-${p.id} { border-left-color: ${p.color}; } .ev-${p.id} .ev-project { color: ${p.dark}; }`
  ).join('\n');

  const chips = PROJECTS.map(
    (p) =>
      `        <button class="chip chip-${p.id} on" data-project="${p.id}">${esc(p.label)} <span class="n">${counts[p.id]}</span></button>`
  ).join('\n');

  let body = '';
  let lastDecade = null;
  for (const ev of events) {
    const decade = ev.year < 1900 ? 'Before 1900' : `${Math.floor(ev.year / 10) * 10}s`;
    if (decade !== lastDecade) {
      body += `      <h2 class="decade">${decade}</h2>\n`;
      lastDecade = decade;
    }
    const flag = ev.dateVerified ? '' : ' <span class="flag" title="date not fully verified — see the project page">?</span>';
    body += `      <article class="ev ev-${ev.project}" data-project="${ev.project}">
        <div class="ev-year">${ev.year}${flag}</div>
        <div class="ev-body">
          <span class="ev-project">${esc(ev.projectLabel)}</span>
          <h3><a href="${esc(ev.link)}">${esc(ev.title)}</a></h3>
          ${ev.text ? `<p>${esc(ev.text)}</p>` : ''}
        </div>
      </article>\n`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Master chronology — Cronologia</title>
  <meta name="description" content="Every event of the Cronologia family on one timeline: nine source-referenced chronologies of Latin American political and religious history, merged and filterable by project." />
${ANALYTICS}
  <style>
    :root { --bg: #faf8f5; --surface: #ffffff; --ink: #1d2330; --muted: #6b7280; --line: #e4e0d8; --maxw: 920px; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--ink); background: var(--bg); line-height: 1.55; }
    .wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 1.25rem; }
    .site-header { background: linear-gradient(135deg, #23283a, #3b4257); color: #fff; padding: 2.25rem 0 1.5rem; }
    .site-header h1 { margin: 0 0 .25rem; font-size: 1.9rem; letter-spacing: -.5px; }
    .site-header p { margin: 0; opacity: .92; max-width: 70ch; }
    .site-header a.home { color: #cfd6e4; font-size: .85rem; text-decoration: none; }
    .filters { position: sticky; top: 0; z-index: 10; background: var(--bg); border-bottom: 1px solid var(--line); padding: .6rem 0; }
    .filters .wrap { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; }
    .chip { border: 1.5px solid var(--pc, #888); background: var(--pc, #888); color: #fff; font: inherit; font-size: .78rem; font-weight: 600; padding: .25rem .65rem; border-radius: 999px; cursor: pointer; white-space: nowrap; }
    .chip:not(.on) { background: transparent; color: var(--pd, #555); opacity: .65; }
    .chip .n { opacity: .8; font-weight: 400; }
    .chip-all { --pc: #3b4257; --pd: #23283a; }
${chipCss}
    main { padding: 1.5rem 1.25rem 3rem; }
    .decade { font-size: 1.15rem; border-bottom: 2px solid var(--line); padding-bottom: .3rem; margin: 2rem 0 .8rem; color: var(--muted); }
    .ev { display: grid; grid-template-columns: 4.2rem 1fr; gap: .9rem; background: var(--surface); border: 1px solid var(--line); border-left: 4px solid #888; border-radius: 6px; padding: .65rem .9rem; margin: 0 0 .55rem; }
    .ev.hidden { display: none; }
    .ev-year { font-weight: 700; font-size: .95rem; padding-top: .1rem; }
    .ev-project { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
    .ev-body h3 { margin: .05rem 0 .2rem; font-size: 1rem; }
    .ev-body h3 a { color: inherit; text-decoration: none; }
    .ev-body h3 a:hover { text-decoration: underline; }
    .ev-body p { margin: 0; font-size: .88rem; color: var(--muted); }
    .flag { color: #b45309; font-weight: 700; }
    .site-footer { border-top: 1px solid var(--line); padding: 1.5rem 0; color: var(--muted); font-size: .85rem; }
    .site-footer a { color: var(--muted); }
    @media (max-width: 560px) {
      .site-header { padding: 1.3rem 0 1rem; }
      .site-header h1 { font-size: 1.4rem; }
      .filters .wrap { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
      .filters .wrap::-webkit-scrollbar { display: none; }
      .ev { grid-template-columns: 3.2rem 1fr; gap: .6rem; }
    }
    @media print {
      .filters { display: none; }
      .ev { break-inside: avoid; border: none; border-left: 3px solid #888; padding: .3rem .6rem; }
      .site-header { background: none; color: #000; }
      .site-header a.home { display: none; }
      a { text-decoration: none; color: inherit; }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a class="home" href="/">← Cronologia</a>
      <h1>Master chronology</h1>
      <p>Every event of the nine project chronologies on one timeline — filter by project, click any
      event for the full cited entry on its project site. Intersections the projects document
      separately become visible side by side here.</p>
    </div>
  </header>
  <div class="filters">
    <div class="wrap">
      <button class="chip chip-all" id="toggle-all">All</button>
${chips}
    </div>
  </div>
  <main class="wrap">
${body}  </main>
  <footer class="site-footer">
    <div class="wrap">
      <p>Generated ${generatedAt} from the projects' public datasets — every event carries its
      citations on its project page. <a href="https://github.com/cronologia">github.com/cronologia</a></p>
    </div>
  </footer>
  <script>
    (function () {
      var chips = Array.prototype.slice.call(document.querySelectorAll('.chip[data-project]'));
      var events = Array.prototype.slice.call(document.querySelectorAll('.ev'));
      var decades = Array.prototype.slice.call(document.querySelectorAll('.decade'));
      function apply() {
        var on = {};
        chips.forEach(function (c) { on[c.dataset.project] = c.classList.contains('on'); });
        events.forEach(function (e) { e.classList.toggle('hidden', !on[e.dataset.project]); });
        var current = null;
        decades.forEach(function (d) { d.style.display = 'none'; });
        events.forEach(function (e) {
          if (!e.classList.contains('hidden')) {
            var el = e.previousElementSibling;
            while (el && !el.classList.contains('decade')) el = el.previousElementSibling;
            if (el) el.style.display = '';
          }
        });
      }
      chips.forEach(function (c) {
        c.addEventListener('click', function () { c.classList.toggle('on'); apply(); });
      });
      document.getElementById('toggle-all').addEventListener('click', function () {
        var anyOff = chips.some(function (c) { return !c.classList.contains('on'); });
        chips.forEach(function (c) { c.classList.toggle('on', anyOff); });
        apply();
      });
    })();
  </script>
</body>
</html>
`;
}

async function main() {
  const all = [];
  const counts = {};
  for (const p of PROJECTS) {
    const url = `${RAW}/${p.id}/main/${p.file}`;
    const data = await fetchJson(url);
    const events = p.id === 'fsp' ? adaptFsp(data) : adaptStandard(data, p.id);
    for (const ev of events) all.push({ ...ev, project: p.id, projectLabel: p.label });
    counts[p.id] = events.length;
    console.log(`${p.id}: ${events.length} events`);
  }
  all.sort((a, b) => a.year - b.year || String(a.date).localeCompare(String(b.date)));
  const generatedAt = new Date().toISOString().slice(0, 10);
  const html = renderPage(all, counts, generatedAt);
  const outDir = path.join(__dirname, 'chronology');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  console.log(`Wrote chronology/index.html (${all.length} events, ${PROJECTS.length} projects).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
