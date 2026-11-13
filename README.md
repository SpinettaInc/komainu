# Komainu

![Komainu logo: a shield in two halves, one marked with a line and one with a dot](src/web/logo.svg)

[![CI](https://github.com/SpinettaInc/komainu/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/SpinettaInc/komainu/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)
[![Open issues](https://img.shields.io/github/issues/SpinettaInc/komainu)](https://github.com/SpinettaInc/komainu/issues)
[![Open pull requests](https://img.shields.io/github/issues-pr/SpinettaInc/komainu)](https://github.com/SpinettaInc/komainu/pulls)
[![Last commit](https://img.shields.io/github/last-commit/SpinettaInc/komainu)](https://github.com/SpinettaInc/komainu/commits/main)

[![JavaScript](https://img.shields.io/badge/JavaScript-no%20framework-F7DF1E?logo=javascript&logoColor=black)](src)
[![Dependencies: none](https://img.shields.io/badge/runtime%20dependencies-none-brightgreen)](package.json)
[![Node.js 18+](https://img.shields.io/badge/node-18%2B-5FA04E?logo=nodedotjs&logoColor=white)](package.json)
[![Static site](https://img.shields.io/badge/site-static%2C%20no%20server-informational)](public)
[![MCP 2026-07-28](https://img.shields.io/badge/MCP-2026--07--28-6E56CF)](src/cli/mcp.js)
[![Agent Skills](https://img.shields.io/badge/skill-Agent%20Skills-D97757)](src/skill/SKILL.md)
[![AGENTS.md](https://img.shields.io/badge/writes-AGENTS.md-000000)](src/core/generate.js)
[![Claude Code hook](https://img.shields.io/badge/enforces-Claude%20Code%20hook-D97757?logo=claude&logoColor=white)](src/core/generate.js)
[![ESLint](https://img.shields.io/badge/lint-ESLint-4B32C3?logo=eslint&logoColor=white)](eslint.config.mjs)
[![Stylelint](https://img.shields.io/badge/lint-Stylelint-263238?logo=stylelint&logoColor=white)](.stylelintrc.json)
[![markdownlint](https://img.shields.io/badge/lint-markdownlint-000000?logo=markdown&logoColor=white)](.markdownlint-cli2.jsonc)
[![html-validate](https://img.shields.io/badge/lint-html--validate-E34F26?logo=html5&logoColor=white)](.htmlvalidate.json)
[![Tests: node:test](https://img.shields.io/badge/tests-node%3Atest%20%2B%20jsdom-5FA04E?logo=nodedotjs&logoColor=white)](test)
[![Accessibility: axe-core](https://img.shields.io/badge/accessibility-axe--core-663399)](test/pages.test.mjs)

Build AI guardrails for your organization from your own policy. You pick the rules in a browser, copy one command, and run it on your machine.

```sh
curl -fsSLo komainu.mjs https://<your-site>/komainu.mjs
node komainu.mjs apply eyJ2IjoxLCJkb21haW5zIjpbImNvcmUiLCJjb2RpbmciXX0
```

The command writes the rule files your AI assistants read, a local hook that blocks what can be blocked, and a policy document for people.

Komainu is a static website and one JavaScript file. It has no server, no database and no account. The site stores nothing you enter and sends it nowhere: your choices are encoded in the command you copy.

## What is in the box

| Piece | What it is | Where |
|---|---|---|
| Landing page | What Komainu is, and the commands for the CLI, the MCP server and the skill | `public/index.html` |
| Quiz page | Opens a quiz from a link, with nothing to download | `public/quiz.html` |
| Templates | Browse the policy templates by role and by area, read every rule and download each as CSV | `public/templates.html` |
| Builder | A full-width editor. Areas on the left, the rules being edited in the middle, the command and the generated files on the right | `public/builder.html` |
| Offline builder | The builder as one HTML file that opens from disk | `public/komainu-standalone.html`, `public/komainu-standalone-ja.html` |
| Download all | On the builder's Files tab, one zip with every generated file in its folder | `src/core/zip.js` |
| Training quiz | A quiz on the selected rules as one HTML file, or as Markdown or CSV | builder "quiz" tab, templates page, `komainu quiz` |
| CLI | `init`, `apply`, `template`, `quiz`, `import`, `status`, `check`, `redact`, `export`, `catalog` | `public/komainu.mjs` |
| MCP server | `komainu mcp`: six read-only tools, two prompts and two resources over stdio | the same file |
| Agent skill | `komainu-guardrails` reads internal policy locally, maps clauses to rules and reports coverage | `public/skill/` |

The CLI, the MCP server and the skill installer are one file. It has no dependencies, makes no network requests and is not minified, so you can read it before you run it.

## What it generates

You choose the targets in the configuration.

| Target | Files |
|---|---|
| `agents` | `AGENTS.md` |
| `claude` | `CLAUDE.md`, and permission `deny` and `ask` rules in `.claude/settings.json` |
| `hooks` | `.claude/hooks/komainu-guard.mjs` |
| `cursor` | `.cursor/rules/komainu-guardrails.mdc` |
| `copilot` | `.github/copilot-instructions.md` |
| `gemini` | `GEMINI.md` |
| `windsurf` | `.windsurf/rules/komainu-guardrails.md` |
| `policy` | `docs/ai-guardrails/ai-acceptable-use-policy.md` |
| `assistants` | `docs/ai-guardrails/assistant-instructions/*.md`, one per department |
| `mcp` | `.mcp.json` and a copy of the CLI in `.komainu/` |

`komainu.json` is always written. It holds the configuration, and `apply` and `status` read it.

In Markdown files that you also edit, Komainu owns one marked block and leaves the rest alone. JSON settings are merged. The offline installer script never overwrites an existing file.

The catalog has 185 rules in 18 areas. Twelve follow teams and functions: universal, coding, security, data and privacy, agents, communication, HR, sales, marketing, customer support, legal and finance. Six follow roles and sectors: governance and accountability, AI product teams, IT and security controls, public services, health and care, and education. You add your own rules next to them.

## How each rule is upheld

Every rule carries one of three labels, in the builder and in the generated policy.

| Label | Meaning |
|---|---|
| Enforced | A local hook or permission rule checks it before the action happens |
| Instructed | The rule is loaded into the assistant. Nothing checks that it was followed |
| Attested | An organizational process that a named person confirms |

With the default configuration, 6 of 35 rules are enforced.

## Observe mode

Blocking on the first day can stop work for reasons nobody has looked at yet. In observe mode the hook stops nothing. It appends one line per finding to `.komainu/observed.jsonl` on the machine, so a team can see what would be stopped before turning blocking on.

```sh
node komainu.mjs apply --observe     # the hook records and lets everything through
node komainu.mjs report              # counts per rule or kind of data; --json for a script
node komainu.mjs apply --enforce     # turn blocking on
```

Each line holds the time, the event, the tool, the rule or kind of data, and whether the hook would have blocked or asked. It never holds the prompt, the command, the file path or the value that was found. The file is listed in `.komainu/.gitignore` and stays on the machine that wrote it. The builder has the same switch under Organization.

Observe mode changes the hook only. Claude Code permission rules in `.claude/settings.json` still apply, and the generated policy says that the hook is not enforcing yet.

## Policy templates

A policy template is the list of rules for a role or an area, as a CSV file. The policy owner edits it in a spreadsheet and imports it again.

```sh
node komainu.mjs template --list
node komainu.mjs template governance > policy.csv
# edit policy.csv
node komainu.mjs import policy.csv
node komainu.mjs apply
```

The templates page lists every template with its rules, and the builder offers the same files under "Templates and import". There are 11 role templates, such as AI governance lead, AI product team, IT and security administrators, public sector, health or care provider and school or university, and one template for each area.

| What you do to a row | What the import does |
|---|---|
| Leave it alone | The catalog rule stays on |
| Change the wording, the level or the area | The catalog rule is switched off and your version becomes one of your rules |
| Delete it | The catalog rule is switched off |
| Add a row with no `id` | It becomes one of your rules |

Importing the same template again replaces your earlier edits of the same rows.

## Training quiz

Komainu turns the rules you selected into a quiz to share with your team.

```sh
node komainu.mjs quiz > quiz.html                      # 10 questions on the rules in komainu.json
node komainu.mjs quiz --count 20 --area hr > hr.html   # one area
node komainu.mjs quiz --format md > quiz.md            # for printing or a wiki
node komainu.mjs quiz --format csv > quiz.csv          # one row per question
node komainu.mjs quiz --seed week-2 > quiz2.html       # a different draw
node komainu.mjs quiz --url https://<your-site>        # a link that opens the quiz
```

The builder's "quiz" tab and the "Download quiz" button on the templates page make the same files.

There is also a direct link. The builder's quiz tab shows it, the templates page has "Take the quiz" for each template, and `--url` prints it. The link opens `quiz.html` with the rules in the part of the address after the `#`, which browsers do not send to servers. Sensitive names, the approved-tools list and the local route are left out of the link. A configuration with many rules of your own makes a long link; the file is the better choice then.

The HTML file works on its own, from a shared drive or an email attachment. People choose an answer for each question, check them, and read the reason behind every answer. The file records nothing and makes no network requests.

About 46 rules have a written situation, such as "a coding agent asks to read the .env file". The other questions are generated from the rule text: which statement a rule is, whether it is a MUST or a SHOULD, and how it is upheld. Your own rules get the generated kinds. The same configuration and seed always give the same quiz.

## Languages

The website, the builder, the templates and the quiz are in English and in Japanese. The Japanese pages are under `/ja/`.

The generated files have their own language setting, so a Japanese team can run the English site and still get Japanese files:

```sh
node komainu.mjs apply --lang ja             # write the files in Japanese and save the choice in komainu.json
node komainu.mjs template governance --lang ja > policy.csv
node komainu.mjs quiz --lang ja > quiz.html
```

All 185 rules, the area and template names, the policy document, the assistant packs, the agent prompt and the 46 quiz situations are translated. Column names in CSV files stay in English, and an import understands Japanese area names and the levels 必須 and 推奨. The messages the CLI and the hook print in a terminal, the MCP tool descriptions and the agent skill are in English only.

The Japanese pages are built from the English ones: `scripts/ja-pages.mjs` holds the wording, and the build stops when a fragment no longer matches. Interface strings are in `src/web/ui.js`, and the catalog is in `src/core/ja-catalog.js` and `src/core/ja-scenarios.js`.

## Importing your own rules

The builder's "Import CSV / JSON" section and `komainu import <file>` read rules you already keep. In the browser the file is parsed in the tab and is not uploaded.

```csv
rule,level,area,source
"Get approval from the People team before using AI on performance data.",must,HR,AI Policy 5.2
"Prefer the internal style guide over the assistant's default tone.",should,Marketing,Brand Guide 2
```

- Only `rule` is required. Common header names such as `requirement`, `severity`, `department` and `clause` are understood, with comma, semicolon or tab separators.
- JSON can be a list of strings or objects, an object with a `rules` list, or lists keyed by area.
- With no `level`, the wording decides. "Should", "prefer" and "where possible" give SHOULD. Everything else gives MUST.
- Area names such as "People", "Engineering" and "Customer service" are mapped to the 18 areas. Unknown names go to the area you choose.
- Empty rows, duplicates and anything past 300 rules are skipped and listed with their row numbers. You see a preview before anything is added.

Imported rules are instructed. They are loaded into the assistant and nothing checks them.

## Research

Sources were checked in November 2026.

The rules point to NIST AI RMF 1.0 with its Generative AI Profile, ISO/IEC 42001, the EU AI Act, GDPR, the OWASP Top 10 for LLM Applications (2026 edition) and the OWASP Top 10 for Agentic Applications (2026). The references help a reviewer find the relevant text. They are not a claim of compliance.

`AGENTS.md` is the instruction file most coding agents read. Claude Code, Cursor, Copilot, Gemini CLI and Windsurf each also have a file of their own. Agent Skills are folders with a `SKILL.md`. The current MCP revision is 2026-07-28, which drops the `initialize` handshake for per-request metadata and `server/discover`. The server here answers both forms.

| Kind of tool | Examples | What it leaves open |
|---|---|---|
| Runtime guardrails and gateways | OpenGuardrails, NeMo Guardrails, Lakera, Llama Guard | Needs infrastructure and engineers. Does not cover how staff use assistants |
| Policy document generators | Several hosted AI-policy generators | No assistant reads the document. A hosted form receives the answers |
| Rule-sync tools | Ruler, rulesync | Copies rules you already wrote. Coding only |
| Policy-as-code for coding agents | Cupcake, Chock | Written by engineers. Coding only |
| Session-mining skills | guardrail-builder | Extracts coding conventions from past sessions, for one agent |

We found no tool that starts from an organization's written policy, covers non-engineering departments and installs the result into the assistants people already use without a server. Komainu does that, and three of its features come from that gap: the coverage labels, the department instruction packs, and the skill's report that maps each policy clause to a rule.

## Tech stack

| Choice | Reason |
|---|---|
| Plain HTML, CSS and JavaScript with no framework | The whole page is small enough to read and audit |
| One shared core in `src/core` for the web, the CLI, the MCP server and the skill | The browser preview and the files written to disk come from the same code |
| esbuild as the only build dependency | It bundles the core into the pages and into the single-file CLI |
| A hand-written MCP server over stdio | The CLI stays one file with no SDK |
| A content security policy with `connect-src 'none'` | The browser itself refuses any network request from the page |
| State in memory and in the URL fragment | Browsers do not send the fragment to servers, and nothing is written to browser storage |
| Self-hosted fonts | No request goes to a font CDN |
| The landing page uses the veil-website stylesheet | `src/web/site.css` is that file with Komainu's turquoise accent |

## Accessibility

The pages are checked against WCAG 2.2 AA in three ways. The test suite runs axe-core on every page, every builder view and every output tab. Colour contrast, which needs real layout, was measured in Chrome on every text element and passes at 4.5:1. The keyboard path was walked by hand: a skip link, one tab stop for each tab list with arrow keys inside it, a visible focus ring, and focus moved to the heading when the builder changes view.

## Name and logo

Komainu are the paired guardian dogs at the gates of Japanese shrines. One has its mouth open and one has it closed. The logo is a shield in two halves, one for each guardian. The line stands for the open mouth and the dot for the closed one. Together the two sounds, "a" and "un", mean the beginning and the end.

## Develop

You need Node.js 18 or later.

```sh
npm install
npm run check        # lint, build, tests
npm test             # build public/ and run the tests
npm run lint         # ESLint, Stylelint, markdownlint, html-validate, prose check
npm run coverage     # tests with a coverage report for src/core
npm run serve        # http://localhost:4173
```

| Path | Contents |
|---|---|
| `src/core/` | Catalog, configuration, generators, detectors, command builders, policy templates, rule import, quiz, zip |
| `src/cli/` | CLI and MCP server |
| `src/skill/` | The agent skill and its references |
| `src/web/` | Landing page (`index.html`, `site.js`), templates page (`templates.html`, `templates.js`), both styled by `site.css`, and the builder (`builder.html`, `styles.css`, `builder.js`). `dom.js` is shared |
| `scripts/` | `build.mjs` builds `public/`. `lint-prose.mjs` checks the writing |
| `test/` | `node:test` suites, more than 1,000 tests. The page tests drive the built pages in jsdom and run axe-core on them |
| `public/` | The document root to deploy. It holds only the built static files |

To add a rule, add one line to `RULES` in `src/core/catalog.js`. The builder, the CLI, the MCP server and the skill's catalog reference all pick it up.

## Publish

Point the web server at `public/` and at nothing above it, or upload `public/` to any static host. The folder holds only the built static files, so the source, the tests and `.git` are never served. `public/_headers` sets the security headers on hosts that read that file, such as Cloudflare Pages and Netlify. On other hosts the `<meta>` tag in each page applies the same policy. The commands shown on the pages use the address the page is served from.

## Limits

- The enforcement hook works in Claude Code only. Other assistants receive the rules as instructions.
- Detection is pattern-based. It catches common credential, card and bank-account formats and misses others. For names and other personal data in prompts, use [Veil](https://github.com/SpinettaInc/veil).
- Instructed and attested rules are not technical controls.
- The generated policy is a starting point. It is not legal advice.
- Sensitive names are stored in `komainu.json` and in the generated hook. Do not list a name there if the repository is shared with people who must not see it.

## Related

[Veil](https://github.com/SpinettaInc/veil) is our Python library that replaces personal data in a prompt with tokens before the text leaves your machine, and restores it in the reply. Komainu sets the rules and Veil removes the data, so the two work well together.

## License

Komainu is free software under the GNU General Public License, version 3 or later. See [LICENSE](LICENSE).
