# Changelog

## 0.1.0

First release.

### Website

- Landing page, in the same style as the other Spinetta product sites.
- Builder: a full-width editor with the areas on the left, the rules being edited in the middle and the output on the right.
- Templates page: every policy template with its rules, a CSV download and a quiz.
- Quiz page: opens a training quiz from a link.
- Every page is also in Japanese, under `/ja/`, with a link between the two languages.
- The site is static. It has no server and no database, it stores nothing, and its content security policy stops the pages from making network requests.

### Rules

- 185 rules in 18 areas, each marked MUST or SHOULD and each labelled enforced, instructed or attested.
- 11 role templates and 18 area templates.
- Import of your own rules from CSV or JSON, and the round trip for a downloaded template: unchanged rows stay catalog rules, edited rows become your rules, deleted rows are switched off.

### Output

- Rule files for AGENTS.md, Claude Code, Cursor, GitHub Copilot, Gemini CLI and Windsurf.
- Claude Code permission rules and a local hook that blocks credentials, card numbers, IBANs, sensitive names, reads of secret files and dangerous commands.
- Observe mode for the hook: it stops nothing and records what it would have stopped in a local file, without the content, so a team can check the counts with `komainu report` before turning blocking on.
- An AI acceptable-use policy for people, and one instruction pack per department for chat assistants.
- One command, an offline installer for bash and PowerShell, a prompt for a coding agent, a share link, and a zip of every generated file.
- A training quiz as a self-contained HTML file, as Markdown, as CSV or as a link.
- Everything above can be written in English or in Japanese. The rule catalog, the templates and the quiz questions are translated in full. The language is a setting in `komainu.json`, chosen in the builder or with `--lang`.

### Tools

- `komainu.mjs`: one JavaScript file with no dependencies that is the CLI, the MCP server and the skill installer.
- CLI commands: `init`, `apply`, `status`, `report`, `check`, `redact`, `template`, `import`, `quiz`, `export`, `catalog`, `skill install`, `mcp`.
- MCP server over stdio with six read-only tools. It speaks the 2026-07-28 revision and the earlier handshake.
- The `komainu-guardrails` agent skill, which maps an organization's policy documents to rules and reports the gaps.

### Quality

- More than 1,000 tests, with 100% line coverage of the shared core.
- Tests hold the Japanese catalog, interface wording and pages to the English ones: every rule, scenario and interface string has a translation with the same placeholders.
- ESLint, Stylelint, markdownlint, html-validate and a prose check.
- axe-core runs on every page, every builder view and the quiz file.
