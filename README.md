# Cronologia

**Open, source-referenced chronologies of contested subjects in Latin American
political and religious history** — published as small, fast, dependency-free
static websites at [cronologia.github.io](https://cronologia.github.io).

This repository is the **portal**: the landing page for the project family and
the home of the **roadmap** (see the issues) for new chronologies.

## What Cronologia is

Each Cronologia project takes one subject whose history is politically or
religiously contested — an organization, a movement, an event — and builds a
**chronology you can check**: every fact cited to a public source, every
uncertain date flagged, every contested characterization attributed to its
author instead of asserted in the site's own voice.

The subjects are chosen precisely because they are argued about. The premise is
that on contested ground, **a verifiable timeline is more useful than another
opinion**: readers from any side of the argument should be able to use the same
page and check the same sources.

## Goals

1. **Verifiability over completeness.** A smaller dataset where every entry is
   cited beats a larger one that must be taken on faith. Uncertain dates carry
   a visible `?` flag; unverified claims are labeled, never silently included.
2. **Neutrality by attribution.** Contested characterizations ("schismatic",
   "rehabilitated", "front organization") are always attributed — *who* says
   so, *when* — with sources spanning the spectrum by design: official,
   sympathetic, independent, and critical, each labeled for perspective.
3. **Durable evidence.** Links rot and official pages change. References are
   preserved in the Internet Archive's Wayback Machine, and volatile documents
   are vaulted as committed copies, so a citation made today remains checkable
   in ten years.
4. **Radical simplicity.** Every site is a single JSON dataset compiled to
   plain HTML by a zero-dependency Node script, tested and validated in CI,
   and served by GitHub Pages. No frameworks, no build chains, no databases —
   nothing that will be unbuildable in five years.
5. **Open correction.** Every fact is in a public JSON file in a public repo.
   Corrections against primary sources are welcome as issues or pull requests
   in any project.

## The projects

| Project | Subject | Site |
| --- | --- | --- |
| [`fsp`](https://github.com/cronologia/fsp) | **Foro de São Paulo** — the conference of Latin American left-wing parties, founded 1990 | [/fsp/](https://cronologia.github.io/fsp/) |
| [`fsspx`](https://github.com/cronologia/fsspx) | **Fraternidade Sacerdotal São Pio X** — the traditionalist priestly society founded by Marcel Lefebvre, 1970 | [/fsspx/](https://cronologia.github.io/fsspx/) |
| [`tl`](https://github.com/cronologia/tl) | **Teologia da Libertação** — the Latin American theological movement, 1968– | [/tl/](https://cronologia.github.io/tl/) |

The three form two threads that cross in Brazil: the **Latin American left**
(fsp, fed by the church base communities documented in tl) and **Catholicism
after Vatican II** (tl on one side, fsspx on the other). Candidate projects to
extend those threads — Vatican II, the PT, the Grupo de Puebla, CELAM, the TFP
and more — are tracked as issues in this repository.

## Architecture (shared by all projects)

```
data/*.json      SOURCE OF TRUTH — hand-edited, schema-validated, every fact cited
build.js         zero-dependency compiler: data → static HTML in docs/
scripts/         validator + preservation tooling (Wayback archiving, document vault)
test/            node:test suites — data invariants, render checks, docs drift
docs/            compiled output, committed, served by GitHub Pages
AGENTS.md        how humans and AI agents work in the repo (sourcing rules)
context.md       domain background for contributors
```

The `fsp` project is the reference implementation — its Architecture Decision
Records ([`fsp/docs/adrs/`](https://github.com/cronologia/fsp/tree/master/docs/adrs))
explain *why* things are built this way. The younger projects mirror it;
extracting the duplicated toolkit into a shared template is on the roadmap here.

## Contributing

Pick a project, read its `AGENTS.md` and `context.md`, and open an issue or PR.
The one rule that governs everything: **cite it, or flag it as unverified.**

## License

MIT — see each repository.
