// Templates page: browse the policy templates and download each one as CSV.
// It makes no network requests and uses no browser storage.

import { DOMAINS, PRESETS } from '../core/catalog.js';
import { encode, normalize, renderText } from '../core/config.js';
import { policyTemplates, templateRules, templateCsv, templateFileName } from '../core/templates.js';
import { buildQuiz, quizLink, QUIZ_FORMATS } from '../core/quiz.js';
import { $, h, fill, download } from './dom.js';

const templates = policyTemplates();
// On this page a rule reads as it would with nothing configured yet.
const DEFAULTS = normalize({});
const areaName = (id) => DOMAINS.find((d) => d.id === id).name;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
let current = templates[0].id;
let query = '';

/** The builder link that opens this template's rules. */
function builderLink(t) {
    const preset = PRESETS.find((p) => p.id === t.id);
    const cfg = preset ? preset.cfg : { strictness: 'strict', domains: ['core', t.id.replace(/^area-/, '')] };
    return `builder.html#c=${encode(cfg)}`;
}

/** What a 15-question training quiz on this template's rules is made from. */
function quizSource(t) {
    const preset = PRESETS.find((p) => p.id === t.id);
    if (preset) return [preset.cfg, { count: 15 }];
    const area = t.id.replace(/^area-/, '');
    return [{ strictness: 'strict', domains: ['core', area] }, { count: 15, only: [area] }];
}
const quizFor = (t) => buildQuiz(...quizSource(t));

function renderList() {
    const item = (t) => h('button', { type: 'button', 'aria-current': t.id === current ? 'true' : null, 'data-id': t.id, onclick: () => select(t.id) },
        h('span', {}, t.name), h('small', {}, String(templateRules(t.id).length)));
    fill($('tpl-list'),
        h('p', {}, 'By role'), templates.filter((t) => t.kind === 'persona').map(item),
        h('p', {}, 'By area'), templates.filter((t) => t.kind === 'area').map(item));
}

function renderPanel() {
    const t = templates.find((x) => x.id === current);
    const rules = templateRules(t.id);
    const areas = [...new Set(rules.map((r) => r.d))];
    const q = query.trim().toLowerCase();
    const shown = rules.filter((r) => !q || `${r.t} ${r.x} ${r.id}`.toLowerCase().includes(q));
    const body = h('tbody', {}, shown.map((r) => h('tr', {},
        h('td', {}, areaName(r.d)),
        h('td', {}, h('span', { class: 'lv ' + r.l }, r.l)),
        h('td', {}, h('strong', {}, r.t), h('span', {}, renderText(r.x, DEFAULTS)), h('code', {}, r.id)))),
    !shown.length && h('tr', {}, h('td', { colSpan: 3 }, 'No rules match.')));
    const search = h('input', { type: 'search', id: 'tpl-filter', placeholder: 'Filter these rules', 'aria-label': 'Filter these rules', value: query, oninput: (e) => {
        query = e.target.value;
        renderPanel();
        $('tpl-filter').focus();
    } });
    fill($('tpl-panel'),
        h('div', { class: 'head' },
            h('p', { class: 'kicker' }, t.kind === 'persona' ? 'Role template' : 'Area template'),
            h('h2', { id: 'tpl-name' }, t.name),
            h('p', { class: 'sub' }, t.blurb)),
        h('ul', { class: 'chips soft' },
            h('li', {}, plural(rules.length, 'rule')),
            h('li', {}, `${rules.filter((r) => r.l === 'must').length} must`),
            h('li', {}, `${rules.filter((r) => r.l === 'should').length} should`),
            areas.map((a) => h('li', {}, areaName(a)))),
        h('div', { class: 'cta' },
            h('button', { type: 'button', class: 'btn primary', id: 'tpl-download', onclick: () => download(templateFileName(t.id), templateCsv(t.id)) }, 'Download CSV'),
            h('button', { type: 'button', class: 'btn outline', id: 'tpl-quiz', onclick: () => download(`komainu-quiz-${t.id.replace(/^area-/, '')}.html`, QUIZ_FORMATS.html.render(quizFor(t)), 'text/html') }, 'Download quiz'),
            h('a', { class: 'btn text', id: 'tpl-quiz-open', href: quizLink(...quizSource(t)) }, 'Take the quiz'),
            h('a', { class: 'btn text', id: 'tpl-open', href: builderLink(t) }, 'Open in the builder')),
        search,
        h('div', { class: 'rules-table' }, h('table', {},
            h('thead', {}, h('tr', {}, ['Area', 'Level', 'Rule'].map((c) => h('th', { scope: 'col' }, c)))),
            body)),
        h('p', { class: 'fine', id: 'tpl-count' }, `${shown.length} of ${plural(rules.length, 'rule')} shown. The CSV file contains all of them, with the columns id, area, level, title, rule and source. In the file, words in braces such as {contact} are filled in from your configuration.`));
}

function select(id, { push = true } = {}) {
    if (!templates.some((t) => t.id === id)) return;
    current = id;
    query = '';
    renderList();
    renderPanel();
    $('tpl-status').textContent = `Showing ${templates.find((t) => t.id === id).name}, ${plural(templateRules(id).length, 'rule')}.`;
    if (push) history.replaceState(null, '', `#${id}`);
}

window.addEventListener('hashchange', () => select(location.hash.slice(1), { push: false }));
select(templates.some((t) => t.id === location.hash.slice(1)) ? location.hash.slice(1) : current, { push: false });
