// Builds a training quiz from the rules in a configuration, and renders it as
// a self-contained HTML page, as Markdown or as CSV. Pure: no I/O.
//
// The same configuration and seed always give the same quiz, so a team can be
// sent one file and a second, different one later by changing the seed.

import { COVERAGE, DOMAINS, VERSION } from './catalog.js';
import { normalize, activeRules, encode, decode } from './config.js';
import { SCENARIOS } from './scenarios.js';

export const QUIZ_SIZES = [5, 10, 15, 20, 30];

// The parts of a configuration that decide the questions. Sensitive names,
// the approved-tools list and the local route are left out, so a quiz link
// never carries them.
const QUIZ_FIELDS = ['org', 'strictness', 'domains', 'on', 'off', 'custom', 'contact', 'levels', 'hostedMax', 'redact', 'targets'];

/** The configuration reduced to what a quiz needs. */
export function quizConfig(input) {
    const cfg = normalize(input);
    return normalize(Object.fromEntries(QUIZ_FIELDS.map((k) => [k, cfg[k]])));
}

/**
 * A link that opens the quiz on the site's quiz page. Everything sits after
 * the # in the address, which browsers do not send to servers.
 */
export function quizLink(input, { count = 10, seed = '', only } = {}, base = '') {
    const parts = [`c=${encode(quizConfig(input))}`, `n=${count}`];
    if (seed) parts.push(`s=${encodeURIComponent(seed)}`);
    if (only && only.length) parts.push(`a=${only.join(',')}`);
    return `${String(base).replace(/\/+$/, '')}${base ? '/' : ''}quiz.html#${parts.join('&')}`;
}

/** The reverse of quizLink: a link or its fragment → { cfg, count, seed, only }. Throws when there is no quiz in it. */
export function parseQuizLink(link) {
    const fragment = String(link || '').split('#').pop();
    const params = new Map(fragment.split('&').map((p) => p.split('=')).filter((p) => p.length === 2));
    if (!params.has('c')) throw new Error('This link has no quiz in it');
    const cfg = decode(params.get('c'));
    const count = Math.min(100, Math.max(1, parseInt(params.get('n'), 10) || 10));
    const areas = (params.get('a') || '').split(',').filter((id) => DOMAINS.some((d) => d.id === id));
    return { cfg, count, seed: decodeURIComponent(params.get('s') || ''), only: areas.length ? areas : undefined };
}

/** A small seeded random generator (mulberry32 over a string hash). */
function seeded(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return () => {
        h = (h + 0x6D2B79F5) | 0;
        let t = h;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle(list, rnd) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Puts the right answer among the wrong ones in a random position. */
function question(rnd, base, right, wrong) {
    const options = shuffle([right, ...wrong], rnd);
    return { ...base, options, answer: options.indexOf(right) };
}

const quote = (text) => `"${text}"`;

function forRule(rule, all, rnd) {
    const base = { rule: rule.id, area: rule.d };
    const why = `${rule.t ? `${rule.t}. ` : ''}${rule.x}`;
    const out = [];
    const scenario = !rule.custom && SCENARIOS[rule.id];
    if (scenario) out.push(question(rnd, { ...base, type: 'scenario', prompt: scenario.s, why }, scenario.a, scenario.w));
    const others = shuffle(all.filter((r) => r.id !== rule.id && r.t && r.x !== rule.x), rnd);
    const near = [...others.filter((r) => r.d === rule.d), ...others.filter((r) => r.d !== rule.d)].slice(0, 3);
    if (rule.t && near.length === 3) {
        out.push(question(rnd, { ...base, type: 'statement', prompt: `Which of these is the rule ${quote(rule.t)}?`, why }, rule.x, near.map((r) => r.x)));
    }
    const levels = ['MUST: it is not negotiable.', 'SHOULD: it applies unless there is a documented reason.'];
    out.push({ ...base, type: 'level', prompt: `Is this rule a MUST or a SHOULD? ${quote(rule.x)}`, options: levels, answer: rule.l === 'must' ? 0 : 1, why: `This is a ${rule.l.toUpperCase()} rule.` });
    if (rule.t) {
        const kinds = Object.keys(COVERAGE);
        out.push({ ...base, type: 'upheld', prompt: `How is the rule ${quote(rule.t)} upheld here?`, options: kinds.map((k) => `${COVERAGE[k].name}: ${COVERAGE[k].blurb}`), answer: kinds.indexOf(rule.cov), why: `It is ${COVERAGE[rule.cov].name.toLowerCase()}. ${COVERAGE[rule.cov].blurb}` });
    }
    return out;
}

function forConfig(cfg, rnd) {
    const base = { rule: null, area: 'core', type: 'setup' };
    const out = [];
    const contact = cfg.contact || 'the AI governance owner';
    if (cfg.levels.length > 2) {
        out.push({ ...base, prompt: 'What is the highest data classification that may go into a hosted AI tool?', options: [...cfg.levels], answer: cfg.levels.indexOf(cfg.hostedMax), why: `Hosted AI services may receive data up to and including ${cfg.hostedMax}.` });
    }
    out.push(question(rnd, { ...base, prompt: 'Sensitive data was pasted into an AI tool by mistake. Who do you tell?', why: `Questions and incidents go to ${contact}.` },
        `${contact.charAt(0).toUpperCase()}${contact.slice(1)}, promptly.`, ['Nobody. Delete the chat and move on.', 'The AI vendor\'s support desk only.', 'Whoever asks about it later.']));
    if (cfg.redact.includes('secrets')) {
        out.push(question(rnd, { ...base, prompt: 'A password appears in text you need to share with an assistant. What goes in its place?', why: 'Credentials are replaced with [REDACTED_SECRET] or an environment-variable reference.' },
            '[REDACTED_SECRET]', ['The first four characters of the password.', 'The password written backwards.', 'Nothing. The assistant needs the real value.']));
    }
    return out;
}

/**
 * config → { title, org, total, questions: [{ n, rule, area, type, prompt, options, answer, why }] }
 *
 * `count` is the number of questions wanted; fewer come back when the rules
 * cannot fill it. `only` limits the quiz to some areas. `seed` changes the draw.
 */
export function buildQuiz(input, { count = 10, seed = '', only } = {}) {
    const cfg = quizConfig(input);
    const rnd = seeded(`${encode(cfg)}|${seed}|${(only || []).join(',')}`);
    const rules = activeRules(cfg).flatMap((g) => g.rules);
    const inScope = shuffle(rules.filter((r) => !only || only.includes(r.d)), rnd);
    // Rules with a written scenario come first: they make the better questions.
    const chosen = [...inScope.filter((r) => SCENARIOS[r.id]), ...inScope.filter((r) => !SCENARIOS[r.id])];
    const perRule = chosen.map((r) => forRule(r, rules, rnd));
    const setup = only ? [] : shuffle(forConfig(cfg, rnd), rnd).slice(0, Math.max(1, Math.round(count / 5)));

    // One question per rule first, best kind first. More kinds follow only when
    // the rules run out, so a short quiz still covers as many rules as it can.
    const picked = [];
    for (let round = 0; picked.length < count - setup.length && perRule.some((q) => q.length > round); round++) {
        for (const kinds of perRule) {
            if (kinds[round] && picked.length < count - setup.length) picked.push(kinds[round]);
        }
    }
    const questions = shuffle([...setup, ...picked], rnd).slice(0, count).map((q, i) => ({ n: i + 1, ...q }));
    const areas = only ? only.map((id) => DOMAINS.find((d) => d.id === id).name).join(', ') : '';
    return {
        title: `AI guardrails quiz${areas ? `: ${areas}` : ''}`,
        org: cfg.org,
        contact: cfg.contact || 'the AI governance owner',
        total: questions.length,
        questions
    };
}

const LETTERS = 'ABCDEFGH';
const areaName = (id) => DOMAINS.find((d) => d.id === id).name;

export function quizMarkdown(quiz) {
    const out = [
        `# ${quiz.title}${quiz.org ? ` (${quiz.org})` : ''}`,
        '',
        `${quiz.total} questions on the AI guardrails in force. Choose one answer for each. The answers and the reasons are at the end.`,
        ''
    ];
    for (const q of quiz.questions) {
        out.push(`## Question ${q.n}`, '', q.prompt, '', ...q.options.map((o, i) => `- ${LETTERS[i]}. ${o}`), '');
    }
    out.push('## Answers', '', '| Question | Answer | Why |', '|---|---|---|');
    for (const q of quiz.questions) out.push(`| ${q.n} | ${LETTERS[q.answer]} | ${q.why.replace(/\|/g, '\\|')} |`);
    out.push('', `Questions about a rule go to ${quiz.contact}.`, '');
    return out.join('\n');
}

const cell = (v) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** One row per question, for spreadsheets, form builders and learning systems. */
export function quizCsv(quiz) {
    const width = Math.max(...quiz.questions.map((q) => q.options.length), 2);
    const header = ['number', 'area', 'question', ...Array.from({ length: width }, (_, i) => `option_${LETTERS[i].toLowerCase()}`), 'answer', 'explanation', 'rule'];
    const rows = quiz.questions.map((q) => [q.n, areaName(q.area), q.prompt, ...Array.from({ length: width }, (_, i) => q.options[i] ?? ''), LETTERS[q.answer], q.why, q.rule ?? '']);
    return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

const STYLE = `
:root { color-scheme: dark; --bg: #0B0D10; --card: #13161B; --border: #262C36; --strong: #343B47; --ink: #E9ECF1; --muted: #A7B0BE; --accent: #2DD4BF; --amber: #FFB454; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 40px 20px 80px; }
h1 { font-size: clamp(28px, 5vw, 40px); line-height: 1.1; letter-spacing: -.02em; margin: 0 0 12px; }
.kicker { margin: 0 0 12px; font: 13px ui-monospace, Menlo, Consolas, monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.lede, .fine { color: var(--muted); margin: 0 0 24px; }
.fine { font-size: 14px; margin-top: 32px; }
fieldset { margin: 0 0 16px; padding: 20px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; min-width: 0; }
legend { float: left; width: 100%; padding: 0; margin-bottom: 12px; font-weight: 600; }
legend span { display: block; margin-bottom: 4px; font: 12px ui-monospace, Menlo, Consolas, monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-weight: 400; }
label { clear: both; display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; margin-top: 8px; cursor: pointer; }
label:hover { border-color: var(--strong); }
input[type="radio"] { flex: none; width: 20px; height: 20px; margin: 2px 0 0; accent-color: var(--accent); }
label.right { border-color: var(--accent); }
label.wrong { border-color: var(--amber); }
.mark { margin-left: auto; padding-left: 12px; font: 12px ui-monospace, Menlo, Consolas, monospace; font-style: normal; letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; color: var(--accent); }
label.wrong .mark { color: var(--amber); }
.why { clear: both; margin: 12px 0 0; padding-top: 12px; border-top: 1px solid var(--border); color: var(--muted); font-size: 15px; }
.why strong { color: var(--ink); }
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-top: 24px; }
button { min-height: 48px; padding: 0 22px; border: 0; border-radius: 8px; background: var(--accent); color: var(--bg); font: 600 16px system-ui, sans-serif; cursor: pointer; }
button.plain { background: transparent; color: var(--ink); border: 1px solid var(--strong); }
#score { font-weight: 600; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
@media print { body { background: #fff; color: #000; } fieldset { background: #fff; border-color: #999; break-inside: avoid; } .bar, .fine { display: none; } .kicker { color: #000; } .lede, .why { color: #333; } }
`;

// Runs in the quiz file itself. It reads the questions from the page, builds
// the form with text nodes only, and keeps the answers in the page: nothing is
// stored or sent.
const SCRIPT = `
(function () {
    var quiz = JSON.parse(document.getElementById('quiz-data').textContent);
    var form = document.getElementById('quiz');
    var list = document.getElementById('questions');
    var score = document.getElementById('score');
    function el(tag, text, cls) { var e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; }
    quiz.questions.forEach(function (q) {
        var set = el('fieldset');
        var legend = el('legend');
        legend.appendChild(el('span', 'Question ' + q.n + ' of ' + quiz.total));
        legend.appendChild(document.createTextNode(q.prompt));
        set.appendChild(legend);
        q.options.forEach(function (option, i) {
            var label = el('label');
            var input = el('input');
            input.type = 'radio';
            input.name = 'q' + q.n;
            input.value = String(i);
            label.appendChild(input);
            label.appendChild(el('span', option));
            set.appendChild(label);
        });
        var why = el('p', '', 'why');
        why.hidden = true;
        set.appendChild(why);
        list.appendChild(set);
    });
    // The words carry the result, so colour is never the only cue.
    function clearMarks(scope) {
        var marks = scope.querySelectorAll('.mark');
        for (var i = 0; i < marks.length; i++) marks[i].remove();
    }
    form.addEventListener('submit', function (event) {
        event.preventDefault();
        var right = 0;
        var blank = 0;
        quiz.questions.forEach(function (q, index) {
            var set = list.children[index];
            var picked = set.querySelector('input:checked');
            var labels = set.querySelectorAll('label');
            clearMarks(set);
            for (var i = 0; i < labels.length; i++) labels[i].className = i === q.answer ? 'right' : '';
            labels[q.answer].appendChild(el('em', 'Correct answer', 'mark'));
            if (!picked) blank++;
            else if (Number(picked.value) === q.answer) right++;
            else {
                picked.parentNode.className = 'wrong';
                picked.parentNode.appendChild(el('em', 'Your answer', 'mark'));
            }
            var why = set.querySelector('.why');
            why.textContent = '';
            why.appendChild(el('strong', picked && Number(picked.value) === q.answer ? 'Correct. ' : 'The answer is ' + 'ABCDEFGH'.charAt(q.answer) + '. '));
            why.appendChild(document.createTextNode(q.why));
            why.hidden = false;
        });
        score.textContent = 'You got ' + right + ' of ' + quiz.total + ' right' + (blank ? ', with ' + blank + ' not answered.' : '.');
        score.focus();
    });
    document.getElementById('again').addEventListener('click', function () {
        form.reset();
        clearMarks(form);
        var marked = form.querySelectorAll('label');
        for (var i = 0; i < marked.length; i++) marked[i].className = '';
        var notes = form.querySelectorAll('.why');
        for (var j = 0; j < notes.length; j++) notes[j].hidden = true;
        score.textContent = '';
        window.scrollTo(0, 0);
    });
})();
`;

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One HTML file with no outside resources. It works from a shared drive or an email attachment. */
export function quizHtml(quiz) {
    const data = JSON.stringify({ total: quiz.total, questions: quiz.questions.map(({ n, prompt, options, answer, why }) => ({ n, prompt, options, answer, why })) }).replace(/</g, '\\u003c');
    const title = `${quiz.title}${quiz.org ? ` (${quiz.org})` : ''}`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="generator" content="Komainu ${VERSION}">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<p class="kicker">Training quiz · ${quiz.total} questions</p>
<h1>${escapeHtml(title)}</h1>
<p class="lede">These questions come from the AI guardrails in force. Choose one answer for each, then check your answers to see the reason behind every one.</p>
<form id="quiz" novalidate>
<div id="questions"></div>
<div class="bar">
<button type="submit" id="check">Check my answers</button>
<button type="button" class="plain" id="again">Start again</button>
<span id="score" role="status" tabindex="-1"></span>
</div>
</form>
<p class="fine">Your answers stay in this page. Nothing is recorded or sent. Questions about a rule go to ${escapeHtml(quiz.contact)}.</p>
</main>
<script type="application/json" id="quiz-data">${data}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

export const QUIZ_FORMATS = {
    html: { name: 'HTML', file: 'ai-guardrails-quiz.html', type: 'text/html', render: quizHtml },
    md: { name: 'Markdown', file: 'ai-guardrails-quiz.md', type: 'text/markdown', render: quizMarkdown },
    csv: { name: 'CSV', file: 'ai-guardrails-quiz.csv', type: 'text/csv', render: quizCsv }
};
