// Templates page: browse the policy templates and download each one as CSV.
// It makes no network requests and uses no browser storage.

import { PRESETS } from '../core/catalog.js';
import { encode, normalize, renderText } from '../core/config.js';
import { policyTemplates, templateRules, templateCsv, templateFileName } from '../core/templates.js';
import { buildQuiz, quizLink, QUIZ_FORMATS } from '../core/quiz.js';
import { domainIn, ruleIn } from '../core/i18n.js';
import { LANG, $, h, fill, download } from './dom.js';
import { t, count } from './ui.js';

const templates = policyTemplates(LANG);
// On this page a rule reads as it would with nothing configured yet.
const DEFAULTS = normalize({ lang: LANG });
const areaName = (id) => domainIn(LANG, id).name;
let current = templates[0].id;
let query = '';

/** The configuration a template stands for, writing in the page's language. */
function configOf(tpl) {
    const preset = PRESETS.find((p) => p.id === tpl.id);
    return { ...(preset ? preset.cfg : { strictness: 'strict', domains: ['core', tpl.id.replace(/^area-/, '')] }), lang: LANG };
}

/** The builder link that opens this template's rules. */
const builderLink = (tpl) => `builder.html#c=${encode(configOf(tpl))}`;

/** What a 15-question training quiz on this template's rules is made from. */
function quizSource(tpl) {
    if (tpl.kind === 'persona') return [configOf(tpl), { count: 15 }];
    return [configOf(tpl), { count: 15, only: [tpl.id.replace(/^area-/, '')] }];
}
const quizFor = (tpl) => buildQuiz(...quizSource(tpl));

function renderList() {
    const item = (tpl) => h('button', { type: 'button', 'aria-current': tpl.id === current ? 'true' : null, 'data-id': tpl.id, onclick: () => select(tpl.id) },
        h('span', {}, tpl.name), h('small', {}, String(templateRules(tpl.id).length)));
    fill($('tpl-list'),
        h('p', {}, t('By role')), templates.filter((x) => x.kind === 'persona').map(item),
        h('p', {}, t('By area')), templates.filter((x) => x.kind === 'area').map(item));
}

function renderPanel() {
    const tpl = templates.find((x) => x.id === current);
    const rules = templateRules(tpl.id).map((r) => {
        const local = ruleIn(LANG, r);
        return { ...r, t: local.t, x: renderText(local.x, DEFAULTS), en: `${r.t} ${r.x}` };
    });
    const areas = [...new Set(rules.map((r) => r.d))];
    const q = query.trim().toLowerCase();
    const shown = rules.filter((r) => !q || `${r.t} ${r.x} ${r.en} ${r.id}`.toLowerCase().includes(q));
    const body = h('tbody', {}, shown.map((r) => h('tr', {},
        h('td', {}, areaName(r.d)),
        h('td', {}, h('span', { class: 'lv ' + r.l }, r.l === 'must' ? t('must') : t('should'))),
        h('td', {}, h('strong', {}, r.t), h('span', {}, r.x), h('code', {}, r.id)))),
    !shown.length && h('tr', {}, h('td', { colSpan: 3 }, t('No rules match.'))));
    const search = h('input', { type: 'search', id: 'tpl-filter', placeholder: t('Filter these rules'), 'aria-label': t('Filter these rules'), value: query, oninput: (e) => {
        query = e.target.value;
        renderPanel();
        $('tpl-filter').focus();
    } });
    fill($('tpl-panel'),
        h('div', { class: 'head' },
            h('p', { class: 'kicker' }, tpl.kind === 'persona' ? t('Role template') : t('Area template')),
            h('h2', { id: 'tpl-name' }, tpl.name),
            h('p', { class: 'sub' }, tpl.blurb)),
        h('ul', { class: 'chips soft' },
            h('li', {}, count(rules.length, 'rule')),
            h('li', {}, t('{n} must', { n: rules.filter((r) => r.l === 'must').length })),
            h('li', {}, t('{n} should', { n: rules.filter((r) => r.l === 'should').length })),
            areas.map((a) => h('li', {}, areaName(a)))),
        h('div', { class: 'cta' },
            h('button', { type: 'button', class: 'btn primary', id: 'tpl-download', onclick: () => download(templateFileName(tpl.id), templateCsv(tpl.id, LANG)) }, t('Download CSV')),
            h('button', { type: 'button', class: 'btn outline', id: 'tpl-quiz', onclick: () => download(`komainu-quiz-${tpl.id.replace(/^area-/, '')}.html`, QUIZ_FORMATS.html.render(quizFor(tpl)), 'text/html') }, t('Download quiz')),
            h('a', { class: 'btn text', id: 'tpl-quiz-open', href: quizLink(...quizSource(tpl)) }, t('Take the quiz')),
            h('a', { class: 'btn text', id: 'tpl-open', href: builderLink(tpl) }, t('Open in the builder'))),
        search,
        h('div', { class: 'rules-table' }, h('table', {},
            h('thead', {}, h('tr', {}, [t('Area'), t('Level'), t('Rule')].map((c) => h('th', { scope: 'col' }, c)))),
            body)),
        h('p', { class: 'fine', id: 'tpl-count' }, t('{shown} of {rules} shown. The CSV file contains all of them, with the columns id, area, level, title, rule and source. In the file, words in braces such as {contact} are filled in from your configuration.', { shown: shown.length, rules: count(rules.length, 'rule') })));
}

function select(id, { push = true } = {}) {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    current = id;
    query = '';
    renderList();
    renderPanel();
    $('tpl-status').textContent = t('Showing {name}, {rules}.', { name: tpl.name, rules: count(templateRules(id).length, 'rule') });
    if (push) history.replaceState(null, '', `#${id}`);
}

window.addEventListener('hashchange', () => select(location.hash.slice(1), { push: false }));
select(templates.some((x) => x.id === location.hash.slice(1)) ? location.hash.slice(1) : current, { push: false });
