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

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NUMBER_WORDS = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'],
  es: ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce'],
  pt: ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze'],
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
      { id: 'fsspx', cls: 'p-fsspx', years: '1970–present', title: 'Fraternidade Sacerdotal São Pio X', desc: 'The traditionalist priestly society founded by Marcel Lefebvre and its relationship with the Holy See — from Écône 1988 to the 2026 rupture, with the full episcopal genealogy of the traditionalist lines.' },
      { id: 'tfp', cls: 'p-tfp', years: '1908–present', title: 'TFP / Plinio Corrêa de Oliveira', desc: "The lay traditionalist movement founded in 1960 — the campaigns, the 1985 CNBB note, the succession dispute, and the two branches of today: the Heralds of the Gospel and the IPCO." },
      { id: 'rcc', cls: 'p-rcc', years: '1967–present', title: 'Renovação Carismática Católica', desc: "The Catholic Charismatic Renewal from the 1967 Duquesne Weekend to CHARIS — with the Brazilian movement: Rahm and Dougherty, Canção Nova, Shalom, the CNBB's 1994 guidelines and the media wave." },
      { id: 'tl', cls: 'p-tl', years: '1960s–present', title: 'Teologia da Libertação', desc: 'The Latin American theological movement — Medellín, Gutiérrez, the Vatican instructions, the martyrs and the later reception — with a map of where its story happened.' },
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
      { id: 'perennialism', cls: 'p-peren', years: '1921–present', title: 'Perennialism', desc: "The Traditionalist School as a movement of ideas — Guénon's corpus, the journals, Evola's political adaptation and its receptions, and the academic institutionalization of the perennial philosophy." },
    ],
  },
  {
    heading: 'Intellectual biographies',
    desc: 'Chronologies of individual authors whose trajectories cross several of the other projects — documented as lives and works, with contested characterizations attributed, never adjudicated.',
    cards: [
      { id: 'olavo', cls: 'p-olavo', years: '1947–2022', title: 'Olavo de Carvalho', desc: 'Journalist, astrologer, self-taught philosopher and central reference of the Brazilian New Right — his life and works, and reception pages for the philosophers his 585-lecture course engaged most.' },
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
  metaDesc: 'Open, source-referenced chronologies of contested subjects in Latin American political and religious history — ten projects covering movements and institutions of the Catholic Church, the Latin American left, the Traditionalist School, and the intellectuals between them. Every fact cited to a public source.',
  subtitle: 'Source-referenced chronologies of contested subjects',
  lead: 'Timelines of organizations and movements in Latin American political and religious history — every fact cited to a public source, every uncertain date flagged, every contested claim attributed to its author. On argued-about ground, a verifiable timeline is more useful than another opinion.',
  masterStrong: '⏳ Master chronology →',
  masterSpan: 'All {events} events of the {projects} projects on one filterable timeline — see the intersections side by side.',
  glossaryStrong: '📖 Shared glossary →',
  glossarySpan: 'Cited definitions of the recurring terms, one page per term, so every chronology links to the same stable explanation instead of redefining it.',
  groupingStrong: 'Ten chronologies, grouped by subject area.',
  groupingNote: 'The groups below are a navigational aid, not a claim about the subjects. Projects listed together are not thereby asserted to share a programme, an alliance, an origin or an identity — several of them are opposed to each other, and the datasets document that with sources. Each chronology stands on its own.',
  howHeading: 'How these sites work',
  nextHeading: "What's next",
  roadmap: 'Candidate chronologies — the Partido dos Trabalhadores, the Fórum Social Mundial, the Brazilian New Right and more — are tracked as issues in the {link}. Suggestions welcome.',
  roadmapLink: 'portal repository',
  footer: "Cronologia — open data on {gh}. MIT licensed. Each chronology's dataset lives in its own public repository.",
  langLabel: 'Language',
  disclaimer: { es: '🌐 Traducción automática del inglés; la página en inglés es la versión de referencia.', pt: '🌐 Tradução automática do inglês; a página em inglês é a versão de referência.' },
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
  const disclaimer = lang === 'en' ? '' : `\n  <div class="i18n-disclaimer" role="note">${S.disclaimer[lang]}</div>`;

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
  fs.writeFileSync(path.join(__dirname, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`Wrote {${LOCALES.join(',')}}/index.html, index.html (stub), sitemap.xml, robots.txt (stats: ${stats.events} events, ${stats.projects} projects).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
