import test from 'node:test';
import assert from 'node:assert/strict';

import { RULES, DOMAINS, PRESETS, ATTESTED, TARGETS, STRICTNESS, CLASSIFICATIONS, REDACT_CLASSES, FRAMEWORKS, COVERAGE, domainById, ruleById } from '../src/core/catalog.js';
import { normalize, stats } from '../src/core/config.js';
import { DETECTORS } from '../src/core/detectors.js';
import { catalogMarkdown } from '../src/core/docs.js';

test('rule ids are unique and follow area.name', () => {
    const ids = RULES.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z]+\.[a-z0-9-]+$/);
});

for (const rule of RULES) {
    test(`rule ${rule.id} is well formed`, () => {
        assert.ok(DOMAINS.some((d) => d.id === rule.d), 'known area');
        assert.equal(rule.id.split('.')[0], rule.d, 'id prefix is the area');
        assert.ok(['must', 'should'].includes(rule.l));
        assert.ok([1, 2, 3].includes(rule.tier));
        assert.ok(rule.t.length >= 8 && rule.t.length <= 60, 'title length');
        assert.ok(!/[.:]$/.test(rule.t), 'title has no trailing punctuation');
        assert.ok(rule.x.length >= 40 && rule.x.length <= 420, 'text length');
        assert.match(rule.x, /[.]$/, 'text ends with a full stop');
        assert.ok(!/\{(?!tools|contact|levels|hostedMax|local)\w+\}/.test(rule.x), 'only known placeholders');
        assert.ok(Array.isArray(rule.refs));
        for (const p of [...(rule.enf?.bash || []), ...(rule.enf?.paths || [])]) {
            assert.doesNotThrow(() => new RegExp(p.re, p.flags || ''));
            assert.ok(p.why);
        }
        for (const p of rule.enf?.bash || []) assert.ok(['ask', 'deny'].includes(p.act));
        for (const perm of [...(rule.enf?.deny || []), ...(rule.enf?.ask || [])]) assert.match(perm, /^(Bash|Read|Edit|WebFetch)\(.+\)$/);
    });
}

for (const d of DOMAINS) {
    test(`area ${d.id} has essentials and a description`, () => {
        const rules = RULES.filter((r) => r.d === d.id);
        assert.ok(rules.length >= 6);
        assert.ok(rules.some((r) => r.tier === 1 && r.l === 'must'));
        assert.ok(d.name && d.blurb.endsWith('.'));
        assert.equal(domainById(d.id), d);
    });
}

test('only the universal area is locked', () => {
    assert.deepEqual(DOMAINS.filter((d) => d.locked).map((d) => d.id), ['core']);
});

test('attested rules exist and carry no machine enforcement', () => {
    for (const id of ATTESTED) {
        assert.ok(ruleById(id), id);
        assert.equal(ruleById(id).enf, undefined, `${id} cannot be both attested and enforced`);
    }
});

test('lookup helpers return undefined for unknown ids', () => {
    assert.equal(ruleById('nope.nope'), undefined);
    assert.equal(domainById('nope'), undefined);
});

for (const p of PRESETS) {
    test(`template "${p.name}" is valid`, () => {
        const cfg = normalize(p.cfg);
        assert.deepEqual(cfg.domains, ['core', ...p.cfg.domains.filter((d) => d !== 'core')]);
        assert.equal(cfg.strictness, p.cfg.strictness);
        assert.deepEqual(cfg.targets, p.cfg.targets);
        assert.ok(stats(cfg).total >= 20);
        assert.ok(p.blurb.endsWith('.'));
    });
}

test('reference tables are consistent', () => {
    assert.deepEqual(STRICTNESS.map((s) => s.tier), [1, 2, 3]);
    assert.equal(new Set(TARGETS.map((t) => t.id)).size, TARGETS.length);
    for (const t of TARGETS) assert.ok(t.name && t.hint && t.files.length);
    for (const c of CLASSIFICATIONS) assert.ok(c.levels.includes(c.hostedMax));
    for (const c of REDACT_CLASSES) assert.ok(DETECTORS.some((d) => d.cls === c.id), `${c.id} has a detector`);
    for (const d of DETECTORS) assert.ok(REDACT_CLASSES.some((c) => c.id === d.cls), `${d.id} has a class`);
    assert.deepEqual(Object.keys(COVERAGE), ['enforced', 'instructed', 'attested']);
    assert.ok(FRAMEWORKS.length >= 5);
});

test('every framework reference used by a rule is a listed framework', () => {
    const known = FRAMEWORKS.map((f) => f.id);
    for (const r of RULES) for (const ref of r.refs) assert.ok(known.some((k) => ref.startsWith(k)), `${r.id}: ${ref}`);
});

test('the catalog reference lists every rule, target and redaction class', () => {
    const md = catalogMarkdown();
    for (const r of RULES) assert.ok(md.includes(`\`${r.id}\``), r.id);
    for (const t of TARGETS) assert.ok(md.includes(`\`${t.id}\``), t.id);
    for (const c of REDACT_CLASSES) assert.ok(md.includes(`\`${c.id}\``), c.id);
    assert.equal(md.match(/^## /gm).length, DOMAINS.length + 2);
});
