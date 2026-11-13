import test from 'node:test';
import assert from 'node:assert/strict';

import { RULES, DOMAINS, STRICTNESS, ruleById } from '../src/core/catalog.js';
import { DEFAULT_CONFIG, MAX_CUSTOM, normalize, encode, decode, compact, stats, activeRules, isActive, isDefaultOn, renderText, coverageOf } from '../src/core/config.js';
import { cliCommand } from '../src/core/commands.js';
import { FULL } from './helpers.mjs';

test('the default configuration is already normal', () => {
    assert.deepEqual(normalize({}), normalize(DEFAULT_CONFIG));
    assert.deepEqual(normalize(normalize(FULL)), normalize(FULL), 'normalizing twice changes nothing');
});

for (const junk of [undefined, null, 0, 'text', [], [1, 2], true, { v: 9 }, { domains: 'core' }, { custom: 'x' }, { levels: {} }, { terms: [null, 3, {}] }]) {
    test(`normalize accepts ${JSON.stringify(junk)} without throwing`, () => {
        const c = normalize(junk);
        assert.equal(c.v, 1);
        assert.ok(c.domains.includes('core'));
        assert.ok(c.levels.length >= 2 && c.levels.includes(c.hostedMax));
    });
}

test('normalize drops unknown values and keeps known ones', () => {
    const c = normalize({ strictness: 'nope', domains: ['hr', 'bogus', 'hr'], on: ['x.y', 'core.literacy'], off: ['core.verify', 'zzz'], targets: ['agents', 'floppy'], redact: ['secrets', 'dna'] });
    assert.equal(c.strictness, 'balanced');
    assert.deepEqual(c.domains, ['core', 'hr']);
    assert.deepEqual(c.on, ['core.literacy']);
    assert.deepEqual(c.off, ['core.verify']);
    assert.deepEqual(c.targets, ['agents']);
    assert.deepEqual(c.redact, ['secrets']);
});

test('a rule cannot be forced on and off at once', () => {
    assert.deepEqual(normalize({ on: ['core.verify'], off: ['core.verify'] }).on, []);
});

test('text fields are trimmed, capped and stripped of control characters', () => {
    const c = normalize({ org: `  A${String.fromCharCode(7)}B  `, tools: 'x'.repeat(999), contact: 'c'.repeat(999), local: 'l'.repeat(999) });
    assert.equal(c.org, 'AB');
    assert.equal(c.tools.length, 300);
    assert.equal(c.contact.length, 120);
    assert.equal(c.local.length, 160);
});

test('custom rules are cleaned, capped and limited', () => {
    const c = normalize({ custom: [{ x: '  ' }, null, 'text', { d: 'nope', l: 'maybe', x: 'Do the thing.', src: ' §1 ' }, { d: 'hr', l: 'should', x: 'y'.repeat(900) }] });
    assert.deepEqual(c.custom[0], { d: 'core', l: 'must', x: 'Do the thing.', src: '§1' });
    assert.deepEqual([c.custom[1].d, c.custom[1].l, c.custom[1].x.length], ['hr', 'should', 600]);
    assert.equal(c.custom.length, 2);
    const many = normalize({ custom: Array.from({ length: MAX_CUSTOM + 50 }, (_, i) => ({ x: `Rule ${i} applies here.` })) });
    assert.equal(many.custom.length, MAX_CUSTOM);
});

test('classification levels fall back when fewer than two are given', () => {
    assert.deepEqual(normalize({ levels: ['Only'] }).levels, DEFAULT_CONFIG.levels);
    const c = normalize({ levels: ['Open', 'Staff', 'Secret'], hostedMax: 'Nope' });
    assert.equal(c.hostedMax, 'Staff');
    assert.equal(normalize({ levels: ['Open', 'Secret'], hostedMax: 'Open' }).hostedMax, 'Open');
});

test('sensitive terms are deduplicated and very short ones dropped', () => {
    assert.deepEqual(normalize({ terms: ['Falcon', 'Falcon', 'x', '  Kite  ', ''] }).terms, ['Falcon', 'Kite']);
});

for (const [i, s] of STRICTNESS.entries()) {
    test(`strictness ${s.id} turns on tier ${s.tier} and below`, () => {
        const cfg = normalize({ ...FULL, strictness: s.id });
        const expected = RULES.filter((r) => r.tier <= s.tier).length;
        assert.equal(stats(cfg).total, expected);
        if (i > 0) assert.ok(expected > RULES.filter((r) => r.tier <= STRICTNESS[i - 1].tier).length);
    });
}

test('on and off overrides beat the strictness tier', () => {
    const base = normalize({ ...FULL, strictness: 'advisory' });
    const tier3 = ruleById('core.literacy');
    assert.equal(isDefaultOn(tier3, base), false);
    assert.equal(isActive(tier3, base), false);
    assert.equal(isActive(tier3, normalize({ ...base, on: [tier3.id] })), true);
    const tier1 = ruleById('core.verify');
    assert.equal(isActive(tier1, base), true);
    assert.equal(isActive(tier1, normalize({ ...base, off: [tier1.id] })), false);
});

test('a rule in an area that is off is never active', () => {
    const cfg = normalize({ domains: ['core'], on: ['hr.bias'] });
    assert.equal(isActive(ruleById('hr.bias'), cfg), false);
});

test('placeholders render from the configuration, with readable defaults', () => {
    const text = 'Use {tools}. Ask {contact}. Levels {levels}, max {hostedMax}, else {local}. {unknown}';
    assert.equal(renderText(text, normalize({})), "Use the tools on the organization's approved list. Ask the AI governance owner. Levels Public, Internal, Confidential, Restricted, max Internal, else an approved local or private endpoint. {unknown}");
    assert.equal(renderText('{tools} / {contact} / {local}', normalize({ tools: 'T', contact: 'C', local: 'L' })), 'T / C / L');
});

test('coverage depends on the chosen targets', () => {
    const secrets = ruleById('core.no-secrets');
    const files = ruleById('coding.secret-files');
    const attested = ruleById('core.literacy');
    const plain = ruleById('core.verify');
    const cov = (rule, cfg) => coverageOf(rule, normalize(cfg));
    assert.equal(cov(secrets, { targets: ['hooks'] }), 'enforced');
    assert.equal(cov(secrets, { targets: ['claude'] }), 'instructed', 'scanning needs the hook');
    assert.equal(cov(secrets, { targets: ['hooks'], redact: ['cc'] }), 'instructed', 'the secrets class is off');
    assert.equal(cov(files, { targets: ['claude'] }), 'enforced', 'permission rules are enough');
    assert.equal(cov(files, { targets: ['agents'] }), 'instructed');
    assert.equal(cov(attested, { targets: ['hooks', 'claude'] }), 'attested');
    assert.equal(cov(plain, { targets: ['hooks', 'claude'] }), 'instructed');
    assert.equal(cov(ruleById('core.pii-min'), { targets: ['hooks'], redact: ['secrets'] }), 'instructed', 'no personal-data class is on');
    assert.equal(cov(ruleById('core.pii-min'), { targets: ['hooks'], redact: ['cc'] }), 'enforced');
});

test('active rules are grouped by area, MUST first, with custom rules last', () => {
    const groups = activeRules(normalize({ domains: ['core', 'hr'], custom: [{ d: 'hr', l: 'must', x: 'Mine.' }, { d: 'sales', x: 'Hidden, area is off.' }] }));
    assert.deepEqual(groups.map((g) => g.domain.id), ['core', 'hr']);
    for (const g of groups) {
        const levels = g.rules.map((r) => r.l);
        assert.deepEqual(levels, [...levels].sort((a, b) => (a === b ? 0 : a === 'must' ? -1 : 1)));
    }
    const mine = groups[1].rules.filter((r) => r.custom);
    assert.deepEqual(mine.map((r) => [r.id, r.cov]), [['custom.hr.1', 'instructed']]);
});

test('stats add up', () => {
    const s = stats(normalize(FULL));
    assert.equal(s.total, s.must + s.should);
    assert.equal(s.total, s.enforced + s.instructed + s.attested);
    assert.equal(s.total, RULES.length);
});

test('compact keeps only what differs from the defaults', () => {
    assert.deepEqual(compact({}), { v: 1 });
    assert.deepEqual(compact({ org: 'X', strictness: 'balanced' }), { v: 1, org: 'X' });
});

test('tokens round-trip, including non-ASCII text', () => {
    const cfg = normalize({ ...FULL, org: 'Café 合同会社', custom: [{ d: 'hr', x: 'Señor, naïve: "quotes" & <tags>.' }] });
    assert.deepEqual(decode(encode(cfg)), cfg);
    assert.match(encode(cfg), /^[A-Za-z0-9_-]+$/, 'token is URL and shell safe');
    assert.equal(encode({}), 'eyJ2IjoxfQ');
});

test('decode finds the configuration in JSON, a command or a link', () => {
    const cfg = normalize(FULL);
    assert.deepEqual(decode(JSON.stringify(cfg)), cfg);
    assert.deepEqual(decode(cliCommand(cfg, { base: 'https://example.org/k/' })), cfg);
    assert.deepEqual(decode(`https://example.org/builder.html#c=${encode(cfg)}`), cfg);
    assert.deepEqual(decode(cliCommand({}, { base: 'https://example.org' })), normalize({}), 'the shortest token');
});

for (const [bad, message] of [['', /Empty/], ['   ', /Empty/], ['!!!', /No configuration/], ['hello world', /No configuration/], ['eyJhIjoxfQ', /Unsupported/], ['eyJ2Ijo5fQ', /Unsupported/], ['eyJub3QganNvbg', /not valid/]]) {
    test(`decode rejects ${JSON.stringify(bad)}`, () => {
        assert.throws(() => decode(bad), message);
    });
}

test('random configurations survive normalize, encode and decode', () => {
    let seed = 42;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const pick = (arr) => arr.filter(() => rnd(2));
    for (let i = 0; i < 200; i++) {
        const cfg = normalize({
            org: ['', 'Org', 'Ünïcode'][rnd(3)],
            strictness: STRICTNESS[rnd(3)].id,
            domains: pick(DOMAINS.map((d) => d.id)),
            on: pick(RULES.map((r) => r.id)).slice(0, 5),
            off: pick(RULES.map((r) => r.id)).slice(0, 5),
            terms: pick(['Falcon', 'Kite', 'Zed']),
            custom: pick([{ d: 'hr', x: 'One.' }, { d: 'core', l: 'should', x: 'Two.' }])
        });
        assert.deepEqual(decode(encode(cfg)), cfg);
        const s = stats(cfg);
        assert.equal(s.total, s.enforced + s.instructed + s.attested);
    }
});
