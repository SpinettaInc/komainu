import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

import { DOMAINS, PRESETS, RULES, COVERAGE, ruleById } from '../src/core/catalog.js';
import { normalize, isActive, renderText } from '../src/core/config.js';
import { parseCsv } from '../src/core/import.js';
import { SCENARIOS } from '../src/core/scenarios.js';
import { buildQuiz, quizConfig, quizHtml, quizMarkdown, quizCsv, QUIZ_FORMATS, QUIZ_SIZES } from '../src/core/quiz.js';
import { FULL, tmp, run } from './helpers.mjs';

const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// ── Scenarios ───────────────────────────────────────────────────────────────
for (const [id, s] of Object.entries(SCENARIOS)) {
    test(`scenario for ${id} is well formed`, () => {
        assert.ok(ruleById(id), 'the rule exists');
        assert.ok(s.s.length >= 40 && s.s.length <= 260, 'situation length');
        assert.equal(s.w.length, 3, 'three wrong answers');
        const options = [s.a, ...s.w];
        assert.equal(new Set(options).size, 4, 'four different options');
        for (const o of options) assert.ok(o.length >= 10 && o.length <= 130 && /[.?]$/.test(o), o);
        assert.ok(s.a.length <= Math.max(...s.w.map((w) => w.length)) * 2.2, 'the right answer is not given away by its length');
    });
}

test('every area has at least two scenarios', () => {
    for (const d of DOMAINS) assert.ok(Object.keys(SCENARIOS).filter((id) => id.startsWith(`${d.id}.`)).length >= 2, d.id);
});

// ── Building ────────────────────────────────────────────────────────────────
function wellFormed(quiz) {
    assert.equal(quiz.total, quiz.questions.length);
    assert.deepEqual(quiz.questions.map((q) => q.n), quiz.questions.map((_, i) => i + 1));
    for (const q of quiz.questions) {
        assert.ok(['scenario', 'statement', 'level', 'upheld', 'setup'].includes(q.type));
        assert.ok(q.prompt.length > 15, q.prompt);
        assert.ok(q.options.length >= 2 && q.options.length <= 8);
        assert.equal(new Set(q.options).size, q.options.length, `options differ: ${q.prompt}`);
        assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, 'the answer is one of the options');
        assert.ok(q.why.length > 10);
        assert.ok(DOMAINS.some((d) => d.id === q.area));
    }
}

test('the same configuration and seed give the same quiz', () => {
    assert.deepEqual(buildQuiz(FULL, { count: 20 }), buildQuiz(FULL, { count: 20 }));
    assert.deepEqual(buildQuiz(FULL, { count: 20, seed: 'a' }), buildQuiz(FULL, { count: 20, seed: 'a' }));
});

test('another seed, or another configuration, gives a different quiz', () => {
    const prompts = (q) => q.questions.map((x) => x.prompt).join('|');
    assert.notEqual(prompts(buildQuiz(FULL, { count: 20 })), prompts(buildQuiz(FULL, { count: 20, seed: 'week-2' })));
    assert.notEqual(prompts(buildQuiz({ domains: ['core', 'hr'] }, { count: 20 })), prompts(buildQuiz({ domains: ['core', 'sales'] }, { count: 20 })));
});

for (const count of QUIZ_SIZES) {
    test(`a quiz of ${count} questions is well formed`, () => {
        const quiz = buildQuiz(FULL, { count });
        assert.equal(quiz.total, count);
        wellFormed(quiz);
    });
}

for (const p of PRESETS) {
    test(`quiz for "${p.name}" asks only about rules that are on`, () => {
        const cfg = normalize(p.cfg);
        const quiz = buildQuiz(cfg, { count: 30 });
        wellFormed(quiz);
        assert.ok(quiz.total >= 20);
        for (const q of quiz.questions.filter((x) => x.rule)) {
            assert.ok(isActive(ruleById(q.rule), cfg), `${q.rule} is active`);
            assert.ok(cfg.domains.includes(q.area));
        }
    });
}

test('a short quiz prefers written situations and covers different rules', () => {
    const quiz = buildQuiz({}, { count: 10 });
    assert.ok(quiz.questions.filter((q) => q.type === 'scenario').length >= 6);
    const rules = quiz.questions.map((q) => q.rule).filter(Boolean);
    assert.equal(new Set(rules).size, rules.length, 'one question per rule until the rules run out');
    assert.ok(quiz.questions.some((q) => q.type === 'setup'));
});

test('a rule gets a second kind of question only when the rules run out', () => {
    const cfg = { domains: ['core'], strictness: 'advisory' };
    const few = buildQuiz(cfg, { count: 8 });
    assert.equal(new Set(few.questions.map((q) => q.rule).filter(Boolean)).size, few.questions.filter((q) => q.rule).length);
    const many = buildQuiz(cfg, { count: 30 });
    assert.equal(many.total, 30);
    assert.ok(new Set(many.questions.map((q) => q.type)).size >= 4, 'every kind of question appears');
});

test('asking for more questions than exist returns what there is', () => {
    const quiz = buildQuiz({ domains: ['core'], strictness: 'advisory' }, { count: 500 });
    assert.ok(quiz.total > 20 && quiz.total < 500);
    wellFormed(quiz);
});

test('the right answer of a scenario is the written one, wherever it lands', () => {
    const quiz = buildQuiz(FULL, { count: 30 });
    const scenarios = quiz.questions.filter((q) => q.type === 'scenario');
    assert.ok(scenarios.length >= 20);
    for (const q of scenarios) {
        assert.equal(q.options[q.answer], SCENARIOS[q.rule].a);
        assert.equal(q.prompt, SCENARIOS[q.rule].s);
        assert.ok(q.why.includes(ruleById(q.rule).t));
    }
    assert.ok(new Set(scenarios.map((q) => q.answer)).size >= 3, 'the answer is not always in the same place');
});

test('generated questions have the right answers', () => {
    const quiz = buildQuiz(FULL, { count: 100, seed: 'x' });
    const groups = Object.groupBy(quiz.questions, (q) => q.type);
    // Rule text is shown with its placeholders filled in from the configuration.
    for (const q of groups.statement) assert.equal(q.options[q.answer], renderText(ruleById(q.rule).x, quizConfig(FULL)));
    for (const q of groups.level || []) assert.equal(q.answer, ruleById(q.rule).l === 'must' ? 0 : 1);
    for (const q of groups.upheld || []) assert.ok(Object.keys(COVERAGE)[q.answer]);
    assert.ok(groups.statement.length > 20);
});

test('setup questions reflect the configuration', () => {
    const quiz = buildQuiz({ levels: ['Open', 'Staff', 'Secret'], hostedMax: 'Staff', contact: 'the security team' }, { count: 30 });
    const level = quiz.questions.find((q) => q.prompt.includes('highest data classification'));
    assert.deepEqual([level.options, level.options[level.answer]], [['Open', 'Staff', 'Secret'], 'Staff']);
    const who = quiz.questions.find((q) => q.prompt.includes('Who do you tell'));
    assert.equal(who.options[who.answer], 'The security team, promptly.');
    assert.equal(quiz.contact, 'the security team');
    const none = buildQuiz({ redact: [], levels: ['A', 'B'] }, { count: 30 });
    assert.ok(!none.questions.some((q) => q.prompt.includes('password')), 'no secrets question when that class is off');
    assert.ok(!none.questions.some((q) => q.prompt.includes('highest data classification')), 'two levels make a poor question');
});

test('your own rules are quizzed too', () => {
    const quiz = buildQuiz({ domains: ['core'], strictness: 'advisory', custom: [{ d: 'core', l: 'should', x: 'Prefer the house style guide for every draft.' }] }, { count: 60 });
    const mine = quiz.questions.filter((q) => q.rule?.startsWith('custom.'));
    assert.ok(mine.length >= 1);
    assert.deepEqual([mine[0].type, mine[0].answer], ['level', 1]);
});

for (const d of DOMAINS) {
    test(`a quiz limited to "${d.name}" stays in that area`, () => {
        const quiz = buildQuiz({ strictness: 'strict', domains: ['core', d.id] }, { count: 12, only: [d.id] });
        wellFormed(quiz);
        assert.ok(quiz.total >= 6);
        assert.ok(quiz.questions.every((q) => q.area === d.id && q.type !== 'setup'));
        assert.equal(quiz.title, `AI guardrails quiz: ${d.name}`);
    });
}

test('an area that is off gives an empty quiz', () => {
    assert.equal(buildQuiz({ domains: ['core'] }, { only: ['hr'] }).total, 0);
});

// ── Markdown and CSV ────────────────────────────────────────────────────────
test('Markdown lists every question and an answer key', () => {
    const quiz = buildQuiz({ org: 'Example Org' }, { count: 10 });
    const md = quizMarkdown(quiz);
    assert.match(md, /^# AI guardrails quiz \(Example Org\)\n/);
    assert.equal(md.match(/^## Question \d+$/gm).length, 10);
    assert.match(md, /^## Answers$/m);
    assert.equal(md.match(/^\| \d+ \| [A-H] \| /gm).length, 10);
    assert.ok(md.indexOf('## Answers') > md.lastIndexOf('## Question'), 'the answers come after the questions');
    for (const q of quiz.questions) assert.ok(md.includes(`| ${q.n} | ${'ABCDEFGH'[q.answer]} |`));
});

test('CSV has one row per question and parses back', () => {
    const quiz = buildQuiz(FULL, { count: 20 });
    const rows = parseCsv(quizCsv(quiz));
    assert.deepEqual(rows[0].slice(0, 3), ['number', 'area', 'question']);
    assert.equal(rows.length, 21);
    const answerCol = rows[0].indexOf('answer');
    for (const [i, q] of quiz.questions.entries()) {
        assert.equal(rows[i + 1][2], q.prompt);
        assert.equal(rows[i + 1][answerCol], 'ABCDEFGH'[q.answer]);
        assert.equal(rows[i + 1][3 + q.answer], q.options[q.answer]);
    }
});

// ── The HTML quiz file ──────────────────────────────────────────────────────
function open(quiz) {
    const dom = new JSDOM(quizHtml(quiz), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'file:///tmp/quiz.html' });
    const { document } = dom.window;
    dom.window.scrollTo = () => {};
    const answer = (n, index) => { document.querySelectorAll(`input[name="q${n}"]`)[index].checked = true; };
    return { dom, document, answer, $: (s) => document.querySelector(s), $$: (s) => [...document.querySelectorAll(s)] };
}

test('the HTML quiz is one self-contained, locked-down file', () => {
    const html = quizHtml(buildQuiz(FULL, { count: 10 }));
    assert.match(html, /^<!DOCTYPE html>\n<html lang="en">/);
    assert.match(html, /connect-src 'none'/);
    assert.match(html, /form-action 'none'/);
    assert.ok(!/(src|href)="/.test(html), 'no outside resource of any kind');
    assert.ok(!/https?:\/\//.test(html));
    for (const banned of ['localStorage', 'sessionStorage', 'document.cookie', 'fetch(', 'XMLHttpRequest', 'sendBeacon']) assert.ok(!html.includes(banned), banned);
    assert.ok(html.length < 60000);
});

test('the HTML quiz shows every question with its options', () => {
    const quiz = buildQuiz(FULL, { count: 10 });
    const page = open(quiz);
    assert.equal(page.$$('fieldset').length, 10);
    assert.equal(page.$('h1').textContent, 'AI guardrails quiz (Example Org)');
    for (const [i, q] of quiz.questions.entries()) {
        const set = page.$$('fieldset')[i];
        assert.ok(set.querySelector('legend').textContent.endsWith(q.prompt));
        assert.deepEqual([...set.querySelectorAll('label span')].map((s) => s.textContent), q.options);
        assert.equal(set.querySelector('.why').hidden, true, 'reasons are hidden until checked');
    }
});

test('the HTML quiz scores a perfect paper', () => {
    const quiz = buildQuiz(FULL, { count: 10 });
    const page = open(quiz);
    for (const q of quiz.questions) page.answer(q.n, q.answer);
    page.$('#check').click();
    assert.equal(page.$('#score').textContent, 'You got 10 of 10 right.');
    assert.equal(page.$$('label.wrong').length, 0);
    assert.equal(page.$$('label.right').length, 10);
    assert.ok(page.$$('.why').every((w) => !w.hidden && w.textContent.startsWith('Correct. ')));
});

test('the HTML quiz marks wrong and missing answers and gives the reason', () => {
    const quiz = buildQuiz(FULL, { count: 10 });
    const page = open(quiz);
    const [first, second] = quiz.questions;
    page.answer(first.n, first.answer);
    page.answer(second.n, (second.answer + 1) % second.options.length);
    page.$('#check').click();
    assert.equal(page.$('#score').textContent, 'You got 1 of 10 right, with 8 not answered.');
    assert.equal(page.$$('label.wrong').length, 1);
    assert.equal(page.$('label.wrong .mark').textContent, 'Your answer', 'the result is written out in words as well as shown by colour');
    assert.equal(page.$$('label.right .mark').length, 10);
    assert.ok(page.$$('label.right .mark').every((m) => m.textContent === 'Correct answer'));
    const why = page.$$('.why')[1].textContent;
    assert.ok(why.startsWith(`The answer is ${'ABCDEFGH'[second.answer]}. `) && why.endsWith(second.why));
    page.$('#again').click();
    assert.equal(page.$('#score').textContent, '');
    assert.equal(page.$$('input:checked').length, 0);
    assert.ok(page.$$('.why').every((w) => w.hidden));
    assert.equal(page.$$('.mark').length, 0);
});

test('markup in a rule cannot run inside the quiz file', () => {
    const evil = '</script><script>window.pwned = 1</script><img src=x onerror="window.pwned = 1"> must stay text.';
    const quiz = buildQuiz({ org: '<b>Org</b>', domains: ['core'], strictness: 'advisory', custom: [{ d: 'core', x: evil }] }, { count: 60 });
    assert.ok(quiz.questions.some((q) => q.prompt.includes('</script>')));
    const page = open(quiz);
    assert.equal(page.dom.window.pwned, undefined);
    assert.equal(page.$$('img, b').length, 0);
    assert.equal(page.$('h1').textContent, 'AI guardrails quiz (<b>Org</b>)');
    assert.equal(page.$$('fieldset').length, quiz.total, 'the page still built every question');
});

test('the HTML quiz has no axe violations, before and after checking', async () => {
    const quiz = buildQuiz(FULL, { count: 10 });
    const page = open(quiz);
    page.dom.window.eval(AXE);
    const audit = async () => {
        const result = await page.dom.window.axe.run(page.document, { rules: { 'color-contrast': { enabled: false } } });
        return Array.from(result.violations, (v) => `${v.id}: ${Array.from(v.nodes, (n) => n.target.join(' ')).slice(0, 2).join(' | ')}`);
    };
    assert.deepEqual(await audit(), []);
    page.answer(1, 0);
    page.$('#check').click();
    assert.deepEqual(await audit(), []);
    assert.equal(page.$$('fieldset').every((f) => f.querySelector('legend')), true);
    assert.equal(page.$('#score').getAttribute('role'), 'status');
});

// ── Formats and CLI ─────────────────────────────────────────────────────────
test('every format renders and names its file', () => {
    const quiz = buildQuiz({}, { count: 5 });
    assert.deepEqual(Object.keys(QUIZ_FORMATS), ['html', 'md', 'csv']);
    for (const f of Object.values(QUIZ_FORMATS)) {
        assert.match(f.file, /^ai-guardrails-quiz\.(html|md|csv)$/);
        assert.ok(f.render(quiz).length > 500);
    }
});

test('komainu quiz prints each format from komainu.json', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'komainu.json'), JSON.stringify({ v: 1, org: 'Example Org', domains: ['core', 'hr'] }));
    const html = run(['quiz', '--dir', dir]);
    assert.equal(html.status, 0, html.stderr);
    assert.equal(html.stdout, quizHtml(buildQuiz({ org: 'Example Org', domains: ['core', 'hr'] }, { count: 10 })));
    assert.match(run(['quiz', '--format', 'md', '--count', '5', '--dir', dir]).stdout, /## Question 5\n[\s\S]*## Answers/);
    assert.equal(parseCsv(run(['quiz', '--format', 'csv', '--count', '7', '--dir', dir]).stdout).length, 8);
    const hr = run(['quiz', '--area', 'hr', '--format', 'md', '--dir', dir]).stdout;
    assert.match(hr, /^# AI guardrails quiz: Human resources \(Example Org\)/);
    assert.notEqual(run(['quiz', '--seed', 'b', '--format', 'md', '--dir', dir]).stdout, run(['quiz', '--format', 'md', '--dir', dir]).stdout);
});

test('komainu quiz works without komainu.json and rejects bad options', () => {
    const dir = tmp();
    assert.equal(run(['quiz', '--format', 'md', '--dir', dir]).status, 0, 'the defaults make a quiz');
    assert.match(run(['quiz', '--format', 'pdf', '--dir', dir]).stderr, /quiz format must be one of: html, md, csv/);
    assert.match(run(['quiz', '--area', 'nope', '--dir', dir]).stderr, /unknown area "nope"/);
    assert.match(run(['quiz', '--area', 'hr', '--dir', dir]).stderr, /no questions: that area has no rules switched on/);
    assert.equal(parseCsv(run(['quiz', '--format', 'csv', '--count', '0', '--dir', dir]).stdout).length, 11, 'a bad count falls back to 10');
});

test('the catalog has enough rules for the largest quiz in every template', () => {
    for (const p of PRESETS) assert.ok(RULES.filter((r) => isActive(r, normalize(p.cfg))).length >= 20, p.name);
});
