// Quiz page: builds the quiz named by the link and runs it in the page.
// It makes no network requests and uses no browser storage. The questions
// come from the part of the address after the #, which is never sent anywhere.
//
// The downloadable quiz file carries its own copy of this logic as text (see
// SCRIPT in ../core/quiz.js), because that file has to work on its own. The
// tests hold the two to the same behaviour.

import { buildQuiz, parseQuizLink } from '../core/quiz.js';
import { $, h, fill } from './dom.js';

const LETTERS = 'ABCDEFGH';

function clearMarks(scope) {
    for (const mark of scope.querySelectorAll('.mark')) mark.remove();
}

function mount(quiz) {
    const title = `${quiz.title}${quiz.org ? ` (${quiz.org})` : ''}`;
    document.title = title;
    $('quiz-kicker').textContent = `Training quiz · ${quiz.total} questions`;
    $('quiz-title').textContent = title;
    $('quiz-lede').textContent = 'These questions come from the AI guardrails in force. Choose one answer for each, then check your answers to see the reason behind every one.';
    $('quiz-fine').textContent = `Your answers stay in this page. Nothing is recorded or sent. Questions about a rule go to ${quiz.contact}.`;
    const form = $('quiz');
    const list = $('questions');
    fill(list, quiz.questions.map((q) => h('fieldset', {},
        h('legend', {}, h('span', {}, `Question ${q.n} of ${quiz.total}`), q.prompt),
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
            labels[q.answer].append(h('em', { class: 'mark' }, 'Correct answer'));
            const correct = picked && Number(picked.value) === q.answer;
            if (!picked) {
                blank++;
            } else if (correct) {
                right++;
            } else {
                picked.parentNode.className = 'wrong';
                picked.parentNode.append(h('em', { class: 'mark' }, 'Your answer'));
            }
            const why = set.querySelector('.why');
            fill(why, h('strong', {}, correct ? 'Correct. ' : `The answer is ${LETTERS[q.answer]}. `), q.why);
            why.hidden = false;
        });
        $('score').textContent = `You got ${right} of ${quiz.total} right${blank ? `, with ${blank} not answered.` : '.'}`;
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
    $('quiz-title').textContent = 'There is no quiz in this link';
    fill($('quiz-lede'), `${message}. Ask whoever sent the link for a new one, or make a quiz in the `, h('a', { href: 'builder.html' }, 'builder'), ' or from a ', h('a', { href: 'templates.html' }, 'template'), '.');
    fill($('questions'));
    $('quiz-actions').hidden = true;
}

function start() {
    try {
        const { cfg, count, seed, only } = parseQuizLink(location.hash);
        const quiz = buildQuiz(cfg, { count, seed, only });
        if (!quiz.total) return explain('The link names an area with no rules switched on');
        mount(quiz);
    } catch (e) {
        explain(e.message);
    }
}

window.addEventListener('hashchange', () => location.reload());
start();
