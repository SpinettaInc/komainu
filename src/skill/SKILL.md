---
name: komainu-guardrails
description: Builds, tailors and maintains AI guardrails for an organization from its own internal policies. Produces AGENTS.md and CLAUDE.md rules, Cursor, Copilot, Gemini and Windsurf rule files, Claude Code permission rules and a local enforcement hook, paste-in instruction packs for chat assistants, and a human-readable AI acceptable-use policy with a coverage report. Use when asked to create, update, review or audit AI guardrails, AI rules, an AI usage or acceptable-use policy, or AI safety rules for coding, security, data privacy, agents, communication, HR, sales, marketing, customer support, legal or finance. Runs entirely on the local machine.
license: GPL-3.0-or-later
compatibility: Needs Node.js 18 or newer for scripts/komainu.mjs. No network access required.
metadata:
  version: "0.1.0"
---

# Komainu guardrails

Turn an organization's written policies into guardrails that AI assistants load, and that are enforced locally where a check is possible.

`scripts/komainu.mjs` does the mechanical work. It is bundled with this skill, has no dependencies and makes no network requests. Your part is what a script cannot do: read the organization's policies, map them to rules, find the gaps and explain the result.

In the commands below, `komainu` means `node <this skill's folder>/scripts/komainu.mjs`.

## Ground rules

- Policy documents stay local. Read them from disk. Do not upload, paste or fetch them to any other service. Do not quote long passages into generated files; cite the clause, for example "Security Policy §4.2".
- Check the classification first. If a policy document is marked above the level this model is approved for, stop and tell the user before reading further.
- Do not invent a policy. A rule goes in because the organization's policy says so, because the user chose it from the catalog, or because the user approved your suggestion. Say which of your proposals are suggestions.
- Write nothing without approval. Show the plan and a dry run, then wait.
- This is not legal advice. Say so once in your final summary, and recommend review by the legal, security and privacy owners.

## Workflow

### 1. Look at what exists

Run `komainu status` in the target folder. If `komainu.json` exists you are updating: read it and keep the user's earlier choices. Also look for an existing `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md` and any policy folder (`docs/policies`, `policies`, `handbook`, `compliance`).

### 2. Ask, briefly

Ask only what you cannot find, in one round:

1. Where are the internal policies? (paths to files or folders)
2. Which teams use AI? (these map to areas; see `references/catalog.md`)
3. Which AI tools are approved, and who owns AI questions and incidents? (a role or channel, not a personal email)
4. What are the data classification levels, which is the highest allowed in hosted AI tools, and what is the route for anything higher?
5. Which names must never reach an AI tool? (clients, codenames; these become locally enforced sensitive terms)
6. Which assistants need the rules? (these map to targets)

If the organization already keeps its rules in a spreadsheet, export it as CSV and run `komainu import rules.csv --dry-run`. The columns are `rule`, `level`, `area` and `source`, and only `rule` is required.

If the policy owner prefers to edit a list, give them a template. `komainu template --list` shows one per role and one per area, and `komainu template <id> > policy.csv` writes it. They edit the wording, delete rows and add rows. `komainu import policy.csv` then keeps the unchanged rows as catalog rules and turns each edited row into a custom rule.

### 3. Map policy to rules

Read `references/mapping.md` and follow it. For each policy clause that concerns AI use, data handling, security, communication or conduct, decide what it becomes: an existing catalog rule (`references/catalog.md`), a parameter (tools, levels, contact, terms), a custom rule that cites the clause, or nothing because it is out of scope. Record every decision as you go. The record becomes the coverage report.

Watch for contradictions between the policy and the catalog defaults, such as a policy that allows something a default rule forbids. The policy wins: turn the rule off and add a custom rule with the policy's wording.

### 4. Draft the configuration

Write the draft as JSON following `references/config.md`. Preview it without touching the disk:

```sh
komainu apply draft.json --dry-run
```

Show the user the rule count, the files that would be written, the coverage table and the open questions. Wait for approval.

### 5. Apply and verify

```sh
komainu apply draft.json
komainu status
komainu check --staged     # optional: confirm no secrets are about to be committed
```

`apply` replaces only its own managed block in Markdown files, merges JSON settings and leaves everything else alone. Delete the draft file afterwards. `komainu.json` is now the source of truth.

### 6. Report

Finish with these five parts:

1. What was installed: the files written and the rule counts by area.
2. The coverage table: policy clause, rule id, and whether the rule is enforced, instructed or attested.
3. The gaps: clauses that could not be turned into a rule, and catalog rules you recommend that the policy is silent on.
4. The rules that depend on people: each attested rule needs a named owner.
5. Next steps: commit the files, have the policy document reviewed, and set a date for the next review.

## Coverage levels

Report what each rule does in practice:

| Level | Meaning |
|---|---|
| Enforced | A local hook or permission rule checks it before the action happens. |
| Instructed | The assistant is told the rule and follows it. Nothing checks. |
| Attested | An organizational process that a person must confirm. |

Do not describe an instructed or attested rule as a technical control.

## Other tasks

| Task | Command |
|---|---|
| Update after a policy change | Edit `komainu.json`, run `komainu apply`, report the difference. |
| Audit a workspace | `komainu status` finds drift. `komainu check <files>` finds leaks. |
| Try the hook before it blocks | `komainu apply --observe` makes the hook record what it would stop, without the content, and stop nothing. `komainu report` shows the counts and `komainu apply --enforce` turns blocking on. |
| Sanitize text before sharing it | Pipe it through `komainu redact`. |
| Train the team on the rules | `komainu quiz > quiz.html` writes a self-contained quiz. `--area`, `--count` and `--format md` or `csv` narrow or reshape it. |
| Roll out to non-technical teams | Add the `assistants` target. It writes one paste-in instruction pack per department under `docs/ai-guardrails/assistant-instructions/`. |
| Offer the guardrails to agents as tools | Add the `mcp` target, or register `komainu mcp` as an MCP server. |
