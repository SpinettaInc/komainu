// Japanese: the catalog, the generated files, the templates, the quiz and the
// pages under /ja/. English output is covered by the other test files.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { RULES, DOMAINS, STRICTNESS, TARGETS, PRESETS, REDACT_CLASSES } from '../src/core/catalog.js';
import { normalize, decode, encode, activeRules, renderText } from '../src/core/config.js';
import { generate, rulesMarkdown } from '../src/core/generate.js';
import { agentPrompt, bashScript } from '../src/core/commands.js';
import { parseRules, areaId } from '../src/core/import.js';
import { policyTemplates, templateRules, templateCsv } from '../src/core/templates.js';
import { buildQuiz, quizHtml, quizMarkdown, quizCsv, quizLink, parseQuizLink } from '../src/core/quiz.js';
import { SCENARIOS } from '../src/core/scenarios.js';
import { JA_SCENARIOS } from '../src/core/ja-scenarios.js';
import { LANGS, LANG_NAMES, langOf, text, domainIn, strictnessIn, targetIn, presetIn, redactIn, coverageIn, ruleIn, scenarioIn, JA_RULES } from '../src/core/i18n.js';
import { PAGES as JA_PAGES, toJapanese } from '../scripts/ja-pages.mjs';
import { FULL, root, site, read, loadPage, run, tmp } from './helpers.mjs';

const JAPANESE = /[぀-ヿ一-鿿]/;
const slots = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const JA = { ...FULL, lang: 'ja' };

// ── catalog ─────────────────────────────────────────────────────────────────
test('languages: English and Japanese, and anything else falls back to English', () => {
    assert.deepEqual(LANGS, ['en', 'ja']);
    assert.equal(LANG_NAMES.ja, '日本語');
    assert.equal(langOf('ja'), 'ja');
    assert.equal(langOf('fr'), 'en');
    assert.equal(langOf(undefined), 'en');
    assert.equal(normalize({ lang: 'xx' }).lang, 'en');
    assert.equal(decode(encode({ lang: 'ja' })).lang, 'ja');
});

test('every rule has a Japanese title and text with the same placeholders', () => {
    assert.deepEqual(Object.keys(JA_RULES).sort(), RULES.map((r) => r.id).sort());
    for (const rule of RULES) {
        const ja = ruleIn('ja', rule);
        assert.match(ja.t, JAPANESE, rule.id);
        assert.match(ja.x, JAPANESE, rule.id);
        assert.deepEqual(slots(ja.x), slots(rule.x), `${rule.id} keeps its placeholders`);
        assert.equal(ja.l, rule.l);
        assert.equal(ruleIn('en', rule), rule);
    }
});

test('every area, level, target, template, class and coverage label has a Japanese name', () => {
    for (const d of DOMAINS) assert.match(domainIn('ja', d.id).name + domainIn('ja', d.id).blurb, JAPANESE, d.id);
    for (const s of STRICTNESS) assert.match(strictnessIn('ja', s.id).name, JAPANESE, s.id);
    for (const x of TARGETS) assert.ok(targetIn('ja', x.id).name && targetIn('ja', x.id).hint, x.id);
    assert.match(TARGETS.map((x) => targetIn('ja', x.id).hint).join(' '), JAPANESE);
    for (const p of PRESETS) assert.match(presetIn('ja', p.id).name, JAPANESE, p.id);
    for (const c of REDACT_CLASSES) assert.match(redactIn('ja', c.id).name, JAPANESE, c.id);
    for (const k of ['enforced', 'instructed', 'attested']) assert.match(coverageIn('ja', k).name, JAPANESE, k);
    assert.equal(domainIn('en', 'hr').name, DOMAINS.find((d) => d.id === 'hr').name);
    assert.equal(domainIn('ja', 'hr').id, 'hr', 'the id and the other fields are kept');
    assert.equal(coverageIn('en', 'enforced').name, 'Enforced');
});

test('every quiz scenario has a Japanese version with the same shape', () => {
    assert.deepEqual(Object.keys(JA_SCENARIOS).sort(), Object.keys(SCENARIOS).sort());
    for (const id of Object.keys(SCENARIOS)) {
        const en = SCENARIOS[id];
        const ja = scenarioIn('ja', id);
        assert.deepEqual(Object.keys(ja).sort(), Object.keys(en).sort(), id);
        for (const key of Object.keys(en)) {
            if (Array.isArray(en[key])) assert.equal(ja[key].length, en[key].length, `${id}.${key}`);
            if (typeof en[key] === 'string') assert.match(ja[key], JAPANESE, `${id}.${key}`);
        }
        assert.equal(scenarioIn('en', id), en);
    }
});

test('the two wording tables have the same entries', () => {
    const shape = (o) => Object.entries(o).map(([k, v]) => `${k}:${typeof v === 'object' && !Array.isArray(v) ? `{${shape(v)}}` : typeof v}`).sort().join(',');
    assert.equal(shape(text('ja')), shape(text('en')));
    assert.equal(text('de'), text('en'));
});

// ── generated files ─────────────────────────────────────────────────────────
test('ja: the rules file is written in Japanese and keeps ids and placeholders out of sight', () => {
    const md = rulesMarkdown(normalize(JA));
    assert.match(md, /^## .*AI/);
    assert.match(md, /- 必須: /);
    assert.match(md, /- 推奨: /);
    assert.ok(!/\{\w+\}/.test(md), 'every placeholder is filled in');
    assert.ok(!/- MUST: |- SHOULD: /.test(md));
    assert.ok(!md.includes('Project Falcon'), 'sensitive names stay out');
});

test('ja: every generated document is in Japanese, and machine files are unchanged', () => {
    const en = generate({ ...FULL, lang: 'en' });
    const ja = generate(JA);
    assert.deepEqual(ja.map((f) => f.path), en.map((f) => f.path), 'the same files either way');
    for (const f of ja) {
        if (/\.(md|mdc)$/.test(f.path)) assert.match(f.content, JAPANESE, f.path);
    }
    const same = (p) => assert.equal(ja.find((f) => f.path === p).content, en.find((f) => f.path === p).content, p);
    same('.mcp.json');
    assert.equal(JSON.parse(ja.find((f) => f.path === 'komainu.json').content).lang, 'ja');
    assert.equal(JSON.parse(en.find((f) => f.path === 'komainu.json').content).lang, undefined, 'English is the default and is left out');
    const policy = ja.find((f) => f.path.endsWith('ai-acceptable-use-policy.md')).content;
    assert.match(policy, /\| 必須 \|/);
    assert.match(policy, /強制/);
    assert.ok(!/\{\w+\}/.test(policy));
});

test('ja: defaults for the contact, tools and route are worded in Japanese', () => {
    const cfg = normalize({ lang: 'ja', domains: ['core', 'data'], strictness: 'strict' });
    for (const group of activeRules(cfg)) {
        assert.match(group.domain.name, JAPANESE);
        for (const r of group.rules) assert.ok(!/\{\w+\}/.test(r.x), r.id);
    }
    assert.match(renderText('{contact} / {tools} / {local}', cfg), JAPANESE);
    assert.equal(renderText('{contact}', { ...cfg, contact: 'AI desk' }), 'AI desk');
});

test('ja: the agent prompt and the offline installer carry the Japanese files', () => {
    assert.match(agentPrompt(JA), /komainu-guardrails スキル/);
    assert.match(agentPrompt(JA, { base: 'https://example.test' }), /https:\/\/example\.test/);
    assert.match(agentPrompt({ lang: 'en' }), /^Use the komainu-guardrails skill/);
    assert.match(bashScript(JA), /必須/);
});

// ── templates and import ────────────────────────────────────────────────────
test('ja: templates are named in Japanese and download in Japanese', () => {
    const all = policyTemplates('ja');
    assert.equal(all.length, policyTemplates().length);
    for (const tpl of all) assert.match(tpl.name, JAPANESE, tpl.id);
    const csv = templateCsv('governance', 'ja');
    assert.match(csv.split('\n')[0], /^id,area,level,title,rule,source$/, 'column names stay in English');
    assert.match(csv, JAPANESE);
    assert.equal(templateCsv('nope', 'ja'), null);
});

for (const tpl of policyTemplates('ja')) {
    test(`ja: the "${tpl.id}" template imports back with nothing changed`, () => {
        const res = parseRules(templateCsv(tpl.id, 'ja'), { name: 'policy.csv', lang: 'ja' });
        assert.deepEqual(res.rules, [], 'no row is taken for an edited rule');
        assert.deepEqual(res.on.sort(), templateRules(tpl.id).map((r) => r.id).sort());
        assert.deepEqual(res.skipped, []);
    });
}

test('ja: area names, levels and messages are understood and given in Japanese', () => {
    assert.equal(areaId('人事'), 'hr');
    assert.equal(areaId('法務・コンプライアンス'), 'legal');
    const res = parseRules('rule,level,area\n"業績データに AI を使う前に承認を得る。",必須,人事\n"社内のスタイルガイドを優先する。",推奨,マーケティング\n"あ",必須,人事\n', { lang: 'ja' });
    assert.deepEqual(res.rules.map((r) => [r.d, r.l]), [['hr', 'must'], ['marketing', 'should']]);
    assert.match(res.skipped[0].reason, JAPANESE);
    assert.match(parseRules('', { lang: 'ja' }).notes[0], JAPANESE);
    assert.match(parseRules('{', { name: 'x.json', lang: 'ja' }).notes[0], JAPANESE);
    assert.match(parseRules('rule,area\n"何かのルールを決めておく。",宇宙\n', { lang: 'ja' }).notes.join(' '), /宇宙/);
});

// ── quiz ────────────────────────────────────────────────────────────────────
test('ja: the quiz is in Japanese in every format', () => {
    const ja = buildQuiz(JA, { count: 20, seed: 'x' });
    const en = buildQuiz({ ...FULL, lang: 'en' }, { count: 20, seed: 'x' });
    assert.equal(ja.lang, 'ja');
    assert.equal(ja.total, en.total);
    for (const q of ja.questions) {
        assert.match(q.prompt, JAPANESE, `question ${q.n}`);
        assert.match(q.why, JAPANESE, `question ${q.n}`);
        assert.ok(q.options.length >= 2 && q.answer < q.options.length);
        assert.ok(!/\{\w+\}/.test(q.prompt + q.options.join('') + q.why), 'no placeholder is left');
    }
    const html = quizHtml(ja);
    assert.match(html, /<html lang="ja">/);
    assert.match(html, /答え合わせをする/);
    assert.match(quizMarkdown(ja), JAPANESE);
    assert.equal(quizCsv(ja).split('\n')[0], quizCsv(en).split('\n')[0], 'column names stay in English');
});

test('ja: a quiz link keeps the language', () => {
    const link = quizLink(JA, { count: 5 }, 'https://example.test/ja');
    assert.match(link, /^https:\/\/example\.test\/ja\/quiz\.html#/);
    const { cfg, count } = parseQuizLink(link);
    assert.equal(cfg.lang, 'ja');
    assert.equal(buildQuiz(cfg, { count }).lang, 'ja');
});

// ── interface wording ───────────────────────────────────────────────────────
const web = (name) => fs.readFileSync(path.join(root, 'src', 'web', name), 'utf8');
const unquote = (s) => s.replace(/\\'/g, "'");
const dictionary = new Map([...web('ui.js').matchAll(/^ {4}'((?:[^'\\]|\\.)*)': '((?:[^'\\]|\\.)*)',?$/gm)].map((m) => [unquote(m[1]), unquote(m[2])]));

test('every interface string has a Japanese entry, and no entry is unused', () => {
    const used = new Set();
    for (const file of ['builder.js', 'templates.js', 'quiz.js', 'dom.js']) {
        const source = web(file);
        for (const m of source.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) used.add(unquote(m[1]));
        for (const m of source.matchAll(/\bcount\([^,]+, '(\w+)'\)/g)) {
            used.add(`{n} ${m[1]}`);
            used.add(`{n} ${m[1]}s`);
        }
    }
    assert.ok(used.size > 150);
    assert.deepEqual([...used].filter((k) => !dictionary.has(k)), [], 'strings without a Japanese entry');
    assert.deepEqual([...dictionary.keys()].filter((k) => !used.has(k)), [], 'entries no page uses');
});

test('each Japanese interface string keeps the slots of the English one', () => {
    for (const [en, ja] of dictionary) {
        assert.deepEqual(slots(ja), slots(en), en);
        assert.ok(ja.trim().length > 0, en);
    }
});

// ── pages ───────────────────────────────────────────────────────────────────
const PAGES = ['index.html', 'builder.html', 'templates.html', 'quiz.html'];
// Product, standard and file names that are the same in both languages.
const PROPER = /^(NIST AI RMF|EU AI ACT|macOS \/ Linux)$/;

for (const page of PAGES) {
    test(`ja/${page}: Japanese, locked down, and no English sentence left behind`, () => {
        const html = read('ja', page);
        assert.match(html, /<html lang="ja">/);
        assert.match(html, /default-src 'none'/);
        assert.ok(!/__[A-Z_]+__/.test(html.split('<script')[0]), 'no unreplaced build placeholder');
        const prose = html.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code[\s\S]*?<\/code>/g, '');
        const texts = [...prose.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim())
            .concat([...prose.matchAll(/ (?:aria-label|title|data-enforced|data-instructed|data-attested)="([^"]+)"/g)].map((m) => m[1]))
            .concat([...prose.matchAll(/<meta (?:name="description"|property="og:(?:title|description)") content="([^"]+)"/g)].map((m) => m[1]));
        const english = texts.filter((s) => /[A-Za-z]{2,} [A-Za-z]{2,} [A-Za-z]{2,}/.test(s) && !PROPER.test(s));
        assert.deepEqual(english, []);
        assert.match(html.match(/<title>([^<]+)<\/title>/)[1], JAPANESE);
    });

    test(`ja/${page}: every local link and asset exists`, () => {
        const html = read('ja', page);
        const refs = [...html.matchAll(/(?:href|src)="([^"#:]+)(?:#[^"]*)?"/g)].map((m) => m[1]);
        assert.ok(refs.length > 2);
        for (const ref of new Set(refs)) assert.ok(fs.existsSync(path.join(site('ja'), ref)), `ja/${page} → ${ref}`);
        const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
        for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(target), `#${target}`);
    });

    test(`ja/${page}: the same structure as the English page`, () => {
        const skeleton = (html) => [...html.replace(/<a [^>]*hreflang[^>]*>[^<]*<\/a>/g, '').matchAll(/<(\/?[a-z0-9]+)(?:[^>]*? id="([^"]+)")?/g)].map((m) => m[1] + (m[2] ? `#${m[2]}` : '')).join(' ');
        assert.equal(skeleton(read('ja', page)), skeleton(read(page)));
    });
}

for (const page of ['index.html', 'builder.html', 'templates.html']) {
    test(`${page}: each language links to the other`, () => {
        assert.ok(read(page).includes(`href="ja/${page}" lang="ja" hreflang="ja"`));
        assert.ok(read(page).includes(`<link rel="alternate" hreflang="ja" href="ja/${page}">`));
        assert.ok(read('ja', page).includes(`href="../${page}" lang="en" hreflang="en"`));
        assert.ok(read('ja', page).includes(`<link rel="alternate" hreflang="en" href="../${page}">`));
    });
}

test('a page fragment that no longer matches the English page stops the build', () => {
    assert.throws(() => toJapanese('quiz.html', '<html lang="en"><title>Something else</title>'), /no longer contains/);
    for (const [name, pairs] of Object.entries(JA_PAGES)) {
        for (const [en, ja] of pairs) assert.notEqual(en, ja, `${name}: ${en.slice(0, 40)}`);
    }
});

test('ja builder: the interface is in Japanese and new guardrails are written in Japanese', () => {
    const p = loadPage('ja/builder.html');
    assert.equal(p.$('.view-head h1').textContent, 'テンプレートから始める');
    assert.equal(p.$$('.nav-item').length, 4 + DOMAINS.length + 1);
    assert.equal(p.$('.nav-item[data-view="area:hr"] span').textContent, '人事');
    assert.match(p.$('#top-count').textContent, /件のルール · \d+ 個のファイル/);
    const cmd = p.$('#panel pre').textContent;
    assert.match(cmd, /^curl -fsSLo komainu\.mjs http:\/\/localhost:4173\/komainu\.mjs && node komainu\.mjs apply /, 'the CLI is fetched from the site root');
    assert.equal(decode(cmd.split(' ').pop()).lang, 'ja');

    p.$('.nav-item[data-view="area:core"]').click();
    assert.match(p.$('#rules .rule .t').textContent, JAPANESE);
    assert.match(p.$('#rules .rule .x').textContent, JAPANESE);
    assert.equal(p.$('#rules .rule .lvl').textContent, '必須');

    p.$('#tab-files').click();
    assert.match(p.$('#panel pre').textContent, /"lang": "ja"/);
    p.$('#tab-quiz').click();
    assert.match(p.$('#quiz-open').getAttribute('href'), /^http:\/\/localhost:4173\/ja\/quiz\.html#/);
    assert.match(p.$('#quiz-summary').textContent, /問/);
});

test('ja builder: the language of the generated files can be changed on its own', () => {
    const p = loadPage('ja/builder.html');
    p.$('.nav-item[data-view="org"]').click();
    const pick = p.$('#f-lang');
    assert.deepEqual([...pick.options].map((o) => o.value), ['en', 'ja']);
    assert.equal(pick.value, 'ja');
    pick.value = 'en';
    p.fire(pick, 'change');
    assert.equal(decode(p.$('#panel pre').textContent.split(' ').pop()).lang, 'en');
    assert.equal(p.$('.view-head h1').textContent, '組織について', 'the interface stays in Japanese');

    const en = loadPage('builder.html');
    en.$('.nav-item[data-view="org"]').click();
    assert.equal(en.$('#f-lang').value, 'en');
    en.$('#f-lang').value = 'ja';
    en.fire(en.$('#f-lang'), 'change');
    en.$('#tab-files').click();
    en.$$('#file-tree button').find((b) => b.textContent === 'AGENTS.md').click();
    assert.match(en.$('#panel pre').textContent, /- 必須: /);
});

test('ja builder: import reads a Japanese file and reports in Japanese', () => {
    const p = loadPage('ja/builder.html');
    p.$('.nav-item[data-view="import"]').click();
    p.type('#rules-text', 'rule,level,area\n"業績データに AI を使う前に承認を得る。",必須,人事\n');
    p.$('#rules-parse').click();
    assert.match(p.$('#rules-preview .sum').textContent, /独自のルールが1 件のルール見つかりました: 1 人事/);
    p.$('#tpl-download').click();
    assert.equal(p.state.downloads.length, 1);
});

test('ja templates: names, rules and links are in Japanese', () => {
    const p = loadPage('ja/templates.html', { hash: '#area-health' });
    assert.equal(p.$('#tpl-name').textContent, domainIn('ja', 'health').name);
    assert.match(p.$('.rules-table tbody strong').textContent, JAPANESE);
    assert.equal(decode(p.$('#tpl-open').getAttribute('href')).lang, 'ja');
    assert.equal(parseQuizLink(p.$('#tpl-quiz-open').getAttribute('href')).cfg.lang, 'ja');
    assert.match(p.$('#tpl-count').textContent, /\{contact\}/, 'the braces in the note are shown as written');
});

test('ja landing: commands point at the site root, and the demo is in Japanese', async () => {
    const p = loadPage('ja/index.html');
    assert.equal(p.$('#install-cmd').textContent, 'curl -fsSLo komainu.mjs http://localhost:4173/komainu.mjs && node komainu.mjs init');
    assert.match(p.$('#p-web pre').textContent, /http:\/\/localhost:4173\/ja\/builder\.html/);
    assert.match(p.$('[data-pane="0"]').textContent, JAPANESE);
    p.$('[data-mode="attested"]').click();
    assert.match(p.$('#demo-note').textContent, /宣誓ルール/);
    const button = p.$('[data-copy="#install-cmd"]');
    button.click();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(button.textContent, 'コピーしました');
});

test('the quiz page follows the language of the quiz, and explains a bad link in the language of the page', () => {
    const made = loadPage('quiz.html', { hash: '#' + quizLink(JA, { count: 5 }).split('#')[1] });
    assert.equal(made.$('#quiz-root').lang, 'ja');
    assert.equal(made.$('#check').textContent, '答え合わせをする');
    assert.equal(made.$$('#questions fieldset').length, 5);
    made.$('#check').click();
    assert.match(made.$('#score').textContent, /5 問中 0 問正解、未回答 5 問です。/);

    const broken = loadPage('ja/quiz.html', { hash: '#nothing' });
    assert.equal(broken.$('#quiz-title').textContent, 'このリンクにクイズはありません');
    assert.match(broken.$('#quiz-lede').textContent, JAPANESE);
    assert.ok(broken.$('#quiz-actions').hidden);
});

test('the Japanese standalone builder is one self-contained file', () => {
    const html = read('komainu-standalone-ja.html');
    assert.match(html, /<html lang="ja">/);
    assert.ok(!html.includes('assets/') && !html.includes('href="index.html"') && !html.includes('hreflang'));
    assert.match(html, /script-src 'sha256-[A-Za-z0-9+/=]+'/);
    assert.ok(!read('komainu-standalone.html').includes('hreflang'));
});

// ── CLI ─────────────────────────────────────────────────────────────────────
test('cli: --lang ja writes Japanese files and remembers the language', () => {
    const dir = tmp();
    const applied = run(['apply', encode({ domains: ['core', 'hr'] }), '--lang', 'ja', '--dir', dir]);
    assert.equal(applied.status, 0, applied.stderr);
    assert.match(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), /- 必須: /);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'komainu.json'), 'utf8')).lang, 'ja');
    assert.equal(run(['status', '--dir', dir]).status, 0, 'the saved language is used from then on');
    assert.match(run(['quiz', '--format', 'md', '--dir', dir]).stdout, JAPANESE);
    assert.match(run(['quiz', '--format', 'md', '--lang', 'en', '--dir', dir]).stdout, /^# /);
    assert.ok(!JAPANESE.test(run(['quiz', '--format', 'md', '--lang', 'en', '--dir', dir]).stdout.split('\n')[0]));
});

test('cli: templates print in Japanese, and import reads them back', () => {
    const dir = tmp();
    assert.match(run(['template', '--list', '--lang', 'ja']).stdout, /人事/);
    const csv = run(['template', 'area-hr', '--lang', 'ja']).stdout;
    assert.match(csv, JAPANESE);
    fs.writeFileSync(path.join(dir, 'policy.csv'), csv);
    run(['apply', encode({ lang: 'ja' }), '--dir', dir]);
    const res = run(['import', 'policy.csv', '--dir', dir], { cwd: dir });
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'komainu.json'), 'utf8')).custom || [], [], 'unchanged rows stay catalog rules');
});

test('cli: an unknown language is refused', () => {
    const res = run(['template', '--list', '--lang', 'xx']);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /--lang must be one of: en, ja/);
});
