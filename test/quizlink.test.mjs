// The quiz page and the links that open it.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

import { DOMAINS, PRESETS } from '../src/core/catalog.js';
import { normalize } from '../src/core/config.js';
import { buildQuiz, quizConfig, quizLink, parseQuizLink, quizHtml } from '../src/core/quiz.js';
import { policyTemplates } from '../src/core/templates.js';
import { loadPage, FULL, tmp, run } from './helpers.mjs';

const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const BASE = 'https://example.org/k';
const fragment = (link) => link.slice(link.indexOf('#'));

// ── Links ───────────────────────────────────────────────────────────────────
test('a quiz link points at quiz.html and keeps everything after the #', () => {
    const link = quizLink({ org: 'Example Org' }, { count: 15 }, `${BASE}/`);
    assert.match(link, /^https:\/\/example\.org\/k\/quiz\.html#c=[A-Za-z0-9_-]+&n=15$/);
    assert.ok(!link.split('#')[0].includes('?'), 'nothing is put in the query string');
    assert.match(quizLink({}, {}), /^quiz\.html#c=eyJ2IjoxfQ&n=10$/, 'with no site, the link is relative');
});

test('a quiz link leaves out sensitive names, tools and the local route', () => {
    const cfg = { ...FULL, tools: 'Tool A', local: 'the on-prem endpoint', terms: ['Project Falcon', 'Client Zed'] };
    const back = parseQuizLink(quizLink(cfg, {}, BASE)).cfg;
    assert.deepEqual([back.terms, back.tools, back.local], [[], '', '']);
    assert.ok(!Buffer.from(quizLink(cfg, {}, BASE).split('c=')[1].split('&')[0], 'base64url').toString().includes('Falcon'));
    assert.deepEqual(quizConfig(cfg).domains, normalize(cfg).domains);
});

test('a link opens exactly the quiz it was made from', () => {
    const cases = [
        [{ org: 'Example Org', domains: ['core', 'hr'] }, { count: 10 }],
        [FULL, { count: 30, seed: 'week 2 / B&C' }],
        [{ strictness: 'strict', domains: ['core', 'health'] }, { count: 12, only: ['health'] }],
        [{ custom: [{ d: 'core', l: 'should', x: 'Prefer the house style, "always".' }], terms: ['Falcon'] }, { count: 20, seed: 'x' }]
    ];
    for (const [cfg, options] of cases) {
        const opened = parseQuizLink(quizLink(cfg, options, BASE));
        assert.deepEqual(buildQuiz(opened.cfg, opened), buildQuiz(cfg, options));
        assert.equal(opened.seed, options.seed || '');
        assert.deepEqual(opened.only, options.only);
    }
});

test('the link and the downloaded file hold the same questions', () => {
    const cfg = { org: 'Example Org', terms: ['Project Falcon'], domains: ['core', 'coding'] };
    const opened = parseQuizLink(quizLink(cfg, { count: 10 }, BASE));
    assert.equal(quizHtml(buildQuiz(opened.cfg, opened)), quizHtml(buildQuiz(cfg, { count: 10 })));
});

test('parseQuizLink accepts a full link or a bare fragment, and cleans its input', () => {
    const link = quizLink({ org: 'Example Org' }, { count: 5 }, BASE);
    assert.equal(parseQuizLink(link).cfg.org, 'Example Org');
    assert.equal(parseQuizLink(fragment(link)).count, 5);
    assert.equal(parseQuizLink(fragment(link).slice(1)).count, 5);
    const odd = parseQuizLink('#c=eyJ2IjoxfQ&n=9999&a=hr,nope,sales&junk');
    assert.deepEqual([odd.count, odd.only], [100, ['hr', 'sales']]);
    assert.equal(parseQuizLink('#c=eyJ2IjoxfQ&n=abc').count, 10);
    assert.equal(parseQuizLink('#c=eyJ2IjoxfQ&a=nope').only, undefined);
});

for (const [bad, message] of [['', /no quiz in it/], ['#n=10', /no quiz in it/], ['https://example.org/quiz.html', /no quiz in it/], ['#c=!!!', /No configuration|not valid/], ['#c=eyJ2Ijo5fQ', /Unsupported/]]) {
    test(`parseQuizLink rejects ${JSON.stringify(bad)}`, () => assert.throws(() => parseQuizLink(bad), message));
}

// ── The quiz page ───────────────────────────────────────────────────────────
function openQuiz(cfg, options) {
    const page = loadPage('quiz.html', { hash: fragment(quizLink(cfg, options)) });
    page.window.scrollTo = () => {};
    page.answer = (n, index) => { page.$$(`input[name="q${n}"]`)[index].checked = true; };
    return page;
}

test('quiz page: shows the quiz named by the link', () => {
    const cfg = { org: 'Example Org', domains: ['core', 'hr'] };
    const quiz = buildQuiz(cfg, { count: 10 });
    const p = openQuiz(cfg, { count: 10 });
    assert.equal(p.document.title, 'AI guardrails quiz (Example Org)');
    assert.equal(p.$('#quiz-title').textContent, 'AI guardrails quiz (Example Org)');
    assert.equal(p.$('#quiz-kicker').textContent, 'Training quiz · 10 questions');
    assert.equal(p.$$('fieldset').length, 10);
    assert.equal(p.$('#quiz-actions').hidden, false);
    for (const [i, q] of quiz.questions.entries()) {
        const set = p.$$('fieldset')[i];
        assert.ok(set.querySelector('legend').textContent.endsWith(q.prompt));
        assert.deepEqual([...set.querySelectorAll('label span')].map((s) => s.textContent), q.options);
    }
});

test('quiz page: scores, explains and resets like the downloaded file', () => {
    const cfg = { org: 'Example Org' };
    const quiz = buildQuiz(cfg, { count: 10 });
    const p = openQuiz(cfg, { count: 10 });
    const file = new JSDOM(quizHtml(quiz), { runScripts: 'dangerously', url: 'file:///tmp/quiz.html' });
    file.window.scrollTo = () => {};
    const f = (sel) => [...file.window.document.querySelectorAll(sel)];

    const [first, second] = quiz.questions;
    p.answer(first.n, first.answer);
    p.answer(second.n, (second.answer + 1) % second.options.length);
    f(`input[name="q${first.n}"]`)[first.answer].checked = true;
    f(`input[name="q${second.n}"]`)[(second.answer + 1) % second.options.length].checked = true;
    p.$('#check').click();
    f('#check')[0].click();

    assert.equal(p.$('#score').textContent, 'You got 1 of 10 right, with 8 not answered.');
    assert.equal(p.$('#score').textContent, f('#score')[0].textContent, 'the same score line');
    assert.deepEqual(p.$$('.why').map((w) => w.textContent), f('.why').map((w) => w.textContent), 'the same reasons');
    assert.deepEqual(p.$$('label').map((l) => l.className), f('label').map((l) => l.className), 'the same marking');
    assert.deepEqual(p.$$('.mark').map((m) => m.textContent), f('.mark').map((m) => m.textContent));
    assert.equal(p.document.activeElement, p.$('#score'), 'focus moves to the score');

    p.$('#again').click();
    assert.deepEqual([p.$('#score').textContent, p.$$('input:checked').length, p.$$('.mark').length], ['', 0, 0]);
    assert.ok(p.$$('.why').every((w) => w.hidden));
});

test('quiz page: a perfect paper', () => {
    const quiz = buildQuiz(FULL, { count: 20, seed: 'a' });
    const p = openQuiz(FULL, { count: 20, seed: 'a' });
    for (const q of quiz.questions) p.answer(q.n, q.answer);
    p.$('#check').click();
    assert.equal(p.$('#score').textContent, 'You got 20 of 20 right.');
    assert.equal(p.$$('label.wrong').length, 0);
});

test('quiz page: an area quiz stays in its area', () => {
    const p = openQuiz({ strictness: 'strict', domains: ['core', 'health'] }, { count: 12, only: ['health'] });
    assert.equal(p.$('#quiz-title').textContent, 'AI guardrails quiz: Health & care');
    assert.equal(p.$$('fieldset').length, 12);
});

for (const [label, hash, pattern] of [
    ['no link at all', '', /This link has no quiz in it/],
    ['a broken link', '#c=!!!', /No configuration found/],
    ['an area that is off', '#c=eyJ2IjoxfQ&a=hr', /an area with no rules switched on/]
]) {
    test(`quiz page: ${label} gets an explanation and a way forward`, () => {
        const p = loadPage('quiz.html', { hash });
        assert.equal(p.$('#quiz-title').textContent, 'There is no quiz in this link');
        assert.match(p.$('#quiz-lede').textContent, pattern);
        assert.deepEqual(p.$$('#quiz-lede a').map((a) => a.getAttribute('href')), ['builder.html', 'templates.html']);
        assert.equal(p.$('#quiz-actions').hidden, true);
        assert.equal(p.$$('fieldset').length, 0);
    });
}

test('quiz page: markup in a rule stays text', () => {
    const evil = '<img src=x onerror="window.pwned = 1"> must stay text.';
    const p = openQuiz({ org: '<b>Org</b>', domains: ['core'], strictness: 'advisory', custom: [{ d: 'core', x: evil }] }, { count: 60 });
    assert.equal(p.window.pwned, undefined);
    assert.equal(p.$$('#quiz-root img, #quiz-root b').length, 0);
    assert.ok(p.$('#quiz').textContent.includes('<img src=x'));
});

test('quiz page: no axe violations, with a quiz, after checking, and with no quiz', async () => {
    const audit = async (page) => {
        page.window.eval(AXE);
        const result = await page.window.axe.run(page.document, { rules: { 'color-contrast': { enabled: false } } });
        return Array.from(result.violations, (v) => `${v.id}: ${Array.from(v.nodes, (n) => n.target.join(' ')).slice(0, 2).join(' | ')}`);
    };
    const p = openQuiz(FULL, { count: 10 });
    assert.deepEqual(await audit(p), []);
    p.answer(1, 0);
    p.$('#check').click();
    assert.deepEqual(await audit(p), []);
    assert.deepEqual(await audit(loadPage('quiz.html')), []);
    assert.equal(p.$$('h1').length, 1);
});

// ── Where the links are offered ─────────────────────────────────────────────
test('builder: the quiz tab offers a link that opens the same quiz', () => {
    const cfg = { org: 'Example Org', domains: ['core', 'hr'], terms: ['Project Falcon'] };
    const b = loadPage('builder.html', { hash: `#c=${Buffer.from(JSON.stringify({ v: 1, ...cfg })).toString('base64url')}` });
    b.$('#tab-quiz').click();
    const link = b.$$('#panel .codebox').find((c) => c.querySelector('.bar span').textContent === 'Quiz link').querySelector('pre').textContent;
    assert.match(link, /^http:\/\/localhost:4173\/quiz\.html#c=/);
    assert.equal(b.$('#quiz-open').getAttribute('href'), link);
    assert.equal(b.$('#quiz-open').getAttribute('rel'), 'noopener');
    const opened = parseQuizLink(link);
    assert.deepEqual(buildQuiz(opened.cfg, opened), buildQuiz(cfg, { count: 10 }));
    assert.deepEqual(opened.cfg.terms, [], 'sensitive names stay out of the link');
    b.$('#quiz-count').value = '20';
    b.fire(b.$('#quiz-count'), 'change');
    b.$('#quiz-shuffle').click();
    const again = parseQuizLink(b.$('#quiz-open').getAttribute('href'));
    assert.deepEqual([again.count, again.seed], [20, '1'], 'the link follows the options');
});

for (const t of policyTemplates()) {
    test(`templates: "${t.name}" has a link to take its quiz`, () => {
        const p = loadPage('templates.html', { hash: `#${t.id}` });
        const opened = parseQuizLink(p.$('#tpl-quiz-open').getAttribute('href'));
        const quiz = buildQuiz(opened.cfg, opened);
        assert.equal(quiz.total, Math.min(15, quiz.total));
        assert.ok(quiz.total >= 6);
        if (t.kind === 'area') assert.ok(quiz.questions.every((q) => q.area === t.id.replace(/^area-/, '')));
        const quizPage = loadPage('quiz.html', { hash: fragment(p.$('#tpl-quiz-open').getAttribute('href')) });
        assert.equal(quizPage.$$('fieldset').length, quiz.total);
    });
}

test('komainu quiz --url prints the link for a site', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'komainu.json'), JSON.stringify({ v: 1, org: 'Example Org', domains: ['core', 'hr'], terms: ['Project Falcon'] }));
    const out = run(['quiz', '--url', 'https://example.org/k/', '--count', '15', '--area', 'hr', '--seed', 'w2', '--dir', dir]).stdout.trim();
    assert.match(out, /^https:\/\/example\.org\/k\/quiz\.html#c=[A-Za-z0-9_-]+&n=15&s=w2&a=hr$/);
    const opened = parseQuizLink(out);
    assert.deepEqual([opened.cfg.org, opened.cfg.terms, opened.only], ['Example Org', [], ['hr']]);
});

test('every template and area yields a link short enough to send', () => {
    for (const p of PRESETS) assert.ok(quizLink(p.cfg, { count: 15 }, BASE).length < 500, p.name);
    for (const d of DOMAINS) assert.ok(quizLink({ strictness: 'strict', domains: ['core', d.id] }, { count: 15, only: [d.id] }, BASE).length < 300, d.id);
});
