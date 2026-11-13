// Browser-level tests. Each built page is loaded into jsdom with its bundled
// script, then driven the way a visitor would drive it.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

import { DOMAINS, PRESETS, RULES, TARGETS, STRICTNESS } from '../src/core/catalog.js';
import { normalize, decode, encode, stats } from '../src/core/config.js';
import { generate } from '../src/core/generate.js';
import { parseCsv } from '../src/core/import.js';
import { policyTemplates, templateRules, templateCsv } from '../src/core/templates.js';
import { loadPage, prepare, FULL } from './helpers.mjs';

const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Runs axe on the page. Colour contrast needs real layout, so it is checked in a browser instead. */
async function violations(page) {
    page.window.eval(AXE);
    const result = await page.window.axe.run(page.document, { rules: { 'color-contrast': { enabled: false } } });
    assert.ok(result.passes.length > 10, 'axe ran its rules');
    // Copy into an array of this realm so it compares equal to [].
    return Array.from(result.violations, (v) => `${v.id}: ${Array.from(v.nodes, (n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

// ── Builder ─────────────────────────────────────────────────────────────────
function builder(opts) {
    const page = loadPage('builder.html', opts);
    const { $, $$ } = page;
    return {
        ...page,
        nav: (name) => $$('.nav-item').find((b) => b.firstChild.textContent === name).click(),
        meta: (name) => $$('.nav-item').find((b) => b.firstChild.textContent === name).querySelector('small')?.textContent,
        total: () => parseInt($('.stats .big').textContent, 10),
        tab: (name) => $(`[data-tab="${name}"]`).click(),
        command: () => { $('[data-tab="command"]').click(); return $('#panel pre').textContent; },
        config: () => { $('[data-tab="command"]').click(); return decode($('#panel pre').textContent); }
    };
}

test('builder: starts on the template view with the default configuration', () => {
    const b = builder();
    assert.equal(b.$('.nav-item[aria-current]').textContent, 'Template');
    assert.equal(b.$$('#presets .card').length, PRESETS.length);
    assert.equal(b.total(), stats(normalize({})).total);
    assert.deepEqual(b.config(), normalize({}));
    assert.equal(b.$('#top-count').textContent, `${stats(normalize({})).total} rules · ${generate({}).length} files`);
});

test('builder: the sidebar lists every area with its count', () => {
    const b = builder();
    assert.equal(b.$$('.area-row').length, DOMAINS.length);
    assert.equal(b.$$('.area-row input:disabled').length, 1, 'only the universal area is locked');
    assert.equal(b.meta('Human resources'), 'off');
    assert.match(b.meta('Coding'), /^\d+\/\d+$/);
});

for (const [i, p] of PRESETS.entries()) {
    test(`builder: template "${p.name}" loads its configuration`, () => {
        const b = builder();
        b.$$('#presets .card')[i].click();
        const cfg = b.config();
        assert.deepEqual(cfg.domains, normalize(p.cfg).domains);
        assert.equal(cfg.strictness, p.cfg.strictness);
        assert.deepEqual(cfg.targets, p.cfg.targets);
        assert.equal(b.total(), stats(normalize(p.cfg)).total);
    });
}

test('builder: a template does not inherit choices from the previous one', () => {
    const b = builder();
    const pick = (id) => b.$$('#presets .card')[PRESETS.findIndex((p) => p.id === id)].click();
    pick('public');
    assert.equal(b.config().levels[0], 'OFFICIAL');
    pick('regulated');
    assert.equal(b.config().redact.length, 6);
    pick('software');
    const cfg = b.config();
    assert.deepEqual(cfg.levels, normalize({}).levels);
    assert.deepEqual(cfg.redact, normalize({}).redact);
});

test('builder: what was typed about the organization survives a template change', () => {
    const b = builder();
    b.nav('Organization');
    b.type('#f-org', 'Example Org');
    b.nav('Template');
    b.$$('#presets .card')[1].click();
    assert.equal(b.config().org, 'Example Org');
});

test('builder: organization fields reach the configuration and keep focus while typing', () => {
    const b = builder();
    b.nav('Organization');
    const field = b.$('#f-contact');
    field.focus();
    b.type('#f-contact', 'the security team');
    assert.equal(b.document.activeElement.id, 'f-contact', 'typing does not re-render the field');
    b.type('#f-tools', 'Tool A, Tool B');
    const cfg = b.config();
    assert.deepEqual([cfg.contact, cfg.tools], ['the security team', 'Tool A, Tool B']);
});

for (const s of STRICTNESS) {
    test(`builder: strictness ${s.id} changes the rule count`, () => {
        const b = builder();
        b.nav('Organization');
        b.$(`#strictness input[value="${s.id}"]`).click();
        assert.equal(b.config().strictness, s.id);
        assert.equal(b.total(), stats(normalize({ strictness: s.id })).total);
        assert.equal(b.meta('Organization'), s.id);
    });
}

test('builder: classification levels are validated', () => {
    const b = builder();
    b.nav('Data handling');
    const levels = b.$('#f-levels');
    levels.value = 'OnlyOne';
    b.fire(levels, 'change');
    assert.equal(b.$('#f-levels').value, 'Public, Internal, Confidential, Restricted', 'the field shows what is in force');
    assert.equal(b.$('#toast').textContent, 'Enter at least two levels');
    b.$('#f-levels').value = 'Open, Staff, Secret';
    b.fire(b.$('#f-levels'), 'change');
    assert.deepEqual([...b.$('#f-hosted').options].map((o) => o.textContent), ['Open', 'Staff', 'Secret']);
    b.$('#f-hosted').value = 'Open';
    b.fire(b.$('#f-hosted'), 'change');
    assert.deepEqual([b.config().levels, b.config().hostedMax], [['Open', 'Staff', 'Secret'], 'Open']);
});

test('builder: redaction classes and sensitive names', () => {
    const b = builder();
    b.nav('Data handling');
    assert.equal(b.$$('#redact input').length, 6);
    b.$$('#redact input')[4].click();
    assert.ok(b.config().redact.includes('email'));
    b.nav('Data handling');
    b.type('#f-terms', 'Project Falcon, Client Zed\nCodename Kite');
    assert.deepEqual(b.config().terms, ['Project Falcon', 'Client Zed', 'Codename Kite']);
});

for (const t of TARGETS) {
    test(`builder: target "${t.name}" can be switched`, () => {
        const b = builder();
        b.nav('Install targets');
        const box = () => b.$$('#targets .check').find((c) => c.querySelector('span').textContent === t.name).querySelector('input');
        const was = box().checked;
        box().click();
        assert.equal(b.config().targets.includes(t.id), !was);
        b.nav('Install targets');
        box().click();
        assert.equal(b.config().targets.includes(t.id), was);
    });
}

for (const d of DOMAINS.filter((x) => !x.locked)) {
    test(`builder: area "${d.name}" turns on and off from the sidebar`, () => {
        const b = builder();
        const box = () => b.$$('.area-row').find((r) => r.textContent.startsWith(d.name)).querySelector('input');
        const was = box().checked;
        box().click();
        assert.equal(b.config().domains.includes(d.id), !was);
        box().click();
        assert.equal(b.config().domains.includes(d.id), was);
    });
}

test('builder: an area view lists its rules and toggles them', () => {
    const b = builder();
    b.nav('Coding');
    const rules = RULES.filter((r) => r.d === 'coding');
    assert.equal(b.$$('#rules .rule').length, rules.length);
    assert.equal(b.$('.view-head h1').textContent, 'Coding');
    const before = b.total();
    b.$('#r-coding-review').click();
    assert.equal(b.total(), before - 1);
    assert.ok(b.config().off.includes('coding.review'));
    assert.ok(b.$('#r-coding-review').closest('.rule').classList.contains('off'));
    b.nav('Coding');
    b.$('#r-coding-review').click();
    assert.deepEqual(b.config().off, []);
});

test('builder: a strict-only rule can be forced on', () => {
    const b = builder();
    b.nav('Coding');
    assert.equal(b.$('#r-coding-licence').checked, false);
    b.$('#r-coding-licence').click();
    assert.deepEqual(b.config().on, ['coding.licence']);
});

test('builder: filter by text and by state', () => {
    const b = builder();
    b.nav('Coding');
    const search = b.$('.search');
    search.value = 'secret';
    b.fire(search, 'input');
    assert.equal(b.$$('#rules .rule').length, 1);
    assert.equal(b.$('.toolbar .count').textContent, '1 shown');
    search.value = 'zzzz';
    b.fire(search, 'input');
    assert.equal(b.$('#rules .empty').textContent, 'No rules match.');
    search.value = '';
    b.fire(search, 'input');
    const press = (name) => b.$$('.toolbar .toggle button').find((x) => x.textContent === name).click();
    const coding = RULES.filter((r) => r.d === 'coding');
    press('must');
    assert.equal(b.$$('#rules .rule').length, coding.filter((r) => r.l === 'must').length);
    press('should');
    assert.equal(b.$$('#rules .rule').length, coding.filter((r) => r.l === 'should').length);
    press('off');
    assert.equal(b.$$('#rules .rule').length, coding.filter((r) => r.tier === 3).length);
    press('enforced');
    assert.ok(b.$$('#rules .rule').length >= 3);
    assert.equal(b.$$('.toolbar .toggle button').filter((x) => x.getAttribute('aria-pressed') === 'true').length, 1);
});

test('builder: "All on" and "Reset" act on the whole area', () => {
    const b = builder();
    b.nav('Coding');
    const btn = (label) => b.$$('.toolbar .btn').find((x) => x.textContent.startsWith(label));
    btn('All on').click();
    assert.equal(b.meta('Coding'), '12/12');
    b.nav('Coding');
    b.$('#r-coding-review').click();
    b.nav('Coding');
    btn('Reset').click();
    assert.deepEqual([b.config().on, b.config().off], [[], []]);
});

test('builder: an area that is off shows a banner and locks its rules', () => {
    const b = builder();
    b.nav('Human resources');
    assert.match(b.$('.banner').textContent, /This area is off/);
    assert.ok(b.$$('#rules input').every((i) => i.disabled));
    assert.equal(b.$('.add'), null);
    b.$('.banner button').click();
    assert.ok(b.config().domains.includes('hr'));
});

test('builder: add a rule with the button and with Enter, then remove it', () => {
    const b = builder();
    b.nav('Coding');
    const before = b.total();
    b.$('.add input').value = 'Run the linter before every commit.';
    b.$('.add select').value = 'should';
    b.$('.add button').click();
    assert.deepEqual(b.config().custom, [{ d: 'coding', l: 'should', x: 'Run the linter before every commit.' }]);
    b.nav('Coding');
    const input = b.$('.add input');
    input.value = 'Second rule.';
    input.dispatchEvent(new b.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(b.total(), before + 2);
    b.nav('Coding');
    b.$('.add button').click();
    assert.equal(b.total(), before + 2, 'an empty rule is ignored');
    b.$('.mine-rule .x-btn').click();
    assert.equal(b.total(), before + 1);
});

test('builder: text typed into a rule is shown as text', () => {
    const b = builder();
    b.nav('Coding');
    b.$('.add input').value = '<img src=x onerror="window.pwned=1"> must stay text.';
    b.$('.add button').click();
    b.nav('Coding');
    assert.equal(b.$$('.mine-rule img').length, 0);
    assert.ok(b.$('.mine-rule .x').textContent.includes('<img src=x'));
    assert.equal(b.window.pwned, undefined);
});

test('builder: the command changes shell and stays decodable', () => {
    const b = builder();
    const shell = (name) => b.$$('#panel .toggle button').find((x) => x.textContent === name).click();
    b.tab('command');
    shell('macOS / Linux');
    assert.match(b.$('#panel pre').textContent, /^curl -fsSLo komainu\.mjs http:\/\/localhost:4173\/komainu\.mjs && node komainu\.mjs apply /);
    shell('Windows');
    assert.match(b.$('#panel pre').textContent, /^Invoke-WebRequest http:\/\/localhost:4173\/komainu\.mjs/);
});

test('builder: the offline script, the agent prompt and the share link', () => {
    const b = builder();
    b.tab('script');
    assert.match(b.$('#panel pre').textContent, /^#!\/usr\/bin\/env bash/);
    b.$$('#panel .toggle button')[1].click();
    assert.match(b.$('#panel .bar span').textContent, /^install-guardrails\.ps1 · \d+ KB$/);
    b.tab('agent');
    assert.match(b.$('#panel pre').textContent, /komainu-guardrails skill/);
    b.tab('share');
    const link = b.$('#panel pre').textContent;
    assert.match(link, /^http:\/\/localhost:4173\/builder\.html#c=/);
    assert.deepEqual(decode(link), normalize({}));
    assert.equal(b.$('#panel strong'), null, 'no warning without sensitive names');
});

test('builder: sharing warns when the configuration holds sensitive names', () => {
    const b = builder({ hash: `#c=${encode({ terms: ['Project Falcon'] })}` });
    b.tab('share');
    assert.equal(b.$('#panel strong').textContent, 'Careful: ');
});

test('builder: the files tab previews exactly what would be written', () => {
    const b = builder({ hash: `#c=${encode(FULL)}` });
    b.tab('files');
    const files = generate(FULL);
    assert.deepEqual(b.$$('#file-tree button').map((x) => x.textContent), files.map((f) => f.path));
    for (const [i, f] of files.entries()) {
        b.$$('#file-tree button')[i].click();
        if (f.mode !== 'self') assert.equal(b.$('#panel pre').textContent, f.content, f.path);
    }
    assert.equal(b.$$('#file-tree [aria-current]').length, 1);
});

test('builder: "Download all" sits next to Download and Copy on the files tab', () => {
    const b = builder({ hash: `#c=${encode(FULL)}` });
    b.tab('files');
    assert.deepEqual(b.$$('#panel .codebox .bar button').map((x) => x.textContent), ['Download all', 'Download', 'Copy']);
    b.$$('#panel .codebox button').find((x) => x.textContent === 'Download all').click();
    assert.deepEqual(b.state.downloads, ['komainu-guardrails.zip']);
    const writable = generate(FULL).filter((f) => f.mode !== 'self').length;
    assert.match(b.$$('#panel p').pop().textContent, new RegExp(`saves ${writable} files as one zip`));
    assert.match(b.$$('#panel p').pop().textContent, /The copy of the CLI is not included/);
    b.tab('command');
    assert.ok(!b.$$('#panel .codebox button').some((x) => x.textContent === 'Download all'), 'only the files tab offers it');
});

test('builder: the quiz tab makes a quiz from the selected rules', () => {
    const b = builder({ hash: `#c=${encode({ org: 'Example Org', domains: ['core', 'hr'] })}` });
    b.tab('quiz');
    assert.match(b.$('#quiz-summary').textContent, /^10 questions: \d+ from written situations, \d+ generated from the rule text\. They cover \d+ rules\.$/);
    assert.deepEqual([...b.$('#quiz-count').options].map((o) => o.value), ['5', '10', '15', '20', '30']);
    b.$('#quiz-count').value = '20';
    b.fire(b.$('#quiz-count'), 'change');
    assert.match(b.$('#quiz-summary').textContent, /^20 questions/);
    const sample = b.$('#panel pre').textContent;
    b.$('#quiz-shuffle').click();
    assert.equal(b.$('#quiz-count').value, '20', 'the size survives a reshuffle');
    assert.notEqual(b.$('#panel pre').textContent, sample, 'another draw shows another sample');
    for (const id of ['quiz-html', 'quiz-md', 'quiz-csv']) b.$(`#${id}`).click();
    assert.deepEqual(b.state.downloads, ['ai-guardrails-quiz.html', 'ai-guardrails-quiz.md', 'ai-guardrails-quiz.csv']);
});

test('builder: the quiz follows the rules as they change', () => {
    const b = builder();
    b.tab('quiz');
    b.$('#quiz-count').value = '30';
    b.fire(b.$('#quiz-count'), 'change');
    const before = b.$('#quiz-summary').textContent;
    b.$$('.area-row').find((r) => r.textContent.startsWith('Human resources')).querySelector('input').click();
    assert.equal(b.$('.tabs [aria-selected="true"]').dataset.tab, 'quiz', 'the tab stays open');
    assert.notEqual(b.$('#quiz-summary').textContent, before);
});

test('builder: copy and download hand over the right text and file names', async () => {
    const b = builder();
    b.$('#top-copy').click();
    await tick();
    assert.equal(b.state.copied[0], b.command());
    b.tab('command');
    b.$$('#panel .codebox button').find((x) => x.textContent === 'Copy').click();
    await tick();
    assert.equal(b.state.copied[1], b.state.copied[0]);
    assert.equal(b.$('#toast').textContent, 'Copied');
    b.tab('script');
    b.$$('#panel .codebox button').find((x) => x.textContent === 'Download').click();
    b.tab('share');
    b.$$('#panel .codebox button').find((x) => x.textContent === 'Download').click();
    assert.deepEqual(b.state.downloads, ['install-guardrails.sh', 'komainu.json']);
});

test('builder: a very long configuration offers a file and a short command', () => {
    const custom = Array.from({ length: 200 }, (_, i) => ({ d: 'core', x: `Team rule number ${i} must be followed by every assistant here.` }));
    const b = builder({ hash: `#c=${encode({ custom })}` });
    b.tab('command');
    assert.equal(b.$('#panel strong').textContent, 'This configuration is large. ');
    assert.deepEqual(b.$$('#panel .bar span').map((s) => s.textContent), ['komainu.json', 'Terminal']);
    assert.match(b.$$('#panel pre')[1].textContent, /node komainu\.mjs apply$/);
    assert.equal(JSON.parse(b.$$('#panel pre')[0].textContent).custom.length, 200);
});

test('builder: opens a shared link, and reacts when the link changes', () => {
    const b = builder({ hash: `#c=${encode(FULL)}` });
    assert.deepEqual(b.config(), normalize(FULL));
    assert.equal(b.total(), RULES.length);
    b.window.location.hash = `#c=${encode({ org: 'Second' })}`;
    b.fire(b.window, 'hashchange');
    assert.equal(b.config().org, 'Second');
    assert.equal(builder({ hash: '#c=garbage!!' }).total(), stats(normalize({})).total, 'a bad link falls back to the defaults');
});

test('builder: an existing configuration can be pasted in three forms', () => {
    for (const text of [JSON.stringify({ v: 1, org: 'Pasted' }), `node komainu.mjs apply ${encode({ org: 'Pasted' })}`, `https://x.test/builder.html#c=${encode({ org: 'Pasted' })}`]) {
        const b = builder();
        b.$('#import-text').value = text;
        b.$('#import-btn').click();
        assert.equal(b.config().org, 'Pasted');
    }
    const bad = builder();
    bad.$('#import-text').value = 'hello world';
    bad.$('#import-btn').click();
    assert.equal(bad.$('#import-msg').textContent, 'No configuration found in input');
});

test('builder: import shows a preview before adding anything', () => {
    const b = builder();
    b.nav('Templates and import');
    const before = b.total();
    b.$('#rules-text').value = 'Requirement,Severity,Department\n"Never share salary data with an AI tool.",HIGH,People\n,low,Sales\n"Quote only list prices.",must,Sales\n';
    b.$('#rules-parse').click();
    assert.equal(b.$('#rules-preview .sum').textContent, 'Found 2 rules of your own: 1 Human resources · 1 Sales.');
    assert.deepEqual(b.$$('#rules-preview li').map((l) => l.textContent), ['Skipped 1 (no rule text): row 3.', 'Applying this also turns on: Human resources, Sales.']);
    assert.equal(b.$$('#rules-preview tbody tr').length, 2);
    assert.equal(b.total(), before, 'nothing is added yet');
    b.$$('#rules-preview button').find((x) => x.textContent === 'Add 2 rules').click();
    const cfg = b.config();
    assert.equal(cfg.custom.length, 2);
    assert.ok(cfg.domains.includes('hr') && cfg.domains.includes('sales'));
    assert.equal(b.meta('Templates and import'), '2');
});

test('builder: an import can be discarded, and unreadable input says why', () => {
    const b = builder();
    b.nav('Templates and import');
    b.$('#rules-text').value = 'Do not email source code.';
    b.$('#rules-parse').click();
    b.$$('#rules-preview button').find((x) => x.textContent === 'Discard').click();
    assert.equal(b.$('#rules-preview').children.length, 0);
    assert.equal(b.config().custom.length, 0);
    b.nav('Templates and import');
    b.$('#rules-text').value = '{"rules": [';
    b.$('#rules-parse').click();
    assert.equal(b.$('#rules-preview .sum').textContent, 'No rules could be read.');
    assert.ok(b.$('#rules-preview .sum').classList.contains('bad'));
});

test('builder: your rules are listed and can be removed one by one or all at once', () => {
    const b = builder({ hash: `#c=${encode({ custom: [{ d: 'hr', x: 'One.' }, { d: 'core', x: 'Two.' }, { d: 'core', x: 'Three.' }] })}` });
    b.nav('Templates and import');
    assert.equal(b.$$('.block tbody tr').length, 3);
    b.$$('.block tbody .x-btn')[0].click();
    assert.equal(b.config().custom.length, 2);
    b.nav('Templates and import');
    b.$('.mine button').click();
    assert.equal(b.config().custom.length, 0);
});

test('builder: every policy template can be downloaded', () => {
    const b = builder();
    b.nav('Templates and import');
    const options = [...b.$('#tpl-pick').options].map((o) => o.value);
    assert.deepEqual(options, policyTemplates().map((t) => t.id));
    assert.equal(b.$$('#tpl-pick optgroup').length, 2);
    b.$('#tpl-pick').value = 'area-health';
    b.$('#tpl-download').click();
    b.$('#rules-tpl-csv').click();
    b.$('#rules-tpl-json').click();
    assert.deepEqual(b.state.downloads, ['komainu-policy-health.csv', 'komainu-rules-blank.csv', 'komainu-rules-blank.json']);
});

test('builder: an edited template is applied, not appended', () => {
    const b = builder();
    b.nav('Templates and import');
    b.$('#rules-text').value = templateCsv('area-health').replace('A qualified clinician makes', 'The treating doctor makes').split('\n').filter((l) => !l.startsWith('health.bias')).join('\n');
    b.$('#rules-parse').click();
    assert.equal(b.$('#rules-preview .sum').textContent, 'Found 1 rule of your own: 1 Health & care.');
    assert.match(b.$('#rules-preview li').textContent, /1 was edited, and 1 not in the file is switched off/);
    b.$$('#rules-preview button').find((x) => x.textContent === 'Apply this template').click();
    const cfg = b.config();
    assert.ok(cfg.domains.includes('health'));
    assert.ok(cfg.off.includes('health.clinician-decides') && cfg.off.includes('health.bias'));
    assert.equal(cfg.custom[0].src, 'health.clinician-decides');
    b.nav('Health & care');
    assert.equal(b.$('#r-health-clinician-decides').checked, false);
    assert.match(b.$('.mine-rule .x').textContent, /^The treating doctor makes/);
});

test('builder: an untouched template only switches rules on', () => {
    const b = builder();
    b.nav('Templates and import');
    b.$('#rules-text').value = templateCsv('governance');
    b.$('#rules-parse').click();
    assert.equal(b.$('#rules-preview .sum').textContent, 'Read the template. No rule text was changed.');
    b.$$('#rules-preview button').find((x) => x.textContent === 'Apply this template').click();
    assert.equal(b.config().custom.length, 0);
    assert.ok(b.config().domains.includes('governance'));
    assert.equal(b.meta('Governance & accountability'), '17/17');
});

test('builder: the standalone file behaves the same and hides what needs the site', () => {
    const page = loadStandalone();
    assert.equal(page.$$('.nav-item').length, 4 + DOMAINS.length + 1);
    assert.match(page.$('#panel pre').textContent, /^node \.\/komainu\.mjs apply /, 'offline, the command uses a local copy');
    assert.ok(page.$$('[data-online]').every((el) => el.hidden));
});

/** The standalone file is the same builder with its script inlined, opened from disk. */
function loadStandalone() {
    const html = fs.readFileSync(new URL('../public/komainu-standalone.html', import.meta.url), 'utf8');
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
    const dom = new JSDOM(html.replace(/<script>[\s\S]*<\/script>/, ''), { url: 'file:///tmp/komainu-standalone.html', runScripts: 'outside-only', pretendToBeVisual: true });
    prepare(dom.window);
    dom.window.eval(script);
    return { $: (sel) => dom.window.document.querySelector(sel), $$: (sel) => [...dom.window.document.querySelectorAll(sel)] };
}

// ── Landing page ────────────────────────────────────────────────────────────
test('landing: commands use the address the page is served from', () => {
    const p = loadPage('index.html');
    assert.equal(p.$('#install-cmd').textContent, 'curl -fsSLo komainu.mjs http://localhost:4173/komainu.mjs && node komainu.mjs init');
    assert.ok(!p.document.body.innerHTML.includes('{{BASE}}'));
    assert.match(p.$('#p-skill pre').textContent, /curl -fsSL http:\/\/localhost:4173\/skill\/komainu-guardrails\.tar\.gz/);
});

test('landing: copy buttons copy the command next to them', async () => {
    const p = loadPage('index.html');
    p.$('[data-copy="#install-cmd"]').click();
    await tick();
    assert.equal(p.state.copied[0], p.$('#install-cmd').textContent);
    assert.equal(p.$('[data-copy="#install-cmd"]').textContent, 'Copied');
    p.$('[data-copy="#p-web pre"]').click();
    await tick();
    assert.match(p.state.copied[1], /node komainu\.mjs apply/);
});

for (const mode of ['enforced', 'instructed', 'attested']) {
    test(`landing: the demo shows a clause that is ${mode}`, () => {
        const p = loadPage('index.html');
        p.$(`[data-mode="${mode}"]`).click();
        assert.equal(p.$$('[data-mode][aria-pressed="true"]').length, 1);
        assert.equal(p.$(`[data-mode="${mode}"]`).getAttribute('aria-pressed'), 'true');
        for (let i = 0; i < 4; i++) assert.ok(p.$(`[data-pane="${i}"]`).textContent.length > 30, `pane ${i}`);
        assert.equal(p.$('#demo-note').textContent, p.$('#demo-note').getAttribute(`data-${mode}`));
        const ruleId = p.$('[data-pane="1"] .ent.rule').textContent;
        assert.ok(RULES.some((r) => r.id === ruleId), `${ruleId} is a real rule`);
    });
}

test('landing: code tabs switch with clicks and arrow keys', () => {
    const p = loadPage('index.html');
    const tabs = p.$$('.tabs [role="tab"]');
    const shown = () => p.$$('[role="tabpanel"]').filter((x) => !x.hidden).map((x) => x.id);
    assert.deepEqual(shown(), ['p-web']);
    tabs[2].click();
    assert.deepEqual(shown(), ['p-import']);
    assert.deepEqual(tabs.map((t) => t.tabIndex), [-1, -1, 0, -1, -1]);
    tabs[2].dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.deepEqual(shown(), ['p-mcp']);
    assert.equal(p.document.activeElement, tabs[3]);
    tabs[0].dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    assert.deepEqual(shown(), ['p-skill'], 'the tabs wrap around');
    for (const t of tabs) assert.ok(p.document.getElementById(t.getAttribute('aria-controls')));
});

test('landing: the example CSV on the page imports as shown', async () => {
    const p = loadPage('index.html');
    const { parseRules } = await import('../src/core/import.js');
    const csv = p.$('#p-import pre').textContent.split('\n').filter((l) => /^rule,|^"/.test(l)).join('\n');
    assert.deepEqual(parseRules(csv).rules.map((r) => r.d), ['hr', 'legal', 'marketing']);
});

// ── Templates page ──────────────────────────────────────────────────────────
test('templates: lists every template with its rule count', () => {
    const p = loadPage('templates.html');
    const all = policyTemplates();
    assert.deepEqual(p.$$('#tpl-list button').map((b) => b.dataset.id), all.map((t) => t.id));
    for (const b of p.$$('#tpl-list button')) assert.equal(b.querySelector('small').textContent, String(templateRules(b.dataset.id).length));
    assert.equal(p.$('#tpl-name').textContent, all[0].name);
});

for (const t of policyTemplates()) {
    test(`templates: "${t.name}" shows its rules and downloads its CSV`, () => {
        const p = loadPage('templates.html');
        p.$(`#tpl-list [data-id="${t.id}"]`).click();
        const rules = templateRules(t.id);
        assert.equal(p.$('#tpl-name').textContent, t.name);
        assert.equal(p.$$('.rules-table tbody tr').length, rules.length);
        assert.equal(p.$$('#tpl-list [aria-current]').length, 1);
        assert.equal(p.window.location.hash, `#${t.id}`);
        p.$('#tpl-download').click();
        p.$('#tpl-quiz').click();
        assert.deepEqual(p.state.downloads, [`komainu-policy-${t.id.replace(/^area-/, '')}.csv`, `komainu-quiz-${t.id.replace(/^area-/, '')}.html`]);
        const cfg = decode(p.$('#tpl-open').getAttribute('href'));
        for (const r of rules) assert.ok(cfg.domains.includes(r.d), `the builder link turns on ${r.d}`);
    });
}

test('templates: the file a visitor downloads has one row per rule shown', () => {
    assert.equal(parseCsv(templateCsv('governance')).length - 1, templateRules('governance').length);
});

test('templates: a link can open a template directly, and filtering narrows the table', () => {
    const p = loadPage('templates.html', { hash: '#area-health' });
    assert.equal(p.$('#tpl-name').textContent, 'Health & care');
    const filter = p.$('#tpl-filter');
    filter.value = 'clinician';
    p.fire(filter, 'input');
    assert.ok(p.$$('.rules-table tbody tr').length < templateRules('area-health').length);
    assert.match(p.$('.tpl-panel .fine').textContent, /^\d+ of 7 rules shown/);
    p.$('#tpl-filter').value = 'zzzz';
    p.fire(p.$('#tpl-filter'), 'input');
    assert.equal(p.$('.rules-table tbody td').textContent, 'No rules match.');
    assert.equal(loadPage('templates.html', { hash: '#nope' }).$('#tpl-name').textContent, policyTemplates()[0].name);
});

// ── Accessibility (structure; colour contrast is measured in a real browser) ─
for (const page of ['index.html', 'templates.html', 'builder.html']) {
    test(`accessibility: ${page} has no axe violations`, async () => {
        assert.deepEqual(await violations(loadPage(page)), []);
    });
}

for (const view of ['Organization', 'Data handling', 'Install targets', 'Coding', 'Human resources', 'Templates and import']) {
    test(`accessibility: the builder's "${view}" view has no axe violations`, async () => {
        const b = builder();
        b.nav(view);
        assert.deepEqual(await violations(b), []);
    });
}

for (const tabName of ['script', 'agent', 'files', 'quiz', 'share']) {
    test(`accessibility: the builder's "${tabName}" output has no axe violations`, async () => {
        const b = builder();
        b.tab(tabName);
        assert.deepEqual(await violations(b), []);
    });
}

test('accessibility: every page has one h1, a main landmark and a skip link', () => {
    for (const name of ['index.html', 'templates.html', 'builder.html', 'quiz.html']) {
        const p = loadPage(name);
        assert.equal(p.$$('h1').length, 1, name);
        assert.equal(p.$$('main').length, 1, name);
        const skip = p.$('a.skip');
        assert.ok(p.document.getElementById(skip.getAttribute('href').slice(1)), name);
    }
});

test('accessibility: every form control in the builder has a name', () => {
    const b = builder();
    for (const view of ['Organization', 'Data handling', 'Install targets', 'Coding', 'Templates and import']) {
        b.nav(view);
        for (const el of b.$$('main input, main select, main textarea')) {
            const named = el.getAttribute('aria-label') || (el.id && b.$(`label[for="${el.id}"]`)) || el.closest('label');
            assert.ok(named, `${view}: ${el.outerHTML.slice(0, 80)}`);
        }
    }
});

test('accessibility: the builder output tabs follow the tab pattern', () => {
    const b = builder();
    const tabs = b.$$('.tabs [role="tab"]');
    const key = (el, name) => el.dispatchEvent(new b.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    const state = () => tabs.map((t) => [t.getAttribute('aria-selected'), t.tabIndex].join());
    assert.deepEqual(state(), ['true,0', 'false,-1', 'false,-1', 'false,-1', 'false,-1', 'false,-1'], 'one tab stop');
    for (const t of tabs) assert.equal(t.getAttribute('aria-controls'), 'panel');
    key(tabs[0], 'ArrowRight');
    assert.equal(b.document.activeElement, tabs[1]);
    assert.equal(b.$('#panel').getAttribute('aria-labelledby'), 'tab-script');
    assert.match(b.$('#panel pre').textContent, /^#!\/usr\/bin\/env bash/);
    key(tabs[1], 'End');
    assert.equal(b.document.activeElement, tabs[5]);
    key(tabs[5], 'ArrowRight');
    assert.equal(b.document.activeElement, tabs[0], 'the tabs wrap around');
    key(tabs[0], 'ArrowLeft');
    assert.equal(b.document.activeElement, tabs[5]);
    key(tabs[5], 'Home');
    assert.deepEqual(state(), ['true,0', 'false,-1', 'false,-1', 'false,-1', 'false,-1', 'false,-1']);
});

test('accessibility: changing view moves focus to the new heading', () => {
    const b = builder();
    b.nav('Coding');
    assert.equal(b.document.activeElement, b.$('main h1'));
    assert.equal(b.$('main h1').textContent, 'Coding');
    assert.equal(b.$$('.nav-item[aria-current="page"]').length, 1);
});

test('accessibility: scrollable code blocks are focusable, named regions', () => {
    const b = builder();
    for (const name of ['command', 'script', 'agent', 'files', 'quiz', 'share']) {
        b.tab(name);
        for (const pre of b.$$('#panel pre')) {
            assert.equal(pre.tabIndex, 0);
            assert.equal(pre.getAttribute('role'), 'region');
            assert.ok(pre.getAttribute('aria-label').length > 2);
        }
    }
});

test('accessibility: toggles and the area list expose their state', () => {
    const b = builder();
    for (const box of b.$$('.area-row input')) assert.match(box.getAttribute('aria-label'), /^Include /);
    b.nav('Coding');
    assert.equal(b.$$('.toolbar .toggle [aria-pressed]').length, 6);
    b.tab('command');
    assert.deepEqual(b.$$('#panel .toggle button').map((x) => x.getAttribute('aria-pressed')).sort(), ['false', 'true']);
});

test('accessibility: the templates page announces a change in one sentence', () => {
    const p = loadPage('templates.html');
    p.$('#tpl-list [data-id="area-health"]').click();
    assert.equal(p.$('#tpl-status').textContent, 'Showing Health & care, 7 rules.');
    assert.equal(p.$('#tpl-status').getAttribute('role'), 'status');
    assert.equal(p.$('#tpl-panel').getAttribute('aria-live'), null, 'the whole table is not re-read');
});

test('accessibility: decorative icons are hidden and every image-like link has text', () => {
    for (const name of ['index.html', 'templates.html', 'builder.html']) {
        const p = loadPage(name);
        for (const svg of p.$$('svg')) assert.equal(svg.getAttribute('aria-hidden'), 'true', name);
        for (const a of p.$$('a')) assert.ok((a.textContent.trim() || a.getAttribute('aria-label') || '').length > 1, `${name}: ${a.outerHTML.slice(0, 60)}`);
        for (const btn of p.$$('button')) assert.ok((btn.textContent.trim() || btn.getAttribute('aria-label') || '').length > 1, name);
    }
});
