#!/usr/bin/env node
'use strict';
/**
 * build-index.js — the hub landing page, one build per locale.
 *
 * DECISION (issue #20): the hub adopts a MINIMAL GENERATOR instead of three
 * hand-maintained index.html files. Rationale, recorded here and in README:
 * the hub already stopped being build-free when /chronology/ shipped; three
 * parallel hand-edited landings triple every edit and will drift in exactly
 * the copy where drift is dangerous (the "grouping is navigational, not a
 * claim" note). The README principle is "nothing unbuildable in five years",
 * not "no build": this script is the same zero-dependency Node the project
 * sites use.
 *
 * English is authored HERE (the template literals below are the source of
 * truth); es/pt come from i18n/{es,pt}.json — exact-English-string-keyed
 * maps, the same convention as the project sites' data/i18n caches, so a
 * changed English string automatically falls back to English and is reported
 * until its translation is refreshed. Non-English pages carry the family's
 * visible machine-translation disclaimer.
 *
 * URLs (issue #16 / core#9): this repo serves the DOMAIN ROOT, so the locale
 * is the FIRST path segment — /{en,es,pt}/ — and / becomes the redirect stub.
 * Event figures come from chronology/stats.json (written by
 * build-chronology.js — run that first).
 *
 * Usage: node build-chronology.js && node build-index.js
 */

const fs = require('fs');
const path = require('path');

const SITE = 'https://cronologia.github.io';
const RAW = 'https://raw.githubusercontent.com/cronologia';
const LOCALES = ['en', 'es', 'pt'];

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

// The four groups and ten cards. Structure (order, colors, hrefs, years)
// lives here; every visible string routes through t().
const GROUPS = [
  {
    heading: 'The Catholic Church',
    desc: 'Movements, institutions and disputes inside the Catholic Church — traditionalist opposition, charismatic renewal, liberation theology, and the Latin American episcopate they all argue about. Grouped by the institution whose history they belong to, not by any shared position within it.',
    cards: [
      { id: 'fsspx', cls: 'p-fsspx', years: '1970–present', title: 'Society of Saint Pius X', desc: 'The traditionalist priestly society founded by Marcel Lefebvre and its relationship with the Holy See — from Écône 1988 to the 2026 rupture, with the full episcopal genealogy of the traditionalist lines.' },
      { id: 'tfp', cls: 'p-tfp', years: '1908–present', title: 'TFP / Plinio Corrêa de Oliveira', desc: "The lay traditionalist movement founded in 1960 — the campaigns, the 1985 CNBB note, the succession dispute, and the two branches of today: the Heralds of the Gospel and the IPCO." },
      { id: 'rcc', cls: 'p-rcc', years: '1967–present', title: 'Catholic Charismatic Renewal', desc: "The Catholic Charismatic Renewal from the 1967 Duquesne Weekend to CHARIS — with the Brazilian movement: Rahm and Dougherty, Canção Nova, Shalom, the CNBB's 1994 guidelines and the media wave." },
      { id: 'tl', cls: 'p-tl', years: '1960s–present', title: 'Liberation Theology', desc: 'The Latin American theological movement — Medellín, Gutiérrez, the Vatican instructions, the martyrs and the later reception — with a map of where its story happened.' },
      { id: 'celam', cls: 'p-celam', years: '1955–present', title: 'CELAM', desc: "The Latin American bishops' council as an institution — the five General Conferences (Rio to Aparecida), the assemblies, presidencies and reforms; the interpretation wars live in the TL project." },
    ],
  },
  {
    heading: 'The Latin American left',
    desc: 'The regional forums where left-wing parties and politicians of Latin America and the Caribbean meet — two distinct bodies, with different founders, memberships and forms, that are routinely conflated and are documented separately here.',
    cards: [
      { id: 'fsp', cls: 'p-fsp', years: '1990–present', title: 'Foro de São Paulo', desc: 'The conference of left-wing parties and organizations of Latin America and the Caribbean: every meeting, member parties, presidencies, legislatures and courts — with a year-by-year map of the region.' },
      { id: 'grupopuebla', cls: 'p-puebla', years: '2019–present', title: 'Grupo de Puebla', desc: 'The progressive forum of individuals founded in Puebla 2019 — encuentros, declarations, CLAJUD — and the documented disambiguation from the Foro de São Paulo, with which it is constantly conflated.' },
    ],
  },
  {
    heading: 'Esoteric and perennialist currents',
    desc: "The Traditionalist School of René Guénon and Frithjof Schuon — a twentieth-century current of ideas about a perennial philosophy, and the initiatic order that grew out of it. These are chronologies of that school's own history, not of the religious traditions its authors wrote about.",
    cards: [
      { id: 'tariqa', cls: 'p-tariqa', years: '1886–present', title: 'Tariqa Maryamiyya', desc: 'The Sufi order of Frithjof Schuon and the Traditionalist School (Guénon–Schuon perennialism) — and its documented connections to Catholic traditionalism and to Brazil.' },
      { id: 'perennialism', cls: 'p-peren', years: '1540–present', title: 'Perennialism', desc: "The Traditionalist School as a movement of ideas — Guénon's corpus, the journals, Evola's political adaptation and its receptions, and the academic institutionalization of the perennial philosophy." },
    ],
  },
  {
    heading: 'Marian apparitions and the Church\'s judgments',
    desc: "Reported apparitions of the Virgin Mary, and what Church authority actually did about each one. These chronologies record two different kinds of thing and never confuse them: who reported what and when, and which bishop or dicastery ruled and when, citing the act. They do not assert that any apparition took place. Each carries a chart of how far its case got \u2014 local inquiry, the bishop's judgment, referral to Rome \u2014 in which \u201cno ruling found\u201d is kept distinct from \u201cruled against\u201d and from \u201cnever went there\u201d.",
    cards: [
      { id: 'guadalupe', cls: 'p-guadalupe', years: '1521\u20132025', title: 'Our Lady of Guadalupe', desc: 'The Tepeyac account of 1531 and the documentary record behind it \u2014 Nican Mopohua, the 1556 Bustamante controversy, the 1666 Informaciones \u2014 with the historicity dispute carried as a live disagreement between named scholars, not settled.' },
      { id: 'gracas', cls: 'p-gracas', years: '1806\u20131947', title: 'Our Lady of Grace — the Miraculous Medal', desc: 'The 1830 Rue du Bac reports and the medal struck from them \u2014 with the attestation chain made explicit: Catherine Labour\u00e9 stayed publicly anonymous for life, and the account reached the Church through her confessor.' },
      { id: 'lasalette', cls: 'p-lasalette', years: '1826\u20132016', title: 'Our Lady of La Salette', desc: 'The 1846 Alpine apparition, approved by the bishop of Grenoble in 1851 \u2014 and the separate Holy Office condemnations of M\u00e9lanie\'s expanded \u201csecrets\u201d in 1915 and 1923, kept apart from it because they judge a different object.' },
      { id: 'lourdes', cls: 'p-lourdes', years: '1854\u20132024', title: 'Our Lady of Lourdes', desc: 'The 1858 grotto reports, Bishop Laurence\'s 1862 decree, and the Medical Bureau \u2014 where the datable events are the bishops\u2019 recognition acts for individual cures, and the cure counts are attributed to the Sanctuary that keeps them.' },
      { id: 'fatima', cls: 'p-fatima', years: '1881\u20132017', title: 'Our Lady of Fátima', desc: 'The 1917 Cova da Iria reports and the 1930 pastoral letter that judged them \u2014 with the anticlerical First Republic before, the memoirs that attest much of it retrospectively, and the Roman acts named for what each actually is.' },
      { id: 'lagrimas', cls: 'p-lagrimas', years: '1901\u20132023', title: 'Our Lady of Tears', desc: 'The apparitions reported to Am\u00e1lia Aguirre in Campinas around 1929\u201330 \u2014 where no Church judgment on the apparitions has been located, and the recognitions devotional literature reports are recorded as reported, without the documents.' },
      { id: 'cimbres', cls: 'p-cimbres', years: '1676\u20132026', title: 'Our Lady of Grace of Cimbres', desc: 'The 1936 reports at Cimbres, in Xukuru territory in Pernambuco \u2014 no diocesan ruling from the period has been found, and the diocese\u2019s own 2021 pastoral letter calls itself the Church\u2019s first response.' },
      { id: 'santos', cls: 'p-santos', years: '1531\u20132017', title: 'Saints', desc: 'The canonization paths of the seers themselves \u2014 Juan Diego, Catherine Labour\u00e9, Bernadette Soubirous, Francisco and Jacinta Marto \u2014 recorded as dated Church judgments about persons, which is not the same as authenticating an apparition.' },
    ],
  },
  {
    heading: 'Intellectual biographies',
    desc: 'Chronologies of individual authors whose trajectories cross several of the other projects — documented as lives and works, with contested characterizations attributed, never adjudicated.',
    cards: [
      { id: 'olavo', cls: 'p-olavo', years: '1947–2022', title: 'Olavo de Carvalho', desc: 'Self-taught philosopher, polemicist and central reference of the Brazilian New Right, earlier a journalist — his life and works, and reception pages for the philosophers his 585-lecture course engaged most.' },
    ],
  },
];

const PRINCIPLES = [
  { strong: 'Verifiability over completeness', text: 'Every entry cites its sources; uncertain dates carry a visible <b>?</b> flag rather than a guess.' },
  { strong: 'Neutrality by attribution', text: 'Contested characterizations are attributed — who says so, when — with sources across the spectrum, labeled for perspective.' },
  { strong: 'Durable evidence', text: 'References are archived in the Wayback Machine and volatile documents vaulted, so citations stay checkable for years.' },
  { strong: 'Radical simplicity', text: 'One JSON dataset, one zero-dependency compiler, plain HTML on GitHub Pages. Nothing that will be unbuildable in five years.' },
  { strong: 'Open correction', text: 'All data is public JSON in public repositories — corrections against primary sources are welcome as issues or pull requests.' },
];

const S = {
  title: 'Cronologia — source-referenced chronologies of contested subjects',
  metaDesc: 'Open, source-referenced chronologies of contested subjects in political and religious history — eighteen projects covering movements and institutions of the Catholic Church, the Latin American left, the Traditionalist School, reported Marian apparitions and the Church judgments on them, and the intellectuals between them. Every fact cited to a public source.',
  subtitle: 'Source-referenced chronologies of contested subjects',
  lead: 'Timelines of organizations, movements and reported events in political and religious history — centred on Latin America, and following subjects beyond it where their story goes. Every fact cited to a public source, every uncertain date flagged, every contested claim attributed to its author. On argued-about ground, a verifiable timeline is more useful than another opinion.',
  masterStrong: '⏳ Master chronology →',
  masterSpan: 'All {events} events of the {projects} projects on one filterable timeline — see the intersections side by side.',
  glossaryStrong: '📖 Shared glossary →',
  glossarySpan: 'Cited definitions of the recurring terms, one page per term, so every chronology links to the same stable explanation instead of redefining it.',
  groupingStrong: 'Eighteen chronologies, grouped by subject area.',
  groupingNote: 'The groups below are a navigational aid, not a claim about the subjects. Projects listed together are not thereby asserted to share a programme, an alliance, an origin or an identity — several of them are opposed to each other, and the datasets document that with sources. Each chronology stands on its own.',
  howHeading: 'How these sites work',
  nextHeading: "What's next",
  roadmap: 'Candidate chronologies — the Partido dos Trabalhadores, the Fórum Social Mundial, the Brazilian New Right and more — are tracked as issues in the {link}. Suggestions welcome.',
  roadmapLink: 'portal repository',
  footer: "Cronologia — open data on {gh}. MIT licensed. Each chronology's dataset lives in its own public repository.",
  langLabel: 'Language',
};

// A project that has shipped a locale serves real pages at /<id>/<lang>/;
// otherwise its root stub is the only entry point. Detected per build.
async function localeMap() {
  const map = {}; // id -> Set of langs
  const ids = GROUPS.flatMap((g) => g.cards.map((c) => c.id));
  for (const id of ids) {
    map[id] = new Set();
    for (const lang of LOCALES) {
      try {
        const res = await fetch(`${RAW}/${id}/main/docs/${lang}/index.html`, { method: 'HEAD' });
        if (res.ok) map[id].add(lang);
      } catch { /* unreachable — treat as not localized */ }
    }
  }
  return map;
}

const projectHref = (id, lang, locales) => (locales[id] && locales[id].has(lang) ? `/${id}/${lang}/` : `/${id}/`);

function langSwitch(lang, route, t) {
  const links = LOCALES.map((l) =>
    l === lang
      ? `<span class="lang-current" aria-current="true">${l.toUpperCase()}</span>`
      : `<a href="/${l}/${route}" hreflang="${l}">${l.toUpperCase()}</a>`
  ).join('');
  return `<nav class="lang-switch" aria-label="${esc(t(S.langLabel))}">${links}</nav>`;
}

function hreflangCluster(route) {
  const alt = LOCALES.map((l) => `  <link rel="alternate" hreflang="${l}" href="${SITE}/${l}/${route}">`).join('\n');
  return `${alt}\n  <link rel="alternate" hreflang="x-default" href="${SITE}/${route}">`;
}

function renderLanding(lang, stats, locales, t) {
  const masterSpan = t(S.masterSpan)
    .replace('{events}', String(stats.events))
    .replace('{projects}', numberWord(lang, stats.projects));
  const disclaimerText = disclaimerFor(lang);
  const disclaimer = disclaimerText ? `\n  <div class="i18n-disclaimer" role="note">${disclaimerText}</div>` : '';

  const groups = GROUPS.map((g) => {
    const cards = g.cards.map((c) => `        <a class="project ${c.cls}" href="${projectHref(c.id, lang, locales)}">
          <span class="years">${esc(t(c.years))}</span>
          <h3>${esc(t(c.title))}</h3>
          <p>${esc(t(c.desc))}</p>
        </a>`).join('\n');
    return `    <section class="group">
      <h2>${esc(t(g.heading))}</h2>
      <p class="group-desc">${esc(t(g.desc))}</p>
      <div class="projects">
${cards}
      </div>
    </section>`;
  }).join('\n\n');

  const principles = PRINCIPLES.map(
    (p) => `      <li><strong>${esc(t(p.strong))}</strong> ${t(p.text)}</li>`
  ).join('\n');

  const roadmap = esc(t(S.roadmap)).replace(
    '{link}',
    `<a href="https://github.com/cronologia/cronologia.github.io/issues">${esc(t(S.roadmapLink))}</a>`
  );
  const footer = esc(t(S.footer)).replace(
    '{gh}',
    '<a href="https://github.com/cronologia">github.com/cronologia</a>'
  );

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(t(S.title))}</title>
  <meta name="description" content="${esc(t(S.metaDesc))}">
  <link rel="canonical" href="${SITE}/${lang}/">
${hreflangCluster('')}
${ANALYTICS}
  <style>
    :root {
      --bg: #faf8f5; --surface: #ffffff; --ink: #1d2330; --muted: #6b7280;
      --line: #e4e0d8; --maxw: 920px;
      --fsp: #b8252b; --fsp-dark: #7a1418;
      --fsspx: #1e4f8f; --fsspx-dark: #12365f;
      --tl: #1b7a3d; --tl-dark: #114f27;
      --tariqa: #0e7490; --tariqa-dark: #0a4e60;
      --peren: #5b21b6; --peren-dark: #3b1580;
      --celam: #831843; --celam-dark: #5a0f2e;
      --puebla: #c2410c; --puebla-dark: #8a2d08;
      --tfp: #713f12; --tfp-dark: #4a290b;
      --rcc: #be185d; --rcc-dark: #831244;
      --olavo: #7d5a1a; --olavo-dark: #4e3810;
      --guadalupe: #9c3848; --guadalupe-dark: #6e2733;
      --gracas: #1f7a72; --gracas-dark: #14524c;
      --lasalette: #a35b2c; --lasalette-dark: #713e1d;
      --lourdes: #2f7d4f; --lourdes-dark: #1e5434;
      --fatima: #2f4f9e; --fatima-dark: #1f346b;
      --lagrimas: #2e6f8e; --lagrimas-dark: #1e4a60;
      --cimbres: #6b4f8e; --cimbres-dark: #4a3663;
      --santos: #8a6a16; --santos-dark: #5c460e;
      --ref: #4b5563;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--ink); background: var(--bg); line-height: 1.55; }
    .wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 1.25rem; }
    .i18n-disclaimer { background: #fdf3e3; border-bottom: 1px solid #ecd9b0; color: #6b5518; font-size: .82rem; padding: .45rem 1.25rem; text-align: center; }
    .site-header { background: linear-gradient(135deg, #23283a, #3b4257); color: #fff; padding: 3.5rem 0 2.5rem; position: relative; }
    .site-header h1 { margin: 0 0 .25rem; font-size: 2.4rem; letter-spacing: -.5px; }
    .site-header .subtitle { margin: 0 0 1rem; font-size: 1.15rem; opacity: .92; }
    .site-header .lead { margin: 0; max-width: 68ch; opacity: .95; }
    .lang-switch { position: absolute; top: 1rem; right: 1.25rem; font-size: .8rem; }
    .lang-switch a, .lang-switch .lang-current { color: #cfd6e4; text-decoration: none; padding: .15rem .4rem; border-radius: 4px; }
    .lang-switch .lang-current { background: rgba(255,255,255,.18); color: #fff; font-weight: 700; }
    .lang-switch a:hover { background: rgba(255,255,255,.1); }
    main { padding: 2.25rem 1.25rem 3rem; }
    h2 { font-size: 1.4rem; border-bottom: 2px solid var(--line); padding-bottom: .4rem; margin: 2.25rem 0 1rem; }
    .group { margin: 0 0 2.25rem; }
    .group > h2 { margin-bottom: .3rem; }
    .group-desc { margin: 0 0 1rem; max-width: 68ch; font-size: .95rem; color: var(--muted); }
    .grouping-note { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--ref); border-radius: 6px; padding: .9rem 1.1rem; margin: 0 0 2rem; font-size: .92rem; color: var(--muted); max-width: 72ch; }
    .grouping-note strong { display: block; color: var(--ink); margin-bottom: .2rem; }
    .projects { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
    .project { display: flex; flex-direction: column; gap: .35rem; background: var(--surface); border: 1px solid var(--line); border-top: 5px solid var(--muted); border-radius: 8px; padding: 1.1rem 1.2rem; text-decoration: none; color: var(--ink); transition: box-shadow .12s ease, transform .12s ease; }
    a.project:hover { box-shadow: 0 4px 14px rgba(0,0,0,.10); transform: translateY(-2px); }
    .project h3 { margin: 0; font-size: 1.12rem; }
    .project .years { font-size: .8rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .project p { margin: .2rem 0 0; font-size: .9rem; color: var(--muted); }
    .p-fsp { border-top-color: var(--fsp); } .p-fsp .years, .p-fsp h3 { color: var(--fsp-dark); }
    .p-fsspx { border-top-color: var(--fsspx); } .p-fsspx .years, .p-fsspx h3 { color: var(--fsspx-dark); }
    .p-tl { border-top-color: var(--tl); } .p-tl .years, .p-tl h3 { color: var(--tl-dark); }
    .p-tariqa { border-top-color: var(--tariqa); } .p-tariqa .years, .p-tariqa h3 { color: var(--tariqa-dark); }
    .p-peren { border-top-color: var(--peren); } .p-peren .years, .p-peren h3 { color: var(--peren-dark); }
    .p-celam { border-top-color: var(--celam); } .p-celam .years, .p-celam h3 { color: var(--celam-dark); }
    .p-puebla { border-top-color: var(--puebla); } .p-puebla .years, .p-puebla h3 { color: var(--puebla-dark); }
    .p-tfp { border-top-color: var(--tfp); } .p-tfp .years, .p-tfp h3 { color: var(--tfp-dark); }
    .p-rcc { border-top-color: var(--rcc); } .p-rcc .years, .p-rcc h3 { color: var(--rcc-dark); }
    .p-olavo { border-top-color: var(--olavo); } .p-olavo .years, .p-olavo h3 { color: var(--olavo-dark); }
    .p-guadalupe { border-top-color: var(--guadalupe); } .p-guadalupe .years, .p-guadalupe h3 { color: var(--guadalupe-dark); }
    .p-gracas { border-top-color: var(--gracas); } .p-gracas .years, .p-gracas h3 { color: var(--gracas-dark); }
    .p-lasalette { border-top-color: var(--lasalette); } .p-lasalette .years, .p-lasalette h3 { color: var(--lasalette-dark); }
    .p-lourdes { border-top-color: var(--lourdes); } .p-lourdes .years, .p-lourdes h3 { color: var(--lourdes-dark); }
    .p-fatima { border-top-color: var(--fatima); } .p-fatima .years, .p-fatima h3 { color: var(--fatima-dark); }
    .p-lagrimas { border-top-color: var(--lagrimas); } .p-lagrimas .years, .p-lagrimas h3 { color: var(--lagrimas-dark); }
    .p-cimbres { border-top-color: var(--cimbres); } .p-cimbres .years, .p-cimbres h3 { color: var(--cimbres-dark); }
    .p-santos { border-top-color: var(--santos); } .p-santos .years, .p-santos h3 { color: var(--santos-dark); }
    .principles { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; padding: 0; margin: 0; list-style: none; }
    .principles li { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: .9rem 1.1rem; font-size: .92rem; }
    .principles strong { display: block; margin-bottom: .2rem; }
    .master-banner { display: block; background: linear-gradient(135deg, #23283a, #3b4257); color: #fff; border-radius: 8px; padding: 1rem 1.25rem; text-decoration: none; margin: 0 0 1.75rem; }
    .master-banner--alt { background: linear-gradient(135deg, #3f3a2f, #5b5344); }
    .master-banner:hover { box-shadow: 0 4px 14px rgba(0,0,0,.25); }
    .master-banner strong { font-size: 1.05rem; }
    .master-banner span { display: block; font-size: .88rem; opacity: .85; margin-top: .15rem; }
    .roadmap { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid #c47f17; border-radius: 6px; padding: .9rem 1.1rem; font-size: .95rem; }
    .roadmap a { color: #9a6410; font-weight: 600; }
    .site-footer { border-top: 1px solid var(--line); padding: 1.5rem 0; color: var(--muted); font-size: .85rem; }
    .site-footer p { margin: 0 0 .4rem; max-width: 78ch; }
    .site-footer a { color: var(--muted); }
  </style>
</head>
<body>${disclaimer}
  <header class="site-header">
    <div class="wrap">
      ${langSwitch(lang, '', t)}
      <h1>Cronologia</h1>
      <p class="subtitle">${esc(t(S.subtitle))}</p>
      <p class="lead">${esc(t(S.lead))}</p>
    </div>
  </header>
  <main class="wrap">
    <a class="master-banner" href="/${lang}/chronology/">
      <strong>${esc(t(S.masterStrong))}</strong>
      <span>${esc(masterSpan)}</span>
    </a>
    <a class="master-banner master-banner--alt" href="/glossary/${lang}/">
      <strong>${esc(t(S.glossaryStrong))}</strong>
      <span>${esc(t(S.glossarySpan))}</span>
    </a>

    <p class="grouping-note"><strong>${esc(t(S.groupingStrong))}</strong>
    ${esc(t(S.groupingNote))}</p>

${groups}

    <h2>${esc(t(S.howHeading))}</h2>
    <ul class="principles">
${principles}
    </ul>

    <h2>${esc(t(S.nextHeading))}</h2>
    <p class="roadmap">${roadmap}</p>
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <p>${footer}</p>
    </div>
  </footer>
</body>
</html>
`;
}

// Root redirect stub — same pattern as the project sites: stored preference,
// then browser language, then English; noscript falls through to /en/.
function renderStub(route, title) {
  const alt = hreflangCluster(route);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="canonical" href="${SITE}/en/${route}">
${alt}
  <script>
    (function () {
      var supported = ["en","es","pt"];
      var stored = null; try { stored = localStorage.getItem('lang'); } catch (e) {}
      var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
      var pick = supported.indexOf(stored) >= 0 ? stored : (supported.indexOf(nav) >= 0 ? nav : 'en');
      location.replace('/' + pick + '/${route}');
    })();
  </script>
  <noscript><meta http-equiv="refresh" content="0; url=/en/${route}"></noscript>
  <title>${esc(title)}</title>
</head>
<body><p>Redirecting… <a href="/en/${route}">English</a> · <a href="/es/${route}">Español</a> · <a href="/pt/${route}">Português</a></p></body>
</html>
`;
}

function renderSitemap() {
  const routes = ['', 'chronology/'];
  const urls = routes.flatMap((route) =>
    LOCALES.map((lang) => {
      const alts = LOCALES.map(
        (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}/${l}/${route}"/>`
      ).join('\n') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/${route}"/>`;
      return `  <url>\n    <loc>${SITE}/${lang}/${route}</loc>\n${alts}\n  </url>`;
    })
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

async function main() {
  const stats = JSON.parse(fs.readFileSync(path.join(__dirname, 'chronology', 'stats.json'), 'utf8'));
  const locales = await localeMap();
  for (const lang of LOCALES) {
    const dir = path.join(__dirname, lang);
    fs.mkdirSync(dir, { recursive: true });
    const t = makeT(lang);
    fs.writeFileSync(path.join(dir, 'index.html'), renderLanding(lang, stats, locales, t));
    if (t.missing.size) {
      console.warn(`${lang}: ${t.missing.size} string(s) missing a translation (fell back to English):`);
      for (const s of t.missing) console.warn(`  - ${s.slice(0, 70)}`);
    }
  }
  fs.writeFileSync(path.join(__dirname, 'index.html'), renderStub('', 'Cronologia'));
  fs.mkdirSync(path.join(__dirname, 'chronology'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'chronology', 'index.html'), renderStub('chronology/', 'Master chronology — Cronologia'));
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), renderSitemap());
  // Project sites live under this apex domain but cannot serve the root
  // robots.txt themselves, so their sitemaps are declared here (#17).
  const projectSitemaps = GROUPS.flatMap((g) => g.cards.map((c) => `Sitemap: ${SITE}/${c.id}/sitemap.xml`));
  fs.writeFileSync(path.join(__dirname, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n${projectSitemaps.join('\n')}\n`);
  console.log(`Wrote {${LOCALES.join(',')}}/index.html, index.html (stub), sitemap.xml, robots.txt (stats: ${stats.events} events, ${stats.projects} projects).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
