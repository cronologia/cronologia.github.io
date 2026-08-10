#!/usr/bin/env node
'use strict';
/**
 * build-chronology.js — master chronology for the Cronologia portal.
 *
 * Fetches every project's public dataset (raw.githubusercontent.com, branch
 * main), merges all events into one timeline tagged by project, and writes
 * one page per locale — {en,es,pt}/chronology/index.html — each with the
 * project × decade grid (the aggregate view, issue #22) above the filterable
 * card list. Zero dependencies (Node 18+, global fetch).
 *
 * i18n (issues #20/#16, core#9): the hub serves the DOMAIN ROOT, so the
 * locale is the FIRST path segment. UI strings come from i18n/{es,pt}.json
 * (exact-English-string-keyed, same convention as the project sites; missing
 * key → English fallback, reported). Event titles/text are reused from each
 * project's own committed data/i18n caches where the project has shipped
 * that locale — the hub never re-translates; English is the fallback, and
 * non-English pages carry the family's machine-translation disclaimer.
 *
 * It also writes chronology/stats.json (event total, project count), which
 * build-index.js bakes into the landing banner so the figure is right by
 * construction instead of hand-maintained (issue #21). The /chronology/
 * redirect stub is written by build-index.js. Run this script first:
 *
 * Usage: node build-chronology.js && node build-index.js
 */

const fs = require('fs');
const path = require('path');

const SITE = 'https://cronologia.github.io';
const RAW = 'https://raw.githubusercontent.com/cronologia';
const LOCALES = ['en', 'es', 'pt'];

// Project registry: accent colors mirror each site's identity.
const PROJECTS = [
  { id: 'fsp', label: 'Foro de São Paulo', color: '#b8252b', dark: '#7a1418', file: 'data/forum.json' },
  { id: 'fsspx', label: 'FSSPX', color: '#1e4f8f', dark: '#12365f', file: 'data/chronology.json' },
  { id: 'kofc', label: 'Knights of Columbus', color: '#0b3d91', dark: '#072a66', file: 'data/chronology.json' },
  { id: 'tl', label: 'Liberation Theology', color: '#1b7a3d', dark: '#114f27', file: 'data/chronology.json' },
  { id: 'tariqa', label: 'Tariqa Maryamiyya', color: '#0e7490', dark: '#0a4e60', file: 'data/chronology.json' },
  { id: 'perennialism', label: 'Perennialism', color: '#5b21b6', dark: '#3b1580', file: 'data/chronology.json' },
  { id: 'celam', label: 'CELAM', color: '#831843', dark: '#5a0f2e', file: 'data/chronology.json' },
  { id: 'grupopuebla', label: 'Grupo de Puebla', color: '#c2410c', dark: '#8a2d08', file: 'data/chronology.json' },
  { id: 'tfp', label: 'TFP', color: '#713f12', dark: '#4a290b', file: 'data/chronology.json' },
  { id: 'rcc', label: 'RCC', color: '#be185d', dark: '#831244', file: 'data/chronology.json' },
  { id: 'olavo', label: 'Olavo de Carvalho', color: '#7d5a1a', dark: '#4e3810', file: 'data/chronology.json' },
  { id: 'guadalupe', label: 'Guadalupe', color: '#9c3848', dark: '#6e2733', file: 'data/chronology.json' },
  { id: 'gracas', label: 'Medalha Milagrosa', color: '#1f7a72', dark: '#14524c', file: 'data/chronology.json' },
  { id: 'lasalette', label: 'La Salette', color: '#a35b2c', dark: '#713e1d', file: 'data/chronology.json' },
  { id: 'lourdes', label: 'Lourdes', color: '#2f7d4f', dark: '#1e5434', file: 'data/chronology.json' },
  { id: 'fatima', label: 'Fátima', color: '#2f4f9e', dark: '#1f346b', file: 'data/chronology.json' },
  { id: 'lagrimas', label: 'Our Lady of Tears', color: '#2e6f8e', dark: '#1e4a60', file: 'data/chronology.json' },
  { id: 'cimbres', label: 'Cimbres', color: '#6b4f8e', dark: '#4a3663', file: 'data/chronology.json' },
  { id: 'santos', label: 'Saints', color: '#8a6a16', dark: '#5c460e', file: 'data/chronology.json' },
];

const ANALYTICS = `  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-R9LV1QZHVE"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-R9LV1QZHVE');
  </script>`;

/**
 * Which translation disclaimer a locale gets, decided by the dictionary's OWN
 * `_meta` rather than asserted.
 *
 * This used to be hardcoded to "machine translation" in both generators. It was
 * never true: these dictionaries are authored (see `_meta.generatedBy`), and the
 * hub has no translation backend at all. The same defect was fixed in the
 * project template (cronologia/core#66, #69) and did not reach here, because the
 * hub has its own minimal generators rather than the template's build.js.
 *
 * Three honest states; the page states whichever holds:
 *   reviewed  — `_meta.humanReviewed === true`
 *   machine   — `_meta.generatedBy` begins with a named translation script
 *   authored  — anything else: written by hand or by an assistant, unreviewed
 *
 * `authored` is the default deliberately. Claiming machine translation over
 * authored prose invites a reader to discount text somebody stands behind, and
 * on a site whose whole argument is that provenance is tracked, the one string
 * every non-English reader sees should not be the false one.
 */
function disclaimerFor(lang) {
  if (lang === 'en') return '';
  const set = DISCLAIMERS[lang];
  if (!set) return '';
  let meta = {};
  try {
    meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n', `${lang}.json`), 'utf8'))._meta || {};
  } catch { /* no cache: fall through to authored */ }
  if (meta.humanReviewed === true) return set.reviewed;
  if (typeof meta.generatedBy === 'string' && /^scripts\/translate\.js\b/.test(meta.generatedBy.trim())) return set.machine;
  return set.authored;
}

const DISCLAIMERS = {
  es: {
    machine: '\u{1F310} Traducci\u00f3n autom\u00e1tica del ingl\u00e9s; la p\u00e1gina en ingl\u00e9s es la versi\u00f3n de referencia.',
    authored: '\u{1F310} Traducci\u00f3n del ingl\u00e9s escrita por el asistente, sin revisi\u00f3n humana; la p\u00e1gina en ingl\u00e9s es la versi\u00f3n de referencia.',
    reviewed: '\u{1F310} Traducci\u00f3n del ingl\u00e9s revisada por una persona; la p\u00e1gina en ingl\u00e9s es la versi\u00f3n de referencia.',
  },
  pt: {
    machine: '\u{1F310} Tradu\u00e7\u00e3o autom\u00e1tica do ingl\u00eas; a p\u00e1gina em ingl\u00eas \u00e9 a vers\u00e3o de refer\u00eancia.',
    authored: '\u{1F310} Tradu\u00e7\u00e3o do ingl\u00eas escrita pelo assistente, sem revis\u00e3o humana; a p\u00e1gina em ingl\u00eas \u00e9 a vers\u00e3o de refer\u00eancia.',
    reviewed: '\u{1F310} Tradu\u00e7\u00e3o do ingl\u00eas revista por uma pessoa; a p\u00e1gina em ingl\u00eas \u00e9 a vers\u00e3o de refer\u00eancia.',
  },
};

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NUMBER_WORDS = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'],
  es: ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte'],
  pt: ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove', 'vinte'],
};
const numberWord = (lang, n) => (NUMBER_WORDS[lang] || NUMBER_WORDS.en)[n] || String(n);

// UI strings (English is authoritative; es/pt come from i18n/*.json).
const S = {
  titleTag: 'Master chronology — Cronologia',
  metaDesc: 'Every event of the Cronologia family on one timeline: {projects} source-referenced chronologies of political and religious history, merged and filterable by project.',
  home: '← Cronologia',
  h1: 'Master chronology',
  headerLead: 'All {events} events of the {projects} project chronologies on one timeline — filter by project, click any event for the full cited entry on its project site. Intersections the projects document separately become visible side by side here.',
  chipAll: 'All',
  gridHeading: 'Events by project and decade',
  gridLive: 'Hover, tap or tab through the cells for details; a cell filters the timeline to its project and jumps to its decade.',
  capEncoding: 'Cell shade and the printed count encode the same number (never colour alone).',
  capOrder: "Rows are ordered by each project's first event — a narrative choice, not a neutral ordering.",
  capBuckets: 'Decade buckets hide within-decade bursts, so an even shade does not imply an even spread.',
  capBreak: 'The ⋯ column is an explicit break — {gaps} — not a dense stretch.',
  gapNote: 'no events {from}–{to}',
  capGenerated: "Counts are generated from the projects' public datasets ({date}); each event carries its citations on its project page.",
  colProject: 'project',
  colTotal: 'total',
  before1900: 'Before 1900',
  flagTitle: 'date not fully verified — see the project page',
  eventOne: 'event',
  eventMany: 'events',
  footer: "Generated {date} from the projects' public datasets — every event carries its citations on its project page.",
  langLabel: 'Language',
};

function loadDict(lang) {
  if (lang === 'en') return null;
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n', `${lang}.json`), 'utf8'));
  return d.strings || {};
}

function makeT(lang) {
  const dict = loadDict(lang);
  const missing = new Set();
  const t = (s) => {
    if (lang === 'en') return s;
    const v = dict[s];
    if (v === undefined) { missing.add(s); return s; }
    return v;
  };
  t.missing = missing;
  return t;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
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
    link: `${SITE}/fsp/meetings/${m.year}.html`,
    sub: `meetings/${m.year}.html`, // locale-aware deep link target within the project
  }));
}

function adaptStandard(data, id) {
  return (data.events || []).map((ev) => ({
    year: ev.year,
    date: ev.date || String(ev.year),
    dateVerified: ev.dateVerified !== false,
    title: ev.title,
    text: ev.text || '',
    link: `${SITE}/${id}/#chronology`,
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

function renderGrid({ columns, rows, max }, generatedAt, t) {
  const breaks = columns.filter((c) => c.break);
  const head = columns
    .map((c) =>
      c.break
        ? `<th scope="col" class="col-break" title="${esc(t(S.gapNote).replace('{from}', c.from).replace('{to}', c.to))}">⋯</th>`
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
          const say = `${p.label}, ${decadeLabel(c.decade)}: ${n} ${n === 1 ? t(S.eventOne) : t(S.eventMany)}`;
          return `<td class="c${ratio > 0.55 ? ' hi' : ''}" style="--i:${ratio.toFixed(2)}">` +
            `<a href="#${decadeAnchor(c.decade)}" data-project="${p.id}" data-say="${esc(say)}" aria-label="${esc(say)}">${n}</a></td>`;
        })
        .join('');
      return `        <tr><th scope="row"><span class="sw" style="background:${p.color}"></span>${esc(p.label)}</th>${tds}<td class="tot">${total}</td></tr>`;
    })
    .join('\n');

  const gaps = breaks.map((b) => t(S.gapNote).replace('{from}', b.from).replace('{to}', b.to)).join('; ');
  const breakNote = breaks.length ? ` ${t(S.capBreak).replace('{gaps}', gaps)}` : '';

  return `    <section class="grid-section" aria-labelledby="grid-h">
      <h2 id="grid-h">${esc(t(S.gridHeading))}</h2>
      <p class="grid-live" id="grid-live" aria-live="polite">${esc(t(S.gridLive))}</p>
      <div class="viz-scroll">
        <table class="pd-grid">
          <thead><tr><th scope="col" class="corner">${esc(t(S.colProject))}</th>${head}<th scope="col" class="tot">${esc(t(S.colTotal))}</th></tr></thead>
          <tbody>
${body}
          </tbody>
        </table>
      </div>
      <p class="grid-caption">${esc(t(S.capEncoding))}
      ${esc(t(S.capOrder))}
      ${esc(t(S.capBuckets))}${esc(breakNote)}
      ${esc(t(S.capGenerated).replace('{date}', generatedAt))}</p>
    </section>
`;
}

// ---- page -------------------------------------------------------------------

function langSwitch(lang, t) {
  const links = LOCALES.map((l) =>
    l === lang
      ? `<span class="lang-current" aria-current="true">${l.toUpperCase()}</span>`
      : `<a href="/${l}/chronology/" hreflang="${l}">${l.toUpperCase()}</a>`
  ).join('');
  return `<nav class="lang-switch" aria-label="${esc(t(S.langLabel))}">${links}</nav>`;
}

function renderPage(lang, t, events, counts, matrix, generatedAt) {
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
    const decade = ev.year < 1900 ? t(S.before1900) : `${decadeOf(ev.year)}s`;
    if (decade !== lastDecade) {
      const id = ev.year < 1900 ? 'd-early' : `d${decadeOf(ev.year)}`;
      body += `      <h2 class="decade" id="${id}">${esc(decade)}</h2>\n`;
      lastDecade = decade;
    }
    const flag = ev.dateVerified ? '' : ` <span class="flag" title="${esc(t(S.flagTitle))}">?</span>`;
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
  const nWord = numberWord(lang, PROJECTS.length);
  const headerLead = t(S.headerLead).replace('{events}', String(total)).replace('{projects}', nWord);
  const metaDesc = t(S.metaDesc).replace('{projects}', nWord);
  const disclaimerText = disclaimerFor(lang);
  const disclaimer = disclaimerText ? `\n  <div class="i18n-disclaimer" role="note">${disclaimerText}</div>` : '';
  const alt = LOCALES.map((l) => `  <link rel="alternate" hreflang="${l}" href="${SITE}/${l}/chronology/">`).join('\n');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(t(S.titleTag))}</title>
  <meta name="description" content="${esc(metaDesc)}" />
  <link rel="canonical" href="${SITE}/${lang}/chronology/">
${alt}
  <link rel="alternate" hreflang="x-default" href="${SITE}/chronology/">
${ANALYTICS}
  <style>
    :root { --bg: #faf8f5; --surface: #ffffff; --ink: #1d2330; --muted: #6b7280; --line: #e4e0d8; --maxw: 920px; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--ink); background: var(--bg); line-height: 1.55; }
    .wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 1.25rem; }
    .i18n-disclaimer { background: #fdf3e3; border-bottom: 1px solid #ecd9b0; color: #6b5518; font-size: .82rem; padding: .45rem 1.25rem; text-align: center; }
    .site-header { background: linear-gradient(135deg, #23283a, #3b4257); color: #fff; padding: 2.25rem 0 1.5rem; position: relative; }
    .site-header h1 { margin: 0 0 .25rem; font-size: 1.9rem; letter-spacing: -.5px; }
    .site-header p { margin: 0; opacity: .92; max-width: 70ch; }
    .site-header a.home { color: #cfd6e4; font-size: .85rem; text-decoration: none; }
    .lang-switch { position: absolute; top: 1rem; right: 1.25rem; font-size: .8rem; }
    .lang-switch a, .lang-switch .lang-current { color: #cfd6e4; text-decoration: none; padding: .15rem .4rem; border-radius: 4px; }
    .lang-switch .lang-current { background: rgba(255,255,255,.18); color: #fff; font-weight: 700; }
    .lang-switch a:hover { background: rgba(255,255,255,.1); }
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
      .lang-switch { top: .55rem; }
      .filters .wrap { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
      .filters .wrap::-webkit-scrollbar { display: none; }
      .ev { grid-template-columns: 3.2rem 1fr; gap: .6rem; }
    }
    @media print {
      .filters { display: none; }
      .grid-live { display: none; }
      .lang-switch { display: none; }
      .i18n-disclaimer { display: none; }
      .pd-grid td.c { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .viz-scroll { overflow: visible; }
      .ev { break-inside: avoid; border: none; border-left: 3px solid #888; padding: .3rem .6rem; }
      .site-header { background: none; color: #000; }
      .site-header a.home { display: none; }
      a { text-decoration: none; color: inherit; }
    }
  </style>
</head>
<body>${disclaimer}
  <header class="site-header">
    <div class="wrap">
      ${langSwitch(lang, t)}
      <a class="home" href="/${lang}/">${esc(t(S.home))}</a>
      <h1>${esc(t(S.h1))}</h1>
      <p>${esc(headerLead)}</p>
    </div>
  </header>
  <div class="filters">
    <div class="wrap">
      <button class="chip chip-all" id="toggle-all">${esc(t(S.chipAll))}</button>
${chips}
    </div>
  </div>
  <main class="wrap">
${renderGrid(matrix, generatedAt, t)}${body}  </main>
  <footer class="site-footer">
    <div class="wrap">
      <p>${esc(t(S.footer).replace('{date}', generatedAt))} <a href="https://github.com/cronologia">github.com/cronologia</a></p>
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

async function main() {
  // One fetch pass per project: dataset, shipped locales, committed i18n
  // caches (the hub reuses the projects' own translations — it never
  // re-translates event text).
  const loaded = [];
  for (const p of PROJECTS) {
    const data = await fetchJson(`${RAW}/${p.id}/main/${p.file}`);
    const langs = new Set(['en']);
    const dicts = {};
    for (const lang of ['es', 'pt']) {
      if (await headOk(`${RAW}/${p.id}/main/docs/${lang}/index.html`)) {
        langs.add(lang);
        try {
          dicts[lang] = (await fetchJson(`${RAW}/${p.id}/main/data/i18n/${lang}.json`)).strings || {};
        } catch {
          dicts[lang] = {};
        }
      }
    }
    if (!(await headOk(`${RAW}/${p.id}/main/docs/en/index.html`))) langs.delete('en');
    const events = p.id === 'fsp' ? adaptFsp(data) : adaptStandard(data, p.id);
    loaded.push({ p, events, langs, dicts });
    console.log(`${p.id}: ${events.length} events${langs.size ? ` (locales: ${[...langs].sort().join(',')})` : ''}`);
  }

  const generatedAt = new Date().toISOString().slice(0, 10);
  const outStats = { events: 0, projects: PROJECTS.length, generatedAt };

  for (const lang of LOCALES) {
    const t = makeT(lang);
    const all = [];
    const counts = {};
    for (const { p, events, langs, dicts } of loaded) {
      const dict = lang !== 'en' ? dicts[lang] : null;
      const localized = events.map((ev) => {
        const out = { ...ev, project: p.id, projectLabel: p.label };
        if (dict) {
          if (dict[ev.title]) out.title = dict[ev.title];
          if (ev.text && dict[ev.text]) out.text = dict[ev.text];
        }
        // Deep-link into the project's own locale tree where it exists; the
        // bare /<id>/ root stub drops the URL hash, so never link it with one
        // unless the project has no locale tree at all (then the root IS the
        // real page and the hash works). Events with a `sub` path (fsp's
        // meeting pages) deep-link that file inside the locale tree instead.
        const best = langs.has(lang) ? lang : langs.has('en') ? 'en' : null;
        if (ev.sub) {
          out.link = best ? `${SITE}/${p.id}/${best}/${ev.sub}` : `${SITE}/${p.id}/${ev.sub}`;
        } else {
          out.link = best ? `${SITE}/${p.id}/${best}/#chronology` : `${SITE}/${p.id}/#chronology`;
        }
        return out;
      });
      all.push(...localized);
      counts[p.id] = localized.length;
    }
    all.sort((a, b) => a.year - b.year || String(a.date).localeCompare(String(b.date)));
    const matrix = buildMatrix(all, PROJECTS);
    const html = renderPage(lang, t, all, counts, matrix, generatedAt);
    const dir = path.join(__dirname, lang, 'chronology');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    outStats.events = all.length;
    if (t.missing.size) {
      console.warn(`${lang}: ${t.missing.size} UI string(s) missing a translation (fell back to English):`);
      for (const s of t.missing) console.warn(`  - ${s.slice(0, 70)}`);
    }
    console.log(`Wrote ${lang}/chronology/index.html (${all.length} events; grid ${matrix.rows.length}×${matrix.columns.length}).`);
  }

  fs.mkdirSync(path.join(__dirname, 'chronology'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'chronology', 'stats.json'), JSON.stringify(outStats, null, 2) + '\n');
  console.log(`Wrote chronology/stats.json (${outStats.events} events, ${outStats.projects} projects).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
