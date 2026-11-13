// Quiz page: builds the quiz named by the link and runs it in the page.
// It makes no network requests and uses no browser storage. The questions
// come from the part of the address after the #, which is never sent anywhere.
//
// The downloadable quiz file carries its own copy of this logic as text (see
// SCRIPT in ../core/quiz.js), because that file has to work on its own. The
// tests hold the two to the same behaviour.

import { buildQuiz, parseQuizLink, fillLabel } from '../core/quiz.js';
import { LANG, $, h, fill } from './dom.js';
import { t } from './ui.js';

const LETTERS = 'ABCDEFGH';

function clearMarks(scope) {
    for (const mark of scope.querySelectorAll('.mark')) mark.remove();
}

function mount(quiz) {
    // The quiz speaks the language of the guardrails it was made from.
    const L = quiz.labels;
    const title = `${quiz.title}${quiz.org ? ` (${quiz.org})` : ''}`;
    document.title = title;
    $('quiz-root').lang = quiz.lang;
    $('quiz-kicker').textContent = fillLabel(L.kicker, { total: quiz.total });
    $('quiz-title').textContent = title;
    $('quiz-lede').textContent = L.lede;
    $('quiz-fine').textContent = fillLabel(L.fine, { contact: quiz.contact });
    $('check').textContent = L.check;
    $('again').textContent = L.again;
    const form = $('quiz');
    const list = $('questions');
    fill(list, quiz.questions.map((q) => h('fieldset', {},
        h('legend', {}, h('span', {}, fillLabel(L.question, { n: q.n, total: quiz.total })), q.prompt),
        q.options.map((option, i) => h('label', {}, h('input', { type: 'radio', name: `q${q.n}`, value: String(i) }), h('span', {}, option))),
        h('p', { class: 'why', hidden: true }))));
    $('quiz-actions').hidden = false;

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        let right = 0;
        let blank = 0;
        quiz.questions.forEach((q, index) => {
            const set = list.children[index];
            const picked = set.querySelector('input:checked');
            const labels = [...set.querySelectorAll('label')];
            clearMarks(set);
            labels.forEach((label, i) => { label.className = i === q.answer ? 'right' : ''; });
            // The words carry the result, so colour is never the only cue.
            labels[q.answer].append(h('em', { class: 'mark' }, L.markRight));
            const correct = picked && Number(picked.value) === q.answer;
            if (!picked) {
                blank++;
            } else if (correct) {
                right++;
            } else {
                picked.parentNode.className = 'wrong';
                picked.parentNode.append(h('em', { class: 'mark' }, L.markYours));
            }
            const why = set.querySelector('.why');
            fill(why, h('strong', {}, correct ? L.correct : fillLabel(L.answerIs, { letter: LETTERS[q.answer] })), q.why);
            why.hidden = false;
        });
        $('score').textContent = fillLabel(blank ? L.scoreBlank : L.score, { right, total: quiz.total, blank });
        $('score').focus();
    });

    $('again').addEventListener('click', () => {
        form.reset();
        clearMarks(form);
        for (const label of form.querySelectorAll('label')) label.className = '';
        for (const why of form.querySelectorAll('.why')) why.hidden = true;
        $('score').textContent = '';
        window.scrollTo(0, 0);
    });
}

function explain(message) {
    $('quiz-title').textContent = t('There is no quiz in this link');
    fill($('quiz-lede'), t('{message}. Ask whoever sent the link for a new one, or make a quiz in the ', { message }), h('a', { href: 'builder.html' }, t('builder')), t(' or from a '), h('a', { href: 'templates.html' }, t('template')), t('. '));
    fill($('questions'));
    $('quiz-actions').hidden = true;
}

function start() {
    let link;
    try {
        link = parseQuizLink(location.hash);
    } catch (e) {
        // The reasons a link cannot be read are written in English, so a Japanese page gives the general one.
        return explain(LANG === 'ja' ? t('This link has no quiz in it') : e.message);
    }
    const quiz = buildQuiz(link.cfg, { count: link.count, seed: link.seed, only: link.only });
    if (!quiz.total) return explain(t('The link names an area with no rules switched on'));
    mount(quiz);
}

window.addEventListener('hashchange', () => location.reload());
start();
