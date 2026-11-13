import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { RULES, DOMAINS, TARGETS, VERSION } from '../src/core/catalog.js';
import { normalize, encode } from '../src/core/config.js';
import { generate } from '../src/core/generate.js';
import { TEMPLATE_CSV } from '../src/core/import.js';
import { templateCsv, policyTemplates } from '../src/core/templates.js';
import { FULL, AWS, CARD, CLI, tmp, run } from './helpers.mjs';

const TOKEN = encode(FULL);
const exists = (dir, f) => fs.existsSync(path.join(dir, f));
const readIn = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

test('--version, --help and no command', () => {
    assert.equal(run(['--version']).stdout.trim(), VERSION);
    for (const args of [['--help'], ['help'], []]) {
        const r = run(args);
        assert.equal(r.status, 0);
        assert.match(r.stdout, /Usage: node komainu\.mjs <command>/);
    }
});

test('help lists every command', () => {
    const help = run(['--help']).stdout;
    for (const cmd of ['init', 'apply', 'template', 'quiz', 'import', 'status', 'check', 'redact', 'export', 'catalog', 'skill install', 'mcp']) assert.ok(help.includes(cmd), cmd);
});

test('an unknown command fails with a hint', () => {
    const r = run(['frobnicate']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /unknown command "frobnicate"/);
});

test('apply --dry-run writes nothing', () => {
    const dir = tmp();
    const r = run(['apply', TOKEN, '--dir', dir, '--dry-run']);
    assert.match(r.stdout, /Dry run, nothing written/);
    assert.deepEqual(fs.readdirSync(dir), []);
});

test('apply writes every file the generator lists', () => {
    const dir = tmp();
    const r = run(['apply', TOKEN, '--dir', dir]);
    assert.equal(r.status, 0, r.stderr);
    for (const f of generate(FULL)) {
        assert.ok(exists(dir, f.path), f.path);
        if (f.mode === 'file') assert.equal(readIn(dir, f.path), f.content, f.path);
    }
    assert.ok(fs.statSync(path.join(dir, '.claude/hooks/komainu-guard.mjs')).mode & 0o100);
    assert.equal(readIn(dir, '.komainu/komainu.mjs'), fs.readFileSync(CLI, 'utf8'), 'the CLI copies itself for the MCP entry');
    assert.match(r.stdout, new RegExp(`${RULES.length} rules across ${DOMAINS.length} domains`));
});

test('apply accepts a token, a JSON file, -f, or the komainu.json in the folder', () => {
    for (const how of ['token', 'file', 'flag', 'folder']) {
        const dir = tmp();
        const json = path.join(dir, how === 'folder' ? 'komainu.json' : 'draft.json');
        fs.writeFileSync(json, JSON.stringify({ v: 1, org: 'From File', targets: ['agents'] }));
        const args = { token: ['apply', encode({ org: 'From File', targets: ['agents'] })], file: ['apply', json], flag: ['apply', '-f', json], folder: ['apply'] }[how];
        assert.equal(run([...args, '--dir', dir]).status, 0, how);
        assert.match(readIn(dir, 'AGENTS.md'), /AI guardrails for From File/, how);
    }
});

test('apply fails clearly on a bad or missing configuration', () => {
    const dir = tmp();
    assert.match(run(['apply', 'not-a-token', '--dir', dir]).stderr, /No configuration found/);
    assert.match(run(['apply', '--dir', dir]).stderr, /no configuration/);
    assert.equal(run(['apply', '--dir', dir]).status, 1);
});

test('apply keeps what is already in the folder', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Mine\n\nKeep this.\n');
    fs.mkdirSync(path.join(dir, '.claude'));
    fs.writeFileSync(path.join(dir, '.claude/settings.json'), JSON.stringify({ model: 'x', permissions: { deny: ['Bash(sudo *)'] } }));
    fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'x' } } }));
    assert.equal(run(['apply', TOKEN, '--dir', dir]).status, 0);
    assert.ok(readIn(dir, 'AGENTS.md').startsWith('# Mine\n\nKeep this.\n'));
    const settings = JSON.parse(readIn(dir, '.claude/settings.json'));
    assert.equal(settings.model, 'x');
    assert.ok(settings.permissions.deny.includes('Bash(sudo *)') && settings.permissions.deny.includes('Read(./.env)'));
    assert.deepEqual(Object.keys(JSON.parse(readIn(dir, '.mcp.json')).mcpServers).sort(), ['komainu', 'other']);
});

test('apply is idempotent', () => {
    const dir = tmp();
    run(['apply', TOKEN, '--dir', dir]);
    const before = readIn(dir, 'AGENTS.md') + readIn(dir, '.claude/settings.json');
    const again = run(['apply', '--dir', dir]);
    assert.ok(!/create|update/.test(again.stdout.split('\n').filter((l) => l.startsWith('  ')).join('\n')));
    assert.equal(readIn(dir, 'AGENTS.md') + readIn(dir, '.claude/settings.json'), before);
});

test('apply leaves broken JSON alone and writes its version next to it', () => {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, '.claude'));
    fs.writeFileSync(path.join(dir, '.claude/settings.json'), '{ broken');
    const r = run(['apply', encode({ targets: ['claude'] }), '--dir', dir]);
    assert.match(r.stdout, /MANUAL\s+\.claude\/settings\.json/);
    assert.equal(readIn(dir, '.claude/settings.json'), '{ broken');
    assert.doesNotThrow(() => JSON.parse(readIn(dir, '.claude/settings.json.komainu-new')));
});

test('status reports a clean folder, then drift, then clean again', () => {
    const dir = tmp();
    assert.match(run(['status', '--dir', dir]).stderr, /no komainu\.json/);
    run(['apply', TOKEN, '--dir', dir]);
    assert.equal(run(['status', '--dir', dir]).status, 0);
    fs.rmSync(path.join(dir, 'GEMINI.md'));
    fs.appendFileSync(path.join(dir, '.cursor/rules/komainu-guardrails.mdc'), 'edited\n');
    const drift = run(['status', '--dir', dir]);
    assert.equal(drift.status, 1);
    assert.match(drift.stdout, /DRIFT\s+GEMINI\.md\s+\(missing\)/);
    assert.match(drift.stdout, /DRIFT\s+\.cursor\/rules\/komainu-guardrails\.mdc/);
    assert.match(drift.stdout, /2 file\(s\) out of date/);
    run(['apply', '--dir', dir]);
    assert.equal(run(['status', '--dir', dir]).status, 0);
});

test('editing outside the managed block is not drift; editing inside is', () => {
    const dir = tmp();
    run(['apply', encode({ targets: ['agents'] }), '--dir', dir]);
    fs.appendFileSync(path.join(dir, 'AGENTS.md'), '\n## Our own notes\n');
    assert.equal(run(['status', '--dir', dir]).status, 0);
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), readIn(dir, 'AGENTS.md').replace('MUST: A human owns', 'MAYBE: A human owns'));
    assert.equal(run(['status', '--dir', dir]).status, 1);
});

test('check finds leaks by file and line, and never prints the value', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'leak.txt'), `ok\nkey=${AWS}\ncard ${CARD}\n`);
    fs.writeFileSync(path.join(dir, 'clean.txt'), 'nothing here\n');
    const r = run(['check', 'leak.txt', 'clean.txt', 'missing.txt', '--dir', dir]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /leak\.txt:2\s+AWS access key → \[REDACTED_SECRET\]/);
    assert.match(r.stdout, /leak\.txt:3\s+payment card number/);
    assert.match(r.stdout, /2 finding\(s\)/);
    assert.ok(!r.stdout.includes(AWS) && !r.stdout.includes('4111'));
    assert.equal(run(['check', 'clean.txt', '--dir', dir]).status, 0);
});

test('check uses the sensitive terms and classes from komainu.json', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'komainu.json'), JSON.stringify({ v: 1, terms: ['Project Falcon'], redact: ['secrets'] }));
    fs.writeFileSync(path.join(dir, 'notes.txt'), `Project Falcon\ncard ${CARD}\n`);
    const r = run(['check', 'notes.txt', '--dir', dir]);
    assert.match(r.stdout, /notes\.txt:1\s+sensitive term/);
    assert.ok(!r.stdout.includes('payment card'), 'the card class is off in this configuration');
});

test('check --stdin, binary files, and nothing to check', () => {
    const dir = tmp();
    assert.equal(run(['check', '--stdin', '--dir', dir], { input: `x ${AWS}` }).status, 1);
    assert.equal(run(['check', '--stdin', '--dir', dir], { input: 'clean' }).status, 0);
    fs.writeFileSync(path.join(dir, 'bin.dat'), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(AWS)]));
    assert.equal(run(['check', 'bin.dat', '--dir', dir]).status, 0, 'binary files are skipped');
    assert.match(run(['check', '--dir', dir]).stderr, /nothing to check/);
});

test('check skips the files Komainu itself wrote', () => {
    const dir = tmp();
    run(['apply', TOKEN, '--dir', dir]);
    assert.equal(run(['check', 'komainu.json', '.claude/hooks/komainu-guard.mjs', '.komainu/komainu.mjs', '--dir', dir]).status, 0);
});

test('check --staged scans what git has staged', () => {
    const dir = tmp();
    const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
    assert.equal(g('init', '-q').status, 0);
    fs.writeFileSync(path.join(dir, 'staged.txt'), `key=${AWS}\n`);
    fs.writeFileSync(path.join(dir, 'unstaged.txt'), `card ${CARD}\n`);
    g('add', 'staged.txt');
    const r = run(['check', '--staged', '--dir', dir]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /staged\.txt:1/);
    assert.ok(!r.stdout.includes('unstaged.txt'));
});

test('redact replaces values on standard input', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'komainu.json'), JSON.stringify({ v: 1, terms: ['Project Falcon'] }));
    assert.equal(run(['redact', '--dir', dir], { input: `x ${AWS} Project Falcon ${CARD}` }).stdout, 'x [REDACTED_SECRET] [REDACTED_TERM] [REDACTED_CC]');
    assert.equal(run(['redact', '--dir', tmp()], { input: 'clean text' }).stdout, 'clean text');
});

for (const [what, check] of [
    ['json', (out) => assert.deepEqual(JSON.parse(out), normalize(FULL))],
    ['token', (out) => assert.equal(out.trim(), TOKEN)],
    ['sh', (out) => assert.match(out, /^#!\/usr\/bin\/env bash/)],
    ['ps1', (out) => assert.match(out, /\$ErrorActionPreference = 'Stop'/)],
    ['prompt', (out) => assert.match(out, /komainu-guardrails skill/)]
]) {
    test(`export ${what}`, () => {
        const r = run(['export', what, TOKEN]);
        assert.equal(r.status, 0, r.stderr);
        check(r.stdout);
    });
}

test('export needs a known format and a configuration', () => {
    assert.match(run(['export', 'pdf', TOKEN]).stderr, /one of: sh, ps1, json, token, prompt/);
    assert.match(run(['export', 'json', '--dir', tmp()]).stderr, /no configuration/);
});

test('catalog prints every rule, as Markdown or JSON', () => {
    const md = run(['catalog']).stdout;
    for (const r of RULES) assert.ok(md.includes(r.id), r.id);
    const json = JSON.parse(run(['catalog', '--json']).stdout);
    assert.equal(json.rules.length, RULES.length);
    assert.equal(json.domains.length, DOMAINS.length);
    assert.equal(json.targets.length, TARGETS.length);
});

test('template lists every template and prints one as CSV', () => {
    const list = run(['template', '--list']).stdout;
    for (const t of policyTemplates()) assert.ok(list.includes(t.id), t.id);
    assert.equal(run(['template']).stdout, list, 'no id means the list');
    assert.equal(run(['template', 'governance']).stdout, templateCsv('governance'));
    assert.equal(run(['template', 'area-hr']).stdout, templateCsv('area-hr'));
    assert.match(run(['template', 'nope']).stderr, /unknown template "nope"/);
});

test('import adds rules to komainu.json and turns their areas on', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'rules.csv'), TEMPLATE_CSV);
    const dry = run(['import', 'rules.csv', '--dir', dir, '--dry-run']);
    assert.match(dry.stdout, /Read 4 rule\(s\) from rules\.csv \(CSV\)/);
    assert.ok(!exists(dir, 'komainu.json'));
    assert.equal(run(['import', 'rules.csv', '--dir', dir]).status, 0);
    const saved = JSON.parse(readIn(dir, 'komainu.json'));
    assert.equal(saved.custom.length, 4);
    assert.ok(['hr', 'legal', 'marketing'].every((d) => saved.domains.includes(d)));
    assert.match(run(['import', 'rules.csv', '--dir', dir]).stdout, /skipped row 2: duplicate/);
    run(['apply', '--dir', dir]);
    assert.match(readIn(dir, 'AGENTS.md'), /Get approval from the People team/);
});

test('import --area files rules with no area, and rejects unreadable input', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'plain.txt'), 'Quote only list prices.\n');
    run(['import', 'plain.txt', '--area', 'sales', '--dir', dir]);
    assert.equal(JSON.parse(readIn(dir, 'komainu.json')).custom[0].d, 'sales');
    assert.match(run(['import', '--dir', dir]).stderr, /usage: komainu import/);
    assert.match(run(['import', 'missing.csv', '--dir', dir]).stderr, /cannot read missing\.csv/);
    fs.writeFileSync(path.join(dir, 'empty.csv'), '');
    assert.equal(run(['import', 'empty.csv', '--dir', dir]).status, 1);
});

test('a downloaded template can be edited, imported and applied', () => {
    const dir = tmp();
    const csv = templateCsv('area-health').replace('A qualified clinician makes', 'The treating doctor makes').split('\n').filter((l) => !l.startsWith('health.bias')).join('\n');
    fs.writeFileSync(path.join(dir, 'policy.csv'), csv);
    const r = run(['import', 'policy.csv', '--dir', dir]);
    assert.match(r.stdout, /1 was edited, and 1 not in the file is switched off/);
    run(['apply', '--dir', dir]);
    const md = readIn(dir, 'AGENTS.md');
    assert.ok(md.includes('The treating doctor makes') && !md.includes('A qualified clinician makes'));
    assert.ok(!md.includes('Check performance across patient groups'));
    assert.ok(md.includes('Urgent cases go to a person'));
    assert.equal(run(['status', '--dir', dir]).status, 0);
});

test('init refuses to run without a terminal', () => {
    const r = run(['init', '--dir', tmp()], { input: '' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /`init` is interactive/);
});

test('the CLI never prints a stack trace for a user error', () => {
    for (const args of [['apply', '{"v":1,'], ['export', 'json', '!!!'], ['skill'], ['skill', 'remove']]) {
        const r = run([...args, '--dir', tmp()]);
        assert.equal(r.status, 1, args.join(' '));
        assert.match(r.stderr, /^komainu: /);
        assert.ok(!/\n\s+at /.test(r.stderr), args.join(' '));
    }
});
