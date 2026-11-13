import test from 'node:test';
import assert from 'node:assert/strict';

import { DOMAINS, PRESETS, RULES, ruleById } from '../src/core/catalog.js';
import { normalize, isActive, MAX_CUSTOM } from '../src/core/config.js';
import { parseRules, parseCsv, areaId, applyImport, TEMPLATE_CSV, TEMPLATE_JSON } from '../src/core/import.js';
import { policyTemplates, templateRules, templateCsv, templateFileName, rulesCsv, TEMPLATE_COLUMNS } from '../src/core/templates.js';

// ── CSV parsing ─────────────────────────────────────────────────────────────
const CSV_CASES = [
    ['plain cells', 'a,b,c\n1,2,3\n', [['a', 'b', 'c'], ['1', '2', '3']]],
    ['quoted cell with a comma', 'a,"b, c",d\n', [['a', 'b, c', 'd']]],
    ['escaped quote', '"say ""hi"""\n', [['say "hi"']]],
    ['newline inside quotes', '"two\nlines",x\n', [['two\nlines', 'x']]],
    ['semicolon delimiter', 'rule;area\nDo it;HR\n', [['rule', 'area'], ['Do it', 'HR']]],
    ['tab delimiter', 'rule\tarea\nDo it\tHR\n', [['rule', 'area'], ['Do it', 'HR']]],
    ['Windows line endings and a byte-order mark', '﻿rule,area\r\nDo it,HR\r\n', [['rule', 'area'], ['Do it', 'HR']]],
    ['blank lines are dropped', 'a\n\n\nb\n', [['a'], ['b']]],
    ['no trailing newline', 'a,b', [['a', 'b']]],
    ['empty trailing cell', 'a,b,\n', [['a', 'b', '']]],
    ['comma inside quotes does not pick the delimiter', '"a,b,c";d\n', [['a,b,c', 'd']]]
];
for (const [label, text, expected] of CSV_CASES) {
    test(`parseCsv: ${label}`, () => assert.deepEqual(parseCsv(text), expected));
}

// ── Area names ──────────────────────────────────────────────────────────────
const AREA_CASES = [
    ['hr', 'hr'], ['HR', 'hr'], ['Human resources', 'hr'], ['People Ops', 'hr'], ['Recruiting', 'hr'],
    ['Engineering', 'coding'], ['Engineering team', 'coding'], ['dev', 'coding'],
    ['InfoSec', 'security'], ['Privacy', 'data'], ['Data & privacy', 'data'], ['data_privacy', 'data'],
    ['Legal & Compliance', 'legal'], ['Customer service', 'support'], ['Comms', 'communication'],
    ['Everyone', 'core'], ['General', 'core'], ['Risk', 'governance'], ['Board', 'governance'],
    ['IT', 'controls'], ['Machine learning', 'building'], ['Government', 'public'],
    ['Healthcare', 'health'], ['University', 'education'], ['Finance', 'finance'], ['Marketing', 'marketing'],
    ['Gardening', null], ['', null], ['   ', null]
];
for (const [name, expected] of AREA_CASES) {
    test(`areaId: "${name}" → ${expected}`, () => assert.equal(areaId(name), expected));
}

test('every area resolves from its own id and name', () => {
    for (const d of DOMAINS) {
        assert.equal(areaId(d.id), d.id);
        assert.equal(areaId(d.name), d.id);
    }
});

// ── Plain rule files ────────────────────────────────────────────────────────
test('the blank CSV and JSON examples import cleanly', () => {
    const csv = parseRules(TEMPLATE_CSV, { name: 'rules.csv' });
    assert.equal(csv.format, 'csv');
    assert.deepEqual(csv.rules.map((r) => [r.d, r.l]), [['hr', 'must'], ['legal', 'must'], ['marketing', 'should'], ['coding', 'should']]);
    assert.equal(csv.rules[0].src, 'AI Policy 5.2');
    assert.equal(csv.rules[3].src, undefined);
    assert.deepEqual([csv.on, csv.off, csv.replaces, csv.skipped], [[], [], [], []]);
    const json = parseRules(TEMPLATE_JSON, { name: 'rules.json' });
    assert.equal(json.format, 'json');
    assert.equal(json.rules.length, 3);
});

test('alternative headers, skipped rows and unknown areas are reported', () => {
    const r = parseRules('Requirement,Severity,Department,Owner\n"Never share salary data.",HIGH,People,Ana\n,low,Sales,\nok,low,Sales,\n"Prefer short replies.",,Gardening,\n"never share salary data.",high,People,\n', { fallback: 'communication' });
    assert.deepEqual(r.rules, [{ d: 'hr', l: 'must', x: 'Never share salary data.' }, { d: 'communication', l: 'should', x: 'Prefer short replies.' }]);
    assert.deepEqual(r.skipped.map((s) => [s.row, s.reason]), [[3, 'no rule text'], [4, 'too short to be a rule'], [6, 'duplicate']]);
    assert.ok(r.notes.some((n) => n.includes('Owner')));
    assert.ok(r.notes.some((n) => n.includes('Gardening') && n.includes('Communication')));
});

const LEVEL_CASES = [
    ['must', 'x', 'must'], ['SHALL', 'x', 'must'], ['Mandatory', 'x', 'must'], ['critical', 'x', 'must'], ['high', 'x', 'must'],
    ['should', 'x', 'should'], ['Recommended', 'x', 'should'], ['optional', 'x', 'should'], ['low', 'x', 'should'], ['warning', 'x', 'should'],
    ['', 'You should cite sources.', 'should'], ['', 'Prefer short replies.', 'should'], ['', 'Where possible, use synthetic data.', 'should'],
    ['', 'Do not email source code.', 'must'], ['', 'You should never share passwords.', 'must'], ['', 'Reports go to the owner.', 'must'],
    ['nonsense', 'Consider a review.', 'should']
];
for (const [level, text, expected] of LEVEL_CASES) {
    test(`level "${level}" with "${text}" → ${expected}`, () => {
        const row = `"${text.length < 4 ? 'A rule that is long enough.' : text}"`;
        assert.equal(parseRules(`rule,level\n${row},${level}\n`).rules[0].l, text.length < 4 ? (expected) : expected);
    });
}

test('a file with no header is read line by line, or by its longest column', () => {
    const lines = parseRules('Do not email source code.\nYou should cite sources.\n');
    assert.deepEqual(lines.rules.map((r) => [r.d, r.l]), [['core', 'must'], ['core', 'should']]);
    assert.match(lines.notes[0], /every line was read as one rule/);
    const cols = parseRules('1,Do not email source code to anyone.,x\n2,Always cite the sources you used.,y\n');
    assert.deepEqual(cols.rules.map((r) => r.x), ['Do not email source code to anyone.', 'Always cite the sources you used.']);
    assert.match(cols.notes[0], /column 2 was read as the rule text/);
});

test('JSON shapes: list, rules object, grouped by area, komainu.json', () => {
    assert.equal(parseRules('["First rule here.", {"text": "Second rule here.", "priority": "low"}]').rules[1].l, 'should');
    const grouped = parseRules(JSON.stringify({ HR: ['Keep CVs out of chat tools.'], Sales: [{ text: 'Quote only list prices.', area: 'Finance' }] }));
    assert.deepEqual(grouped.rules.map((r) => r.d), ['hr', 'finance'], 'a rule\'s own area beats its group');
    const cfg = parseRules(JSON.stringify({ v: 1, custom: [{ d: 'hr', l: 'should', x: 'From a configuration.' }] }));
    assert.deepEqual(cfg.rules, [{ d: 'hr', l: 'should', x: 'From a configuration.' }]);
    assert.match(cfg.notes[0], /komainu\.json/);
});

for (const [label, text, name, pattern] of [
    ['broken JSON file', '{"rules": [', 'x.json', /Could not read the JSON/],
    ['JSON with no list', '{"a": 1}', '', /Could not read the JSON/],
    ['empty text', '   ', '', /The file is empty/],
    ['only a header', 'rule,level\n', '', /No rules found/]
]) {
    test(`unreadable input: ${label}`, () => {
        const r = parseRules(text, { name });
        assert.equal(r.rules.length, 0);
        assert.match(r.notes.join(' '), pattern);
    });
}

test('text starting with a bracket that is not JSON falls back to CSV', () => {
    const r = parseRules('[draft] Do not email source code.\n[draft] Cite the sources you used.\n');
    assert.equal(r.format, 'csv');
    assert.equal(r.rules.length, 2);
});

test('existing rules count as duplicates and long text is cut', () => {
    assert.equal(parseRules('["Existing rule here."]', { existing: [{ x: 'existing rule here.' }] }).rules.length, 0);
    const long = parseRules(`rule\n"${'word '.repeat(200)}"\n`);
    assert.equal(long.rules[0].x.length <= 600, true);
    assert.match(long.notes.join(' '), /longer than 600 characters/);
});

test('the number of custom rules is capped', () => {
    const many = parseRules(Array.from({ length: MAX_CUSTOM + 100 }, (_, i) => `Rule number ${i} applies.`).join('\n'));
    assert.equal(many.rules.length, MAX_CUSTOM);
    assert.equal(many.skipped.length, 100);
    const withExisting = parseRules('One more rule.\nAnd another rule.\n', { existing: Array.from({ length: MAX_CUSTOM - 1 }, (_, i) => ({ x: `Old ${i}` })) });
    assert.equal(withExisting.rules.length, 1);
});

test('markup in a rule is kept as text', () => {
    const r = parseRules('rule\n"<img src=x onerror=alert(1)> must not run."\n');
    assert.equal(r.rules[0].x, '<img src=x onerror=alert(1)> must not run.');
});

// ── Policy templates ────────────────────────────────────────────────────────
test('there is one template per persona and one per area', () => {
    const all = policyTemplates();
    assert.equal(all.length, PRESETS.length + DOMAINS.length);
    assert.equal(new Set(all.map((t) => t.id)).size, all.length);
    assert.equal(templateCsv('nope'), null);
    assert.equal(templateRules('nope'), null);
    assert.equal(templateFileName('area-hr'), 'komainu-policy-hr.csv');
    assert.equal(templateFileName('governance'), 'komainu-policy-governance.csv');
});

for (const t of policyTemplates()) {
    test(`template ${t.id} round-trips unchanged`, () => {
        const rules = templateRules(t.id);
        assert.ok(rules.length >= 6);
        const csv = templateCsv(t.id);
        assert.equal(csv.split('\n')[0], TEMPLATE_COLUMNS.join(','));
        assert.equal(parseCsv(csv).length, rules.length + 1, 'one row per rule plus the header');
        const res = parseRules(csv, { name: 'policy.csv' });
        assert.deepEqual(res.on, rules.map((r) => r.id));
        assert.deepEqual([res.rules, res.skipped], [[], []]);
        assert.deepEqual(res.replaces, res.on);
        const areas = new Set(rules.map((r) => r.d));
        assert.deepEqual(res.off.sort(), RULES.filter((r) => areas.has(r.d) && !rules.includes(r)).map((r) => r.id).sort());
    });
}

test('an area template holds every rule of the area, whatever its tier', () => {
    assert.deepEqual(templateRules('area-governance').map((r) => r.id), RULES.filter((r) => r.d === 'governance').map((r) => r.id));
});

test('commas, quotes and newlines survive the CSV', () => {
    const odd = [{ id: 'core.verify', d: 'core', l: 'must', t: 'A "quoted", title', x: 'Line one.\nLine two, with a comma.' }];
    const rows = parseCsv(rulesCsv(odd));
    assert.deepEqual(rows[1], ['core.verify', 'Universal', 'must', 'A "quoted", title', 'Line one.\nLine two, with a comma.', '']);
});

test('editing a row turns it into a custom rule and switches the original off', () => {
    const csv = templateCsv('area-health').replace('A qualified clinician makes', 'The treating doctor makes');
    const res = parseRules(csv);
    assert.equal(res.rules.length, 1);
    assert.deepEqual([res.rules[0].d, res.rules[0].l, res.rules[0].src], ['health', 'must', 'health.clinician-decides']);
    assert.ok(res.off.includes('health.clinician-decides') && !res.on.includes('health.clinician-decides'));
    assert.ok(res.replaces.includes('health.clinician-decides'));
});

test('changing only the level or the area also counts as an edit', () => {
    const rows = parseCsv(templateCsv('area-education'));
    rows[1][2] = 'should';
    rows[2][1] = 'Human resources';
    const res = parseRules(rulesCsvFromRows(rows));
    assert.deepEqual(res.rules.map((r) => [r.d, r.l, r.src]), [['education', 'should', rows[1][0]], ['hr', 'must', rows[2][0]]]);
});

test('deleting a row switches that rule off, and a row without an id is a new rule', () => {
    const lines = templateCsv('area-health').trimEnd().split('\n').filter((l) => !l.startsWith('health.bias'));
    lines.push(',Health & care,must,,"Record consent before any recording.",Consent Policy 2');
    const res = parseRules(lines.join('\n'));
    assert.ok(res.off.includes('health.bias'));
    assert.deepEqual(res.rules, [{ d: 'health', l: 'must', x: 'Record consent before any recording.', src: 'Consent Policy 2' }]);
});

test('a source typed into an edited row is kept', () => {
    const rows = parseCsv(templateCsv('area-health'));
    rows[1][4] = 'Our own wording for this rule.';
    rows[1][5] = 'Clinical Policy 3';
    assert.equal(parseRules(rulesCsvFromRows(rows)).rules[0].src, 'Clinical Policy 3');
});

test('applying a template changes the configuration as described', () => {
    const start = normalize({ domains: ['core'] });
    const csv = templateCsv('area-health').replace('A qualified clinician makes', 'The treating doctor makes').split('\n').filter((l) => !l.startsWith('health.bias')).join('\n');
    const cfg = normalize(applyImport(start, parseRules(csv, { existing: start.custom })));
    assert.ok(cfg.domains.includes('health'), 'the area is turned on');
    assert.equal(isActive(ruleById('health.clinician-decides'), cfg), false, 'the edited rule is off');
    assert.equal(isActive(ruleById('health.bias'), cfg), false, 'the deleted rule is off');
    assert.equal(isActive(ruleById('health.record'), cfg), true, 'an untouched tier 2 rule is on');
    assert.deepEqual(cfg.custom.map((c) => c.src), ['health.clinician-decides']);

    // Importing a second edit of the same row replaces the first.
    const again = csv.replace('The treating doctor makes', 'The responsible physician makes');
    const cfg2 = normalize(applyImport(cfg, parseRules(again, { existing: cfg.custom })));
    assert.equal(cfg2.custom.length, 1);
    assert.match(cfg2.custom[0].x, /^The responsible physician/);

    // Importing the untouched template restores the catalog rules.
    const restored = normalize(applyImport(cfg2, parseRules(templateCsv('area-health'), { existing: cfg2.custom })));
    assert.equal(restored.custom.length, 0);
    assert.equal(isActive(ruleById('health.clinician-decides'), restored), true);
    assert.equal(isActive(ruleById('health.bias'), restored), true);
});

test('applying a plain rules file only adds rules and areas', () => {
    const start = normalize({ off: ['core.verify'], on: ['core.literacy'] });
    const cfg = normalize(applyImport(start, parseRules(TEMPLATE_CSV, { existing: [] })));
    assert.deepEqual([cfg.on, cfg.off], [start.on, start.off]);
    assert.equal(cfg.custom.length, 4);
    assert.ok(['hr', 'legal', 'marketing', 'coding'].every((d) => cfg.domains.includes(d)));
});

function rulesCsvFromRows(rows) {
    const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}
