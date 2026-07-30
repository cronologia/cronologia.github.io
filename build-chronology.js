#!/usr/bin/env node
'use strict';
/**
 * build-chronology.js — master chronology for the Cronologia portal.
 *
 * Fetches every project's public dataset (raw.githubusercontent.com, branch
 * main), merges all events into one timeline tagged by project, and writes
 * chronology/index.html: a project × decade grid (the aggregate view) above
 * the filterable card list. Zero dependencies (Node 18+, global fetch).
 *
 * It also writes the generated figures (event total, project count) into the
 * landing page between `<!-- gen:… -->` markers in index.html, so the banner
 * numbers are right by construction instead of hand-maintained (issue #21).
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

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const numberWord = (n) => WORDS[n] || String(n);

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// A project that has shipped locales serves its real pages under /<id>/en/…;
// its bare /<id>/ is a redirect stub whose JS drops the URL hash. So deep
// links must target /en/ directly where it exists (detected, not hardcoded —
// the locale rollout is still in progress across the family, core#9).
async function hasEnLocale(id) {
  try {
    const res = await fetch(`${RAW}/${id}/main/docs/en/index.html`, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
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

function adaptStandard(data, id, localized) {
  const base = localized ? `${SITE}/${id}/en/` : `${SITE}/${id}/`;
  return (data.events || []).map((ev) => ({
    year: ev.year,
    date: ev.date || String(ev.year),
    dateVerified: ev.dateVerified !== false,
    title: ev.title,
    text: ev.text || '',
    place: ev.place || '',
    link: `${base}#chronology`,
  }));
}

// ---- project × decade grid (issue #22) --------------------------------------

const decadeOf = (year) => Math.floor(year / 10) * 10;
// The card list groups everything before 1900 under one heading; grid cells
// for pre-1900 decades link there.
const decadeAnchor = (d) => (d < 1900 ? 'd-early' : `d${d}`);
const decadeLabel = (d) => `${d}s`;

function buildMatrix(all, projects) {
  const perProject = new Map(projects.map((p) => [p.id, new Map()]));
  const decadesWith = new Set();
  const firstEvent = new Map();
  for (const ev of all) {
    const d = decadeOf(ev.year);
    decadesWith.add(d);
    const m = perProject.get(ev.project);
    m.set(d, (m.get(d) || 0) + 1);
    if (!firstEvent.has(ev.project) || ev.year < firstEvent.get(ev.project)) {
      firstEvent.set(ev.project, ev.year);
    }
  }
  const present = [...decadesWith].sort((a, b) => a - b);
  // Columns: single empty decades stay as visible empty columns; a run of two
  // or more empty decades becomes ONE explicit labelled break column — a gap
  // is information, and it must not read as a dense stretch (same rule as the
  // chronology spine, core#22).
  const columns = [];
  for (let i = 0; i < present.length; i++) {
    if (i > 0) {
      const gap = (present[i] - present[i - 1]) / 10 - 1;
      if (gap >= 2) {
        columns.push({ break: true, from: present[i - 1] + 10, to: present[i] - 1 });
      } else if (gap === 1) {
        columns.push({ decade: present[i - 1] + 10 });
      }
    }
    columns.push({ decade: present[i] });
  }
  const rows = projects
    .filter((p) => firstEvent.has(p.id))
    .sort((a, b) => firstEvent.get(a.id) - firstEvent.get(b.id))
    .map((p) => {
      const m = perProject.get(p.id);
      const cells = columns.map((c) => (c.break ? null : m.get(c.decade) || 0));
      return { project: p, cells, total: [...m.values()].reduce((a, b) => a + b, 0) };
    });
  const max = Math.max(...rows.flatMap((r) => r.cells.filter((n) => n !== null)));
  return { columns, rows, max };
}

function renderGrid({ columns, rows, max }, generatedAt) {
  const breaks = columns.filter((c) => c.break);
  const head = columns
    .map((c) =>
      c.break
        ? `<th scope="col" class="col-break" title="no events ${c.from}–${c.to}">⋯</th>`
        : `<th scope="col">${decadeLabel(c.decade)}</th>`
    )
    .join('');

  const body = rows
    .map(({ project: p, cells, total }) => {
      const tds = cells
        .map((n, i) => {
          const c = columns[i];
          if (c.break) return '<td class="c gap" aria-hidden="true"></td>';
          if (!n) return '<td class="c c0"><span aria-hidden="true">·</span></td>';
          const ratio = n / max;
          const say = `${p.label}, ${decadeLabel(c.decade)}: ${n} event${n === 1 ? '' : 's'}`;
          return `<td class="c${ratio > 0.55 ? ' hi' : ''}" style="--i:${ratio.toFixed(2)}">` +
            `<a href="#${decadeAnchor(c.decade)}" data-project="${p.id}" data-say="${esc(say)}" aria-label="${esc(say)}">${n}</a></td>`;
        })
        .join('');
      return `        <tr><th scope="row"><span class="sw" style="background:${p.color}"></span>${esc(p.label)}</th>${tds}<td class="tot">${total}</td></tr>`;
    })
    .join('\n');

  const breakNote = breaks.length
    ? ` The ⋯ column is an explicit break — ${breaks.map((b) => `no events ${b.from}–${b.to}`).join('; ')} — not a dense stretch.`
    : '';

  return `    <section class="grid-section" aria-labelledby="grid-h">
      <h2 id="grid-h">Events by project and decade</h2>
      <p class="grid-live" id="grid-live" aria-live="polite">Hover, tap or tab through the cells for details; a cell filters the timeline to its project and jumps to its decade.</p>
      <div class="viz-scroll">
        <table class="pd-grid">
          <thead><tr><th scope="col" class="corner">project</th>${head}<th scope="col" class="tot">total</th></tr></thead>
          <tbody>
${body}
          </tbody>
        </table>
      </div>
      <p class="grid-caption">Cell shade and the printed count encode the same number (never colour alone).
      Rows are ordered by each project's <em>first</em> event — a narrative choice, not a neutral ordering.
      Decade buckets hide within-decade bursts, so an even shade does not imply an even spread.${breakNote}
      Counts are generated from the projects' public datasets (${generatedAt}); each event carries its citations on its project page.</p>
    </section>
`;
}

// ---- page -------------------------------------------------------------------

function renderPage(events, counts, matrix, generatedAt) {
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
    const decade = ev.year < 1900 ? 'Before 1900' : `${decadeOf(ev.year)}s`;
    if (decade !== lastDecade) {
      const id = ev.year < 1900 ? 'd-early' : `d${decadeOf(ev.year)}`;
      body += `      <h2 class="decade" id="${id}">${decade}</h2>\n`;
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

  const total = events.length;
  const nWord = numberWord(PROJECTS.length);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Master chronology — Cronologia</title>
  <meta name="description" content="Every event of the Cronologia family on one timeline: ${nWord} source-referenced chronologies of Latin American political and religious history, merged and filterable by project." />
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
    .grid-section h2 { margin: .25rem 0 .35rem; font-size: 1.25rem; }
    .grid-live { margin: 0 0 .6rem; font-size: .82rem; color: var(--muted); min-height: 1.2em; }
    .viz-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .pd-grid { border-collapse: collapse; font-size: .78rem; min-width: 720px; }
    .pd-grid th, .pd-grid td { padding: 0; border: 1px solid var(--line); }
    .pd-grid thead th { font-size: .66rem; font-weight: 600; color: var(--muted); padding: .2rem .25rem; background: var(--surface); }
    .pd-grid thead th.corner { text-align: left; padding-left: .4rem; }
    .pd-grid tbody th { text-align: left; font-size: .74rem; font-weight: 600; white-space: nowrap; padding: 0 .5rem 0 .4rem; background: var(--surface); }
    .pd-grid .sw { display: inline-block; width: .6em; height: .6em; border-radius: 2px; margin-right: .35em; }
    .pd-grid td.c { width: 2.4rem; height: 1.9rem; text-align: center; background: rgba(35, 40, 58, calc(var(--i, 0) * .85)); }
    .pd-grid td.c a { display: block; width: 100%; height: 100%; line-height: 1.9rem; color: var(--ink); text-decoration: none; font-variant-numeric: tabular-nums; }
    .pd-grid td.c.hi a { color: #fff; }
    .pd-grid td.c a:hover, .pd-grid td.c a:focus { outline: 2px solid #b8252b; outline-offset: -2px; }
    .pd-grid td.c0 { color: #c9c4ba; }
    .pd-grid td.gap { background: repeating-linear-gradient(-45deg, transparent 0 3px, var(--line) 3px 4px); width: 1.1rem; }
    .pd-grid th.col-break { width: 1.1rem; }
    .pd-grid td.tot, .pd-grid th.tot { width: 2.6rem; text-align: center; font-weight: 700; background: var(--surface); font-variant-numeric: tabular-nums; }
    .grid-caption { font-size: .78rem; color: var(--muted); max-width: 78ch; margin: .6rem 0 0; }
    .decade { font-size: 1.15rem; border-bottom: 2px solid var(--line); padding-bottom: .3rem; margin: 2rem 0 .8rem; color: var(--muted); scroll-margin-top: 3.2rem; }
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
      .grid-live { display: none; }
      .pd-grid td.c { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .viz-scroll { overflow: visible; }
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
      <p>All ${total} events of the ${nWord} project chronologies on one timeline — filter by project, click any
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
${renderGrid(matrix, generatedAt)}${body}  </main>
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

      // Project × decade grid: live caption + click-through filtering.
      var live = document.getElementById('grid-live');
      var grid = document.querySelector('.pd-grid');
      if (grid && live) {
        var say = function (e) {
          var a = e.target.closest ? e.target.closest('a[data-say]') : null;
          if (a) live.textContent = a.getAttribute('data-say');
        };
        grid.addEventListener('mouseover', say);
        grid.addEventListener('focusin', say);
        grid.addEventListener('click', function (e) {
          var a = e.target.closest ? e.target.closest('a[data-project]') : null;
          if (!a) return;
          // Filter to the clicked project, then let the anchor jump proceed —
          // the decade heading recomputes visibility before navigation.
          chips.forEach(function (c) { c.classList.toggle('on', c.dataset.project === a.dataset.project); });
          apply();
        });
      }
    })();
  </script>
</body>
</html>
`;
}

// Write the generated figures into the hand-written landing page between
// gen: markers (issue #21) — a hand-maintained number goes stale within a
// week; this one is right by construction. Missing markers are a hard error
// so drift can never restart silently.
function patchLanding(total, nProjects) {
  const file = path.join(__dirname, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const put = (name, value) => {
    const re = new RegExp(`(<!-- gen:${name} -->)[\\s\\S]*?(<!-- /gen:${name} -->)`);
    if (!re.test(html)) throw new Error(`index.html: <!-- gen:${name} --> markers missing — banner figure would go stale silently`);
    html = html.replace(re, `$1${value}$2`);
  };
  put('events', String(total));
  put('projects', numberWord(nProjects));
  fs.writeFileSync(file, html);
}

async function main() {
  const all = [];
  const counts = {};
  for (const p of PROJECTS) {
    const url = `${RAW}/${p.id}/main/${p.file}`;
    const data = await fetchJson(url);
    const localized = p.id === 'fsp' ? false : await hasEnLocale(p.id);
    const events = p.id === 'fsp' ? adaptFsp(data) : adaptStandard(data, p.id, localized);
    for (const ev of events) all.push({ ...ev, project: p.id, projectLabel: p.label });
    counts[p.id] = events.length;
    console.log(`${p.id}: ${events.length} events${localized ? ' (deep links → /en/)' : ''}`);
  }
  all.sort((a, b) => a.year - b.year || String(a.date).localeCompare(String(b.date)));
  const generatedAt = new Date().toISOString().slice(0, 10);
  const matrix = buildMatrix(all, PROJECTS);
  const html = renderPage(all, counts, matrix, generatedAt);
  const outDir = path.join(__dirname, 'chronology');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  patchLanding(all.length, PROJECTS.length);
  console.log(`Wrote chronology/index.html (${all.length} events, ${PROJECTS.length} projects; grid ${matrix.rows.length}×${matrix.columns.length}).`);
  console.log(`Patched index.html banner figures (${all.length} events, ${numberWord(PROJECTS.length)} projects).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
