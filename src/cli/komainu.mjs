// Komainu CLI: one file, zero dependencies, no network access.
// Also the MCP server (`komainu mcp`) and the skill installer.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { VERSION, DOMAINS, STRICTNESS, TARGETS, PRESETS, COVERAGE } from '../core/catalog.js';
import { normalize, decode, encode, compact, stats, activeRules, DEFAULT_CONFIG } from '../core/config.js';
import { generate, mergeBlock, mergeJson } from '../core/generate.js';
import { bashScript, powershellScript, agentPrompt } from '../core/commands.js';
import { detectorsFor, scanText } from '../core/detectors.js';
import { catalogMarkdown } from '../core/docs.js';
import { parseRules, applyImport } from '../core/import.js';
import { policyTemplates, templateCsv } from '../core/templates.js';
import { LANGS } from '../core/i18n.js';
import { buildQuiz, quizLink, QUIZ_FORMATS } from '../core/quiz.js';
import { createServer, serveStdio } from './mcp.js';

import SKILL_MD from '../skill/SKILL.md';
import SKILL_MAPPING from '../skill/references/mapping.md';
import SKILL_CONFIG from '../skill/references/config.md';

const HELP = `komainu ${VERSION}: build AI guardrails for your organization. Runs locally and sends nothing anywhere.

Usage: node komainu.mjs <command> [options]

  init                      Interactive wizard: answer a few questions, get guardrails
  apply [config]            Write guardrail files. <config> is a token from the web builder,
                            a JSON file, or omitted to use ./komainu.json
  template [id] [--list]    Print a policy template as CSV: edit it in a spreadsheet, then import it
  quiz [--format html|md|csv] [--count 10] [--area <id>] [--seed <text>]
                            Print a training quiz made from the rules in komainu.json
        --url <site>        …print a link that opens the quiz on that site instead
  import <file.csv|.json>   Add your own rules from a CSV or JSON file to komainu.json
        --area <id>         …area for rules that name none (default: core)
  status                    Check that installed files still match komainu.json (exit 1 on drift)
  check [files…]            Scan files for secrets, personal data and sensitive terms
        --staged            …scan files staged in git (use as a pre-commit hook)
        --stdin             …scan standard input
  redact                    Read stdin, write it back with sensitive values replaced
  export <sh|ps1|json|token|prompt>
                            Print a self-contained installer, the config, or an agent prompt
  catalog [--json]          Print every available rule
  skill install [--global] [--agents]
                            Install the komainu-guardrails agent skill
                            (.claude/skills by default, .agents/skills with --agents)
  mcp                       Run the MCP server on stdio

Options: --dir <path> (default: current directory)   --dry-run   --help   --version
         --lang <en|ja>      Language of the generated files, templates and quizzes.
                             With apply or init it is saved in komainu.json.
`;

const SELF = (() => { try { const p = fileURLToPath(import.meta.url); return fs.statSync(p).isFile() ? p : null; } catch { return null; } })();

function parseArgs(argv) {
    const flags = {};
    const pos = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (['--dir', '--area', '--format', '--count', '--seed', '--url', '--lang', '-f'].includes(a)) flags[a === '-f' ? 'file' : a.slice(2)] = argv[++i];
        else if (a.startsWith('--')) flags[a.slice(2)] = true;
        else pos.push(a);
    }
    return { flags, pos };
}

const die = (msg) => { process.stderr.write(`komainu: ${msg}\n`); process.exit(1); };
const readIf = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };

// Set by --lang. It overrides the language a configuration was saved with.
let langFlag;
const inLang = (cfg) => (langFlag ? normalize({ ...cfg, lang: langFlag }) : cfg);

function loadConfig(dir, source) {
    if (source) {
        const asFile = readIf(path.resolve(source));
        return inLang(decode(asFile ?? source));
    }
    const local = readIf(path.join(dir, 'komainu.json'));
    if (local === null) return null;
    return inLang(decode(local));
}

/** What applying `file` would produce on disk: { next, state } */
function plan(dir, file) {
    const abs = path.join(dir, file.path);
    const existing = readIf(abs);
    if (file.mode === 'self') {
        if (!SELF) return { state: 'manual', note: 'copy komainu.mjs here by hand (the CLI was not run from a file)' };
        const next = fs.readFileSync(SELF, 'utf8');
        return { next, state: existing === next ? 'same' : existing === null ? 'new' : 'update' };
    }
    let next = file.content;
    if (file.mode === 'block') next = mergeBlock(existing, file.content);
    if (file.mode === 'json' && existing !== null) {
        let parsed;
        try { parsed = JSON.parse(existing); } catch { return { state: 'manual', note: 'existing file is not valid JSON; merge by hand', side: file.content }; }
        next = JSON.stringify(mergeJson(parsed, JSON.parse(file.content)), null, 2) + '\n';
    }
    return { next, state: existing === next ? 'same' : existing === null ? 'new' : 'update' };
}

function summary(cfg) {
    const s = stats(cfg);
    return `${s.total} rules across ${cfg.domains.length} domains (${s.must} MUST, ${s.should} SHOULD): ${s.enforced} enforced, ${s.instructed} instructed, ${s.attested} attested`;
}

function apply(dir, cfg, { dryRun } = {}) {
    const label = { new: 'create', update: 'update', same: 'ok    ', manual: 'MANUAL' };
    for (const file of generate(cfg)) {
        const p = plan(dir, file);
        console.log(`  ${label[p.state]}  ${file.path}${p.note ? `  (${p.note})` : ''}`);
        if (dryRun || p.state === 'same') continue;
        const abs = path.join(dir, file.path);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        if (p.state === 'manual') { if (p.side) fs.writeFileSync(abs + '.komainu-new', p.side); continue; }
        fs.writeFileSync(abs, p.next);
        if (file.exec) fs.chmodSync(abs, 0o755);
    }
    console.log(`\n${dryRun ? 'Dry run, nothing written. ' : ''}${summary(cfg)}.`);
    if (!dryRun) console.log('Review the files and commit them. Re-run `komainu apply` after editing komainu.json; `komainu status` detects drift.');
}

function status(dir) {
    const cfg = loadConfig(dir) || die(`no komainu.json in ${dir}; run \`komainu init\` or \`komainu apply <config>\` first`);
    let drift = 0;
    for (const file of generate(cfg)) {
        const p = plan(dir, file);
        const ok = p.state === 'same';
        if (!ok) drift++;
        console.log(`  ${ok ? 'ok   ' : 'DRIFT'}  ${file.path}${ok ? '' : `  (${p.state === 'new' ? 'missing' : p.note || 'differs from komainu.json'})`}`);
    }
    console.log(`\n${summary(cfg)}.`);
    if (drift) { console.log(`${drift} file(s) out of date. Run \`komainu apply\` to fix.`); process.exit(1); }
    console.log('Guardrails are in place and match komainu.json.');
}

function check(dir, files, flags) {
    const cfg = loadConfig(dir) || normalize({});
    const detectors = detectorsFor(cfg.redact);
    const scan = (name, text) => scanText(text, detectors, cfg.terms).findings.map((f) => `${name}:${f.line}  ${f.name} → ${f.placeholder}`);
    let out = [];
    if (flags.stdin) out = scan('stdin', fs.readFileSync(0, 'utf8'));
    else {
        if (flags.staged) files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'], { cwd: dir, encoding: 'utf8' }).split('\0').filter(Boolean);
        if (!files.length) die('nothing to check: pass files, --staged or --stdin');
        for (const f of files) {
            const abs = path.resolve(dir, f);
            let st;
            try { st = fs.statSync(abs); } catch { continue; }
            if (!st.isFile() || st.size > 2_000_000 || /(^|\/)(komainu\.json|komainu-guard\.mjs|komainu\.mjs)$/.test(f)) continue;
            const text = fs.readFileSync(abs, 'utf8');
            if (text.includes('\u0000')) continue;
            out.push(...scan(f, text));
        }
    }
    if (!out.length) { console.log('OK: no secrets, personal data or sensitive terms found.'); return; }
    console.log(out.join('\n'));
    console.log(`\n${out.length} finding(s). Replace each value with the placeholder shown, or pipe text through \`komainu redact\`.`);
    process.exit(1);
}

function importRules(dir, file, flags) {
    if (!file) die('usage: komainu import <file.csv|file.json> [--area <id>] [--dry-run]');
    const text = readIf(path.resolve(file)) ?? readIf(path.resolve(dir, file)) ?? die(`cannot read ${file}`);
    const cfg = loadConfig(dir) || normalize({});
    const fallback = DOMAINS.some((d) => d.id === flags.area) ? flags.area : 'core';
    const res = parseRules(text, { name: file, fallback, existing: cfg.custom, lang: cfg.lang });
    const byArea = {};
    for (const r of res.rules) byArea[r.d] = (byArea[r.d] || 0) + 1;
    console.log(`Read ${res.rules.length} rule(s) from ${path.basename(file)}${res.format ? ` (${res.format.toUpperCase()})` : ''}.`);
    for (const [d, n] of Object.entries(byArea)) console.log(`  ${String(n).padStart(4)}  ${DOMAINS.find((x) => x.id === d).name}`);
    for (const s of res.skipped) console.log(`  skipped row ${s.row}: ${s.reason}`);
    for (const n of res.notes) console.log(`  note: ${n}`);
    if (!res.rules.length && !res.on.length) process.exit(1);
    if (flags['dry-run']) return console.log('\nDry run, komainu.json not changed.');
    const next = normalize(applyImport(cfg, res));
    fs.writeFileSync(path.join(dir, 'komainu.json'), JSON.stringify(compact(next), null, 4) + '\n');
    console.log(`\nkomainu.json now has ${next.custom.length} rule(s) of your own. Run \`komainu apply\` to install them.`);
}

function template(id, flags) {
    const all = policyTemplates(langFlag);
    if (flags.list || !id) {
        console.log('Policy templates. Save one with: komainu template <id> > policy.csv\n');
        for (const t of all) console.log(`  ${t.id.padEnd(20)} ${t.name}: ${t.blurb}`);
        return;
    }
    const csv = templateCsv(id, langFlag) ?? die(`unknown template "${id}". Run \`komainu template --list\`.`);
    process.stdout.write(csv);
}

function quiz(dir, source, flags) {
    const cfg = loadConfig(dir, source) || inLang(normalize({}));
    const format = QUIZ_FORMATS[flags.format || 'html'] ?? die('quiz format must be one of: html, md, csv');
    const count = Math.min(100, Math.max(1, parseInt(flags.count, 10) || 10));
    if (flags.area && !DOMAINS.some((d) => d.id === flags.area)) die(`unknown area "${flags.area}". Run \`komainu catalog\` to see the areas.`);
    const options = { count, seed: flags.seed || '', only: flags.area ? [flags.area] : undefined };
    const made = buildQuiz(cfg, options);
    if (!made.total) die('no questions: that area has no rules switched on');
    if (flags.url) return console.log(quizLink(cfg, options, flags.url));
    process.stdout.write(format.render(made));
}

function installSkill(dir, flags) {
    const root = path.join(flags.global ? os.homedir() : dir, flags.agents ? '.agents' : '.claude', 'skills', 'komainu-guardrails');
    const files = { 'SKILL.md': SKILL_MD, 'references/mapping.md': SKILL_MAPPING, 'references/config.md': SKILL_CONFIG, 'references/catalog.md': catalogMarkdown() };
    for (const [rel, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), content);
    }
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    if (SELF) fs.copyFileSync(SELF, path.join(root, 'scripts', 'komainu.mjs'));
    console.log(`Installed the komainu-guardrails skill in ${root}`);
    if (!SELF) console.log('note: copy komainu.mjs into its scripts/ folder so the skill can run it.');
    console.log('Start a new agent session and ask: "Build AI guardrails for our organization from our internal policies."');
}

async function init(dir, flags) {
    if (!process.stdin.isTTY) die('`init` is interactive; use `apply <config>` in scripts');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = async (q, def = '') => (await rl.question(`${q}${def ? ` [${def}]` : ''}: `)).trim() || def;
    const pick = async (title, items, def) => {
        console.log(`\n${title}`);
        items.forEach((it, i) => console.log(`  ${String(i + 1).padStart(2)}. ${it.name}: ${it.blurb || it.hint}`));
        const a = await ask('Choose a number', String(def));
        return items[Math.min(items.length, Math.max(1, parseInt(a, 10) || def)) - 1];
    };
    const multi = async (title, items, def) => {
        console.log(`\n${title}`);
        items.forEach((it, i) => console.log(`  ${String(i + 1).padStart(2)}. ${it.name}: ${it.blurb || it.hint}`));
        const defStr = items.map((it, i) => (def.includes(it.id) ? i + 1 : 0)).filter(Boolean).join(',');
        const a = await ask('Numbers, comma-separated', defStr);
        return a.split(/[\s,]+/).map((n) => items[parseInt(n, 10) - 1]?.id).filter(Boolean);
    };

    console.log(`Komainu ${VERSION} guardrail wizard. Everything stays on this machine.\n`);
    const existing = loadConfig(dir);
    if (existing) console.log('Found komainu.json; its values are the defaults below.');
    const preset = existing ? { cfg: existing } : await pick('What kind of organization is this?', PRESETS, 1);
    const base = normalize({ ...DEFAULT_CONFIG, ...preset.cfg });
    const cfg = { ...base };
    cfg.org = await ask('\nOrganization name (optional, appears in the generated files)', base.org);
    cfg.domains = await multi('Which areas use AI?', DOMAINS.filter((d) => !d.locked), base.domains);
    cfg.strictness = (await pick('How strict?', STRICTNESS, STRICTNESS.findIndex((s) => s.id === base.strictness) + 1)).id;
    cfg.tools = await ask('\nApproved AI tools (free text, e.g. "Claude Enterprise, GitHub Copilot Business")', base.tools);
    cfg.contact = await ask('Who answers questions and receives incident reports (a role or channel)', base.contact);
    cfg.levels = (await ask('Data classification levels, lowest to highest', base.levels.join(', '))).split(',').map((s) => s.trim()).filter(Boolean);
    cfg.hostedMax = await ask('Highest level allowed in hosted AI tools', cfg.levels.includes(base.hostedMax) ? base.hostedMax : cfg.levels[0]);
    cfg.local = await ask('Route for anything higher (e.g. "the on-prem model at ai.internal"; blank = not allowed)', base.local);
    const terms = await ask('Sensitive names to block locally (clients, codenames; comma-separated, optional)', base.terms.join(', '));
    cfg.terms = terms.split(',').map((s) => s.trim()).filter(Boolean);
    cfg.targets = await multi('Where should the guardrails be installed?', TARGETS, base.targets);
    rl.close();

    const final = inLang(normalize(cfg));
    console.log('');
    apply(dir, final, { dryRun: !!flags['dry-run'] });
}

function exportAs(dir, what, source) {
    const cfg = loadConfig(dir, source) || die('no configuration: pass one, or run in a folder with komainu.json');
    const out = { sh: () => bashScript(cfg), ps1: () => powershellScript(cfg), json: () => JSON.stringify(cfg, null, 2) + '\n', token: () => encode(cfg) + '\n', prompt: () => agentPrompt(cfg) + '\n' }[what];
    if (!out) die('export what? one of: sh, ps1, json, token, prompt');
    process.stdout.write(out());
}

async function main() {
    const { flags, pos } = parseArgs(process.argv.slice(2));
    const cmd = pos.shift();
    const dir = path.resolve(flags.dir || '.');
    if (flags.version) return console.log(VERSION);
    if (!cmd || flags.help || cmd === 'help') return process.stdout.write(HELP);
    if (flags.lang !== undefined) {
        if (!LANGS.includes(flags.lang)) die(`--lang must be one of: ${LANGS.join(', ')}`);
        langFlag = flags.lang;
    }

    try {
        switch (cmd) {
            case 'init': return await init(dir, flags);
            case 'apply': {
                const cfg = loadConfig(dir, pos[0] || flags.file) || die('no configuration: pass a token or JSON file, or run `komainu init`');
                console.log(`Applying guardrails${cfg.org ? ` for ${cfg.org}` : ''} in ${dir}\n`);
                return apply(dir, cfg, { dryRun: !!flags['dry-run'] });
            }
            case 'import': return importRules(dir, pos[0], flags);
            case 'template': return template(pos[0], flags);
            case 'quiz': return quiz(dir, pos[0], flags);
            case 'status': return status(dir);
            case 'check': return check(dir, pos, flags);
            case 'redact': {
                const cfg = loadConfig(dir) || normalize({});
                return void process.stdout.write(scanText(fs.readFileSync(0, 'utf8'), detectorsFor(cfg.redact), cfg.terms).redacted);
            }
            case 'export': return exportAs(dir, pos[0], pos[1]);
            case 'catalog': {
                if (!flags.json) return console.log(catalogMarkdown());
                return console.log(JSON.stringify({ domains: DOMAINS, strictness: STRICTNESS, targets: TARGETS, coverage: COVERAGE, rules: activeRules(normalize({ strictness: 'strict', domains: DOMAINS.map((d) => d.id) })).flatMap((g) => g.rules) }, null, 2));
            }
            case 'skill':
                if (pos[0] !== 'install') die('usage: komainu skill install [--global] [--agents]');
                return installSkill(dir, flags);
            case 'mcp':
                return serveStdio(createServer({ loadConfig: () => { try { return loadConfig(dir); } catch { return null; } } }));
            default:
                die(`unknown command "${cmd}". Run with --help.`);
        }
    } catch (e) {
        die(e.message);
    }
}

main();
