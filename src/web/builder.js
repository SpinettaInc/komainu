// Komainu builder: a three-pane editor. Navigation on the left, the section
// being edited in the middle, live output on the right.
// It makes no network requests and uses no browser storage. State lives in
// memory and in what the visitor copies.

import { DOMAINS, RULES, STRICTNESS, TARGETS, PRESETS, REDACT_CLASSES } from '../core/catalog.js';
import { DEFAULT_CONFIG, normalize, decode, encode, compact, stats, isActive, isDefaultOn, renderText, coverageOf } from '../core/config.js';
import { generate } from '../core/generate.js';
import { cliCommand, bashScript, powershellScript, agentPrompt } from '../core/commands.js';
import { parseRules, applyImport, TEMPLATE_CSV, TEMPLATE_JSON } from '../core/import.js';
import { policyTemplates, templateCsv, templateFileName } from '../core/templates.js';
import { buildQuiz, quizLink, QUIZ_FORMATS, QUIZ_SIZES } from '../core/quiz.js';
import { zip } from '../core/zip.js';
import { LANGS, LANG_NAMES, domainIn, strictnessIn, targetIn, presetIn, redactIn, coverageIn, ruleIn } from '../core/i18n.js';
import { ONLINE, BASE, PAGE_BASE, LANG, $, h, fill, toggle, toast, copy, download, codebox } from './dom.js';
import { t, count } from './ui.js';

// A new configuration writes its files in the language of the page.
let cfg = normalize({ lang: LANG });
const ui = { quizCount: 10, quizSeed: 0, view: 'template', tab: 'command', shell: /Win/i.test(navigator.platform || '') ? 'ps' : 'sh', file: 0, q: '', filter: 'all' };
const JA = LANG === 'ja';
const domain = (id) => domainIn(LANG, id);
const cov = (id) => coverageIn(LANG, id);

/** Apply a change. `main: false` keeps the middle pane untouched (and the caret where it is). */
function update(patch, { main = true } = {}) {
    cfg = normalize({ ...cfg, ...patch });
    renderSide();
    if (main) renderMain();
    renderOutput();
}

function go(view) {
    ui.view = view;
    ui.q = '';
    ui.filter = 'all';
    renderSide();
    renderMain();
    $('main').scrollTop = 0;
    $('main').querySelector('h1').focus({ preventScroll: true });
}

// ── left: navigation ────────────────────────────────────────────────────────
function navItem(view, label, meta) {
    return h('button', { type: 'button', class: 'nav-item', 'data-view': view, 'aria-current': ui.view === view ? 'page' : null, onclick: () => go(view) },
        h('span', {}, label), meta !== null && meta !== undefined && h('small', {}, meta));
}

function renderSide() {
    const counts = (d) => {
        const rules = RULES.filter((r) => r.d === d.id);
        const mine = cfg.custom.filter((c) => c.d === d.id).length;
        return `${rules.filter((r) => isActive(r, cfg)).length + (cfg.domains.includes(d.id) ? mine : 0)}/${rules.length + mine}`;
    };
    fill($('side'),
        h('p', { class: 'side-h' }, t('Setup')),
        navItem('template', t('Template')),
        navItem('org', t('Organization'), JA ? strictnessIn(LANG, cfg.strictness).name : cfg.strictness),
        navItem('data', t('Data handling')),
        navItem('targets', t('Install targets'), cfg.targets.length),
        h('p', { class: 'side-h' }, t('Areas')),
        DOMAINS.map((d) => h('div', { class: 'area-row' + (cfg.domains.includes(d.id) ? '' : ' off') },
            h('input', { type: 'checkbox', checked: cfg.domains.includes(d.id), disabled: !!d.locked, 'aria-label': t('Include {name}', { name: domain(d.id).name }), title: d.locked ? t('Always included') : t('Include {name}', { name: domain(d.id).name }), onchange: (e) => update({ domains: toggle(cfg.domains, d.id, e.target.checked) }) }),
            navItem('area:' + d.id, domain(d.id).name, cfg.domains.includes(d.id) ? counts(d) : t('off')))),
        h('p', { class: 'side-h' }, t('Your rules')),
        navItem('import', t('Templates and import'), cfg.custom.length || null));
}

// ── middle: views ───────────────────────────────────────────────────────────
const head = (kicker, title, sub) => h('header', { class: 'view-head' }, h('p', { class: 'kicker' }, kicker), h('h1', { tabIndex: -1 }, title), sub && h('p', { class: 'sub' }, sub));

function textField(label, key, placeholder, { optional, max = 300 } = {}) {
    const id = 'f-' + key;
    return h('div', { class: 'field' },
        h('label', { for: id }, label, optional && h('span', { class: 'opt' }, t('optional'))),
        h('input', { id, type: 'text', autocomplete: 'off', maxLength: max, placeholder, value: cfg[key], oninput: (e) => update({ [key]: e.target.value }, { main: false }) }));
}

const stop = (s) => (/[.。]$/.test(s) ? s : s + (JA ? '。' : '.'));
const checks = (items, selected, onchange, cls = '') => h('div', { class: 'checks ' + cls }, items.map((it) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: selected.includes(it.id), onchange: (e) => onchange(it.id, e.target.checked) }),
    h('span', {}, it.name), h('small', {}, stop(it.hint)))));

function loadConfig(source, okMsg) {
    cfg = normalize(decode(source));
    renderSide();
    renderMain();
    renderOutput();
    if (okMsg) toast(okMsg);
}

const level = (l) => (l === 'must' ? t('must') : t('should'));

function ruleTable(rules, onRemove) {
    const heads = [t('Area'), t('Level'), t('Rule'), t('Source')];
    return h('div', { class: 'mini' }, h('table', {},
        h('thead', {}, h('tr', {}, heads.map((c) => h('th', { scope: 'col' }, c)), onRemove && h('th', { scope: 'col' }, ''))),
        h('tbody', {}, rules.map((r, i) => h('tr', {}, h('td', {}, domain(r.d).name), h('td', {}, level(r.l)), h('td', {}, r.x), h('td', {}, r.src || ''),
            onRemove && h('td', {}, h('button', { type: 'button', class: 'x-btn', onclick: () => onRemove(i) }, t('Remove'))))))));
}

const views = {
    template() {
        const box = h('textarea', { id: 'import-text', rows: 4, spellcheck: false, placeholder: t('Paste a komainu.json, a share link or a command') });
        const msg = h('span', { id: 'import-msg', role: 'status' });
        return [
            head(t('Setup'), t('Start from a template'), t('A template sets the areas, the strictness and where the guardrails are installed. Everything stays editable afterwards.')),
            h('div', { class: 'cards wide', id: 'presets' }, PRESETS.map((p) => h('button', { type: 'button', class: 'card', onclick: () => {
                // A template replaces every structural choice; what was typed about the organization stays.
                const { strictness, domains, targets, redact, levels, hostedMax } = DEFAULT_CONFIG;
                update({ strictness, domains, targets, redact, levels, hostedMax, ...p.cfg, on: [], off: [] });
                toast(t('Loaded "{name}"', { name: presetIn(LANG, p.id).name }));
            } }, h('strong', {}, presetIn(LANG, p.id).name), h('small', {}, presetIn(LANG, p.id).blurb),
            h('small', { class: 'meta' }, t('{n} areas · {level}', { n: p.cfg.domains.length, level: strictnessIn(LANG, p.cfg.strictness).name }))))),
            h('section', { class: 'block' },
                h('h2', {}, t('Open an existing configuration')),
                h('label', { for: 'import-text', class: 'hint' }, t('Paste a komainu.json, a share link or a command you were sent.')),
                box,
                h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small go', id: 'import-btn', onclick: () => {
                    try {
                        loadConfig(box.value, t('Configuration loaded'));
                    } catch (e) {
                        msg.textContent = e.message;
                    }
                } }, t('Open it')), msg))
        ];
    },

    org() {
        return [
            head(t('Setup'), t('Your organization'), t('These details are written into the generated files. Use roles and channels. Leave out personal contact details.')),
            h('div', { class: 'grid2' },
                textField(t('Name'), 'org', t('Shown in the generated files'), { optional: true, max: 80 }),
                textField(t('Owner of AI questions and incidents'), 'contact', t('A role or channel'), { max: 120 })),
            textField(t('Approved AI tools'), 'tools', t('e.g. Claude Enterprise, GitHub Copilot Business')),
            h('fieldset', { class: 'field' }, h('legend', {}, t('Strictness')),
                h('div', { class: 'seg', id: 'strictness' }, STRICTNESS.map((s) => h('label', { class: 'card' },
                    h('input', { type: 'radio', name: 'strictness', value: s.id, checked: cfg.strictness === s.id, onchange: () => update({ strictness: s.id }) }),
                    h('strong', {}, strictnessIn(LANG, s.id).name), h('small', {}, strictnessIn(LANG, s.id).blurb))))),
            h('fieldset', { class: 'field' }, h('legend', {}, t('Local hook')),
                h('div', { class: 'seg', id: 'hook-mode' }, [
                    [false, t('Enforce'), t('The hook stops what breaks a rule, or asks first at the advisory level.')],
                    [true, t('Observe'), t('For a trial period. The hook stops nothing and records what it would have stopped in a file on the machine. The record never holds what was typed or found.')]
                ].map(([value, name, blurb]) => h('label', { class: 'card' },
                    h('input', { type: 'radio', name: 'hook-mode', value: String(value), checked: cfg.observe === value, onchange: () => update({ observe: value }) }),
                    h('strong', {}, name), h('small', {}, blurb)))),
                cfg.observe && h('p', { class: 'hint', id: 'observe-note' }, cfg.targets.includes('hooks')
                    ? t('Run "node komainu.mjs report" to see the counts, then switch to Enforce and run the command again. Claude Code permission rules still apply while observing.')
                    : t('The local hook is not among the install targets, so this setting has no effect.'))),
            h('div', { class: 'field' },
                h('label', { for: 'f-lang' }, t('Language of the generated files')),
                h('select', { id: 'f-lang', onchange: (e) => update({ lang: e.target.value }) }, LANGS.map((l) => h('option', { value: l, selected: l === cfg.lang }, LANG_NAMES[l]))),
                h('p', { class: 'hint' }, t('The rules files, the policy and the quiz are written in this language.')))
        ];
    },

    data() {
        const levels = h('input', { id: 'f-levels', type: 'text', autocomplete: 'off', spellcheck: false, value: cfg.levels.join(', '), onchange: (e) => {
            const list = e.target.value.split(/[,、]/).map((l) => l.trim()).filter(Boolean);
            if (list.length >= 2) {
                update({ levels: list });
            } else {
                toast(t('Enter at least two levels'));
                e.target.value = cfg.levels.join(', ');
            }
        } });
        return [
            head(t('Setup'), t('Data handling'), t('What may go to a hosted AI service, and what is blocked or redacted on the machine before it leaves.')),
            h('div', { class: 'grid2' },
                h('div', { class: 'field' }, h('label', { for: 'f-levels' }, t('Classification levels, lowest first')), levels),
                h('div', { class: 'field' }, h('label', { for: 'f-hosted' }, t('Highest level for hosted AI')),
                    h('select', { id: 'f-hosted', onchange: (e) => update({ hostedMax: e.target.value }) }, cfg.levels.map((l) => h('option', { value: l, selected: l === cfg.hostedMax }, l))))),
            textField(t('Route for anything higher'), 'local', t('e.g. the on-premises model endpoint'), { optional: true, max: 160 }),
            h('fieldset', { class: 'field' }, h('legend', {}, t('Block and redact locally')),
                h('div', { id: 'redact' }, checks(REDACT_CLASSES.map((c) => redactIn(LANG, c.id)), cfg.redact, (id, on) => update({ redact: toggle(cfg.redact, id, on) })))),
            h('div', { class: 'field' },
                h('label', { for: 'f-terms' }, t('Sensitive names to block'), h('span', { class: 'opt' }, t('optional'))),
                h('textarea', { id: 'f-terms', rows: 4, spellcheck: false, placeholder: t('Client names, project codenames. One per line or comma-separated.'), value: cfg.terms.join('\n'), oninput: (e) => update({ terms: e.target.value.split(/[\n,、]+/) }, { main: false }) }),
                h('p', { class: 'hint' }, t('The local hook enforces these. They are never written into instruction files, so they are not sent to a model.')))
        ];
    },

    targets() {
        return [
            head(t('Setup'), t('Where to install them'), t('Pick every assistant your teams use. Each one gets the same rules in its own format.')),
            h('div', { id: 'targets' }, checks(TARGETS.map((x) => targetIn(LANG, x.id)), cfg.targets, (id, on) => update({ targets: toggle(cfg.targets, id, on) }), 'tall'))
        ];
    },

    area(id) {
        const d = domain(id);
        const on = cfg.domains.includes(id);
        const rules = RULES.filter((r) => r.d === id);
        const list = h('ul', { class: 'rule-list', id: 'rules' });
        const shownCount = h('span', { class: 'count' });
        // Rules are shown in the page's language, with this configuration's values filled in.
        const shown = (rule) => {
            const local = ruleIn(LANG, rule);
            return { t: local.t, x: renderText(local.x, { ...cfg, lang: LANG }) };
        };

        const setRule = (rule, value) => (isDefaultOn(rule, cfg) ? update({ off: toggle(cfg.off, rule.id, !value) }) : update({ on: toggle(cfg.on, rule.id, value) }));
        const row = (rule) => {
            const active = isActive(rule, cfg);
            const kind = coverageOf(rule, cfg);
            const cid = 'r-' + rule.id.replace(/\W/g, '-');
            const text = shown(rule);
            return h('li', { class: 'rule' + (active ? '' : ' off') },
                h('input', { type: 'checkbox', id: cid, checked: active, disabled: !on, onchange: (e) => setRule(rule, e.target.checked) }),
                h('label', { for: cid, class: 't' }, text.t),
                h('span', { class: 'tags' }, h('span', { class: 'lvl ' + rule.l }, level(rule.l)), h('span', { class: 'cov ' + kind, title: cov(kind).blurb }, cov(kind).name)),
                h('span', { class: 'x' }, text.x),
                h('code', { class: 'rid' }, rule.id));
        };
        const mineRow = ([c, i]) => h('li', { class: 'rule mine-rule' },
            h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'),
            h('span', { class: 't' }, t('Your rule')),
            h('span', { class: 'tags' }, h('span', { class: 'lvl ' + c.l }, level(c.l)), h('span', { class: 'cov instructed' }, cov('instructed').name)),
            h('span', { class: 'x' }, c.x),
            h('span', { class: 'rid' }, c.src && h('code', {}, c.src), h('button', { type: 'button', class: 'x-btn', onclick: () => update({ custom: cfg.custom.filter((_, n) => n !== i) }) }, t('Remove'))));

        const draw = () => {
            const q = ui.q.trim().toLowerCase();
            const pass = {
                all: () => true, on: (r) => isActive(r, cfg), off: (r) => !isActive(r, cfg), must: (r) => r.l === 'must', should: (r) => r.l === 'should', enforced: (r) => coverageOf(r, cfg) === 'enforced'
            }[ui.filter];
            const hits = rules.filter((r) => pass(r) && (!q || `${shown(r).t} ${shown(r).x} ${r.t} ${r.x} ${r.id}`.toLowerCase().includes(q)));
            const mine = cfg.custom.map((c, i) => [c, i]).filter(([c]) => c.d === id && (!q || c.x.toLowerCase().includes(q)) && !['off', 'enforced'].includes(ui.filter) && (!['must', 'should'].includes(ui.filter) || c.l === ui.filter));
            fill(list, hits.map(row), mine.map(mineRow), !hits.length && !mine.length && h('li', { class: 'empty' }, t('No rules match.')));
            shownCount.textContent = t('{n} shown', { n: hits.length + mine.length });
        };

        const input = h('input', { type: 'text', placeholder: t('Add your own {name} rule', { name: JA ? d.name : d.name.toLowerCase() }), 'aria-label': t('New {name} rule', { name: d.name }), maxLength: 600 });
        const lvl = h('select', { 'aria-label': t('Level') }, h('option', { value: 'must' }, t('MUST')), h('option', { value: 'should' }, t('SHOULD')));
        const add = () => { if (input.value.trim()) update({ custom: [...cfg.custom, { d: id, l: lvl.value, x: input.value }] }); };
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                add();
            }
        });

        const filters = { all: t('all'), on: t('on'), off: t('off'), must: t('must'), should: t('should'), enforced: t('enforced') };
        const ids = rules.map((r) => r.id);
        const without = (arr) => arr.filter((x) => !ids.includes(x));
        draw();
        return [
            head(t('Area'), d.name, d.blurb),
            !on && h('div', { class: 'banner' }, h('span', {}, t('This area is off, so none of its rules are installed.')),
                h('button', { type: 'button', class: 'btn small go', onclick: () => update({ domains: [...cfg.domains, id] }) }, t('Turn on {name}', { name: d.name }))),
            h('div', { class: 'toolbar' },
                h('input', { type: 'text', class: 'search', placeholder: t('Filter rules'), 'aria-label': t('Filter rules'), value: ui.q, oninput: (e) => { ui.q = e.target.value; draw(); } }),
                h('div', { class: 'toggle', role: 'group', 'aria-label': t('Show') }, Object.keys(filters).map((f) => h('button', { type: 'button', 'data-filter': f, 'aria-pressed': String(ui.filter === f), onclick: (e) => {
                    ui.filter = f;
                    for (const b of e.target.parentNode.children) b.setAttribute('aria-pressed', String(b === e.target));
                    draw();
                } }, filters[f]))),
                shownCount,
                h('span', { class: 'spacer' }),
                on && h('button', { type: 'button', class: 'btn small', onclick: () => update({ off: without(cfg.off), on: [...without(cfg.on), ...rules.filter((r) => !isDefaultOn(r, cfg)).map((r) => r.id)] }) }, t('All on')),
                on && h('button', { type: 'button', class: 'btn small', onclick: () => update({ off: without(cfg.off), on: without(cfg.on) }) }, t('Reset to {level}', { level: JA ? strictnessIn(LANG, cfg.strictness).name : cfg.strictness }))),
            list,
            on && h('div', { class: 'add' }, input, lvl, h('button', { type: 'button', class: 'btn small go', onclick: add }, t('Add rule')))
        ];
    },

    import() {
        const preview = h('div', { id: 'rules-preview', role: 'status', 'aria-live': 'polite' });
        const fallback = h('select', { id: 'rules-fallback' }, DOMAINS.map((d) => h('option', { value: d.id }, domain(d.id).name)));
        const box = h('textarea', { id: 'rules-text', rows: 6, spellcheck: false, placeholder: 'rule,level,area,source\n"Get approval before using AI on performance data.",must,HR,AI Policy 5.2' });
        const templates = policyTemplates(LANG);
        const group = (kind, label) => h('optgroup', { label }, templates.filter((x) => x.kind === kind).map((x) => h('option', { value: x.id }, x.name)));
        const tplPick = h('select', { id: 'tpl-pick' }, group('persona', t('By role')), group('area', t('By area')));
        let pending = null;

        const show = (res, name) => {
            pending = res.rules.length || res.on.length ? res : null;
            const byArea = {};
            for (const r of res.rules) byArea[r.d] = (byArea[r.d] || 0) + 1;
            const reasons = {};
            for (const s of res.skipped) (reasons[s.reason] ||= []).push(s.row);
            const areasIn = new Set([...Object.keys(byArea), ...res.on.map((id) => id.split('.')[0])]);
            const newAreas = [...areasIn].filter((d) => !cfg.domains.includes(d)).map((d) => domain(d).name);
            const areas = Object.entries(byArea).map(([d, n]) => `${n} ${domain(d).name}`).join(' · ');
            const rules = count(res.rules.length, 'rule');
            let summary;
            if (res.rules.length) summary = name ? t('Found {rules} of your own in {name}: {areas}.', { rules, name, areas }) : t('Found {rules} of your own: {areas}.', { rules, areas });
            else if (res.on.length) summary = name ? t('Read the template in {name}. No rule text was changed.', { name }) : t('Read the template. No rule text was changed.');
            else summary = name ? t('No rules could be read from {name}.', { name }) : t('No rules could be read.');
            const skippedLine = ([why, rows]) => {
                const vars = { n: rows.length, why, rows: `${rows.slice(0, 12).join(', ')}${rows.length > 12 ? '…' : ''}` };
                return h('li', {}, rows.length > 1 ? t('Skipped {n} ({why}): rows {rows}.', vars) : t('Skipped {n} ({why}): row {rows}.', vars));
            };
            fill(preview,
                h('p', { class: 'sum' + (pending ? '' : ' bad') }, summary),
                (res.notes.length || res.skipped.length || newAreas.length) ? h('ul', {},
                    res.notes.map((n) => h('li', {}, n)),
                    Object.entries(reasons).map(skippedLine),
                    newAreas.length ? h('li', {}, t('Applying this also turns on: {areas}.', { areas: newAreas.join(JA ? '、' : ', ') })) : null) : null,
                res.rules.length ? ruleTable(res.rules.slice(0, 100)) : null,
                res.rules.length > 100 ? h('p', { class: 'hint' }, t('Showing the first 100 of {n}.', { n: res.rules.length })) : null,
                pending ? h('div', { class: 'row' },
                    h('button', { type: 'button', class: 'btn small go', onclick: () => {
                        const applied = pending;
                        update(applyImport(cfg, applied));
                        toast(applied.on.length ? t('Template applied') : t('Added {rules}', { rules: count(applied.rules.length, 'rule') }));
                    } }, res.on.length ? t('Apply this template') : t('Add {rules}', { rules })),
                    h('button', { type: 'button', class: 'btn small', onclick: () => { pending = null; fill(preview); } }, t('Discard'))) : null);
        };
        const read = (body, name) => show(parseRules(body, { name, fallback: fallback.value, existing: cfg.custom, lang: LANG }), name);
        const readFile = async (file) => {
            if (!file) return;
            if (file.size > 2_000_000) return show({ rules: [], on: [], off: [], replaces: [], skipped: [], notes: [t('That file is larger than 2 MB. Export only the rules.')] }, file.name);
            read(await file.text(), file.name);
        };

        const input = h('input', { type: 'file', id: 'rules-file', accept: '.csv,.tsv,.json,.txt,text/csv,application/json', onchange: (e) => { readFile(e.target.files[0]); e.target.value = ''; } });
        const drop = h('div', { class: 'drop', id: 'rules-drop' }, input, h('label', { for: 'rules-file', class: 'btn small' }, t('Choose a file')), h('span', {}, t('or drop one here, or paste below')));
        for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
        for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); });
        drop.addEventListener('drop', (e) => readFile(e.dataTransfer?.files?.[0]));

        return [
            head(t('Your rules'), t('Templates and import'), t('Download a policy template to edit, or bring the rules your organization already keeps. Files are read in this tab and are not uploaded anywhere.')),
            h('section', { class: 'block first' },
                h('h2', {}, t('Start from a policy template')),
                h('p', { class: 'hint' }, t('Download the rules for a role or an area as a CSV file. Edit the wording in a spreadsheet, delete the rows that do not apply and add rows of your own. Then import the file below. Rows you leave alone stay catalog rules, and rows you change become your rules.')),
                h('div', { class: 'row' },
                    h('label', { for: 'tpl-pick', class: 'hint' }, t('Template')), tplPick,
                    h('button', { type: 'button', class: 'btn small go', id: 'tpl-download', onclick: () => download(templateFileName(tplPick.value), templateCsv(tplPick.value, LANG)) }, t('Download CSV')))),
            h('section', { class: 'block' },
                h('h2', {}, t('Import a file')),
                h('p', { class: 'hint' }, t('Columns or keys: rule, level, area, source. Only rule is required. A template also has id and title.')),
                drop,
                h('div', { class: 'field' }, h('label', { for: 'rules-text' }, t('Paste CSV or JSON')), box),
                h('div', { class: 'row' },
                    h('label', { for: 'rules-fallback', class: 'hint' }, t('Area when a rule names none')), fallback,
                    h('button', { type: 'button', class: 'btn small go', id: 'rules-parse', onclick: () => read(box.value, '') }, t('Read rules')),
                    h('button', { type: 'button', class: 'btn small', id: 'rules-tpl-csv', onclick: () => download('komainu-rules-blank.csv', TEMPLATE_CSV) }, t('Blank CSV')),
                    h('button', { type: 'button', class: 'btn small', id: 'rules-tpl-json', onclick: () => download('komainu-rules-blank.json', TEMPLATE_JSON) }, t('Blank JSON'))),
                preview),
            cfg.custom.length ? h('section', { class: 'block' },
                h('div', { class: 'mine' }, h('h2', {}, t('{rules} of your own', { rules: count(cfg.custom.length, 'rule') })),
                    h('button', { type: 'button', onclick: () => { update({ custom: [] }); toast(t('Your rules were removed')); } }, t('Remove all'))),
                ruleTable(cfg.custom, (i) => update({ custom: cfg.custom.filter((_, n) => n !== i) }))) : null
        ];
    }
};

function renderMain() {
    const [name, arg] = ui.view.split(':');
    fill($('main'), views[name](arg));
}

// ── right: output ───────────────────────────────────────────────────────────
function renderStats() {
    const s = stats(cfg);
    const kinds = ['enforced', 'instructed', 'attested'];
    const kindName = (k) => (JA ? cov(k).name : cov(k).name.toLowerCase());
    const meter = h('div', { class: 'meter', role: 'img', 'aria-label': kinds.map((k) => `${s[k]} ${kindName(k)}`).join(', ') });
    for (const k of kinds) {
        if (!s[k]) continue;
        const bar = h('i', { class: k });
        bar.style.flex = String(s[k]);
        meter.append(bar);
    }
    fill($('stats'),
        h('div', { class: 'big' }, `${count(s.total, 'rule')} `, h('small', {}, `${t('{n} must', { n: s.must })} · ${t('{n} should', { n: s.should })} · ${count(cfg.domains.length, 'area')}`)),
        meter,
        h('div', { class: 'legend' }, kinds.map((k) => h('span', { title: cov(k).blurb }, h('span', { class: 'dot ' + k }), h('b', {}, String(s[k])), ' ' + kindName(k)))));
    $('top-count').textContent = t('{rules} · {files}', { rules: count(s.total, 'rule'), files: count(generate(cfg).length, 'file') });
}

const shellToggle = () => h('div', { class: 'toggle', role: 'group', 'aria-label': t('Shell') },
    [['sh', 'macOS / Linux'], ['ps', 'Windows']].map(([id, name]) => h('button', { type: 'button', 'aria-pressed': String(ui.shell === id), onclick: () => { ui.shell = id; renderPanel(); } }, name)));

const command = () => cliCommand(cfg, { base: BASE, shell: ui.shell });

const panels = {
    command() {
        const files = generate(cfg);
        const cmd = command();
        const long = cmd.length > 6000;
        const label = ui.shell === 'ps' ? 'PowerShell' : t('Terminal');
        return [
            h('p', {}, t('Run this in the root of the repository or folder where the guardrails should live. It writes {files} and merges with what is already there.', { files: count(files.length, 'file') })),
            h('div', { class: 'pick' }, shellToggle()),
            ...(long ? [
                h('p', {}, h('strong', {}, t('This configuration is large. ')), t('Some terminals cut very long commands, so download komainu.json into the folder and run the short command instead.')),
                codebox('komainu.json', JSON.stringify(compact(cfg), null, 2) + '\n', { file: 'komainu.json', nowrap: true }),
                codebox(label, cmd.replace(/apply \S+$/, 'apply'))
            ] : [codebox(label, cmd)]),
            h('ol', {},
                h('li', {}, ONLINE ? t('Downloads the Komainu CLI. It is one readable file with no dependencies, and it makes no network calls.') : t('Uses the komainu.mjs you downloaded with this page; keep it next to where you run the command.')),
                h('li', {}, t('Your choices are inside the command. No server received them.')),
                h('li', {}, t('Needs Node.js 18 or newer. Add --dry-run to preview without writing.')))
        ];
    },
    script() {
        const ps = ui.shell === 'ps';
        const body = ps ? powershellScript(cfg) : bashScript(cfg);
        const name = ps ? 'install-guardrails.ps1' : 'install-guardrails.sh';
        return [
            h('p', {}, t('A self-contained installer with every file inside it. No download and no Node.js needed. It never overwrites an existing file.')),
            h('div', { class: 'pick' }, shellToggle()),
            codebox(`${name} · ${Math.ceil(body.length / 1024)} KB`, body, { file: name, nowrap: true }),
            h('p', {}, ps ? t('Paste into PowerShell, or download and run: ./install-guardrails.ps1') : t('Paste into a terminal, or download and run: bash install-guardrails.sh'))
        ];
    },
    agent() {
        return [
            h('p', {}, t('Paste this into your coding agent. It reads your internal policy documents on your machine, maps each clause to a rule, shows you the gaps, and only then installs.')),
            codebox(t('Prompt'), agentPrompt(cfg, { base: BASE }))
        ];
    },
    files() {
        const files = generate(cfg);
        ui.file = Math.min(ui.file, files.length - 1);
        const f = files[ui.file];
        const writable = files.filter((x) => x.mode !== 'self');
        const downloadAll = () => download('komainu-guardrails.zip', zip(writable), 'application/zip');
        const modes = { file: t('written by Komainu'), block: t('managed block inside your file'), json: t('merged into your settings'), self: t('a copy of the CLI') };
        return [
            h('ul', { class: 'tree', id: 'file-tree' }, files.map((x, i) => h('li', {}, h('button', { type: 'button', 'aria-current': i === ui.file ? 'true' : null, onclick: () => { ui.file = i; renderPanel(); } }, x.path)))),
            codebox(`${f.path} · ${modes[f.mode]}`, f.mode === 'self' ? t('(The komainu CLI copies itself here so the MCP server can run from the repository.)') : f.content, { file: f.mode === 'self' ? null : f.path.split('/').pop(), nowrap: f.path.endsWith('.mjs') || f.path.endsWith('.json'), actions: [[t('Download all'), downloadAll]] }),
            h('p', {}, t('"Download all" saves {files} as one zip, in the folders shown above. Unzip it in the root of your repository. Unzipping replaces files of the same name, so use the command if the folder already has files such as AGENTS.md.', { files: count(writable.length, 'file') }) + (writable.length < files.length ? t(' The copy of the CLI is not included; the command and the offline script cover it.') : ''))
        ];
    },
    quiz() {
        const options = { count: ui.quizCount, seed: ui.quizSeed ? String(ui.quizSeed) : '' };
        const made = buildQuiz(cfg, options);
        const link = ONLINE ? quizLink(cfg, options, PAGE_BASE) : '';
        const scenarios = made.questions.filter((q) => q.type === 'scenario').length;
        const sample = made.questions.find((q) => q.type === 'scenario') || made.questions[0];
        const save = (id) => download(QUIZ_FORMATS[id].file, QUIZ_FORMATS[id].render(made), QUIZ_FORMATS[id].type);
        return [
            h('p', {}, t('A quiz made from the rules you selected, to share with your team for training. The HTML file works on its own: people open it, answer, and see the reason behind each answer. It records nothing.')),
            h('div', { class: 'pick' },
                h('label', { for: 'quiz-count' }, t('Questions')),
                h('select', { id: 'quiz-count', onchange: (e) => { ui.quizCount = Number(e.target.value); renderPanel(); } }, QUIZ_SIZES.map((n) => h('option', { value: n, selected: n === ui.quizCount }, String(n)))),
                h('button', { type: 'button', class: 'btn small', id: 'quiz-shuffle', onclick: () => { ui.quizSeed++; renderPanel(); } }, t('Different questions'))),
            h('p', { id: 'quiz-summary' }, t('{questions}: {scenarios} from written situations, {generated} generated from the rule text. They cover {rules}.', { questions: count(made.total, 'question'), scenarios, generated: made.total - scenarios, rules: count(new Set(made.questions.map((q) => q.rule).filter(Boolean)).size, 'rule') })),
            h('div', { class: 'row' },
                h('button', { type: 'button', class: 'btn small go', id: 'quiz-html', onclick: () => save('html') }, t('Download quiz (HTML)')),
                h('button', { type: 'button', class: 'btn small', id: 'quiz-md', onclick: () => save('md') }, 'Markdown'),
                h('button', { type: 'button', class: 'btn small', id: 'quiz-csv', onclick: () => save('csv') }, 'CSV')),
            link ? codebox(t('Quiz link'), link) : null,
            link ? h('p', {}, h('a', { id: 'quiz-open', href: link, target: '_blank', rel: 'noopener' }, t('Open the quiz in a new tab')), t('. Anyone with the link gets the same questions. The rules sit after the # in the address, which browsers do not send to any server, and your sensitive names are left out of it.')) : null,
            sample ? codebox(t('Sample: question {n}', { n: sample.n }), `${sample.prompt}\n\n${sample.options.map((o, n) => `${'ABCD'[n]}. ${o}`).join('\n')}\n\n${t('Answer: {letter}', { letter: 'ABCD'[sample.answer] })}`) : null,
            h('p', {}, t('Markdown suits printing and wikis. CSV has one row per question for a form builder or a learning system.'))
        ];
    },
    share() {
        const link = `${location.href.split('#')[0]}#c=${encode(cfg)}`;
        return [
            h('p', {}, t('Send this link to a colleague to continue from the same choices. The configuration sits after the # in the address, which browsers do not send to any server.')),
            codebox(t('Share link'), link),
            cfg.terms.length ? h('p', {}, h('strong', {}, t('Careful: ')), t('this configuration contains your sensitive names. Share it only with people allowed to see them.')) : null,
            codebox('komainu.json', JSON.stringify(compact(cfg), null, 2) + '\n', { file: 'komainu.json', nowrap: true })
        ];
    }
};

function renderPanel() {
    for (const b of document.querySelectorAll('.tabs [role="tab"]')) {
        const on = b.dataset.tab === ui.tab;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
    }
    $('panel').setAttribute('aria-labelledby', `tab-${ui.tab}`);
    fill($('panel'), panels[ui.tab]());
}

function renderOutput() {
    renderStats();
    renderPanel();
}

// ── wiring ──────────────────────────────────────────────────────────────────
function init() {
    const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
    tabs.forEach((b, i) => {
        b.addEventListener('click', () => { ui.tab = b.dataset.tab; renderPanel(); });
        // Arrow keys, Home and End move between tabs, as the tab pattern expects.
        b.addEventListener('keydown', (e) => {
            const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
            if (to === undefined) return;
            e.preventDefault();
            const next = tabs[(to + tabs.length) % tabs.length];
            ui.tab = next.dataset.tab;
            renderPanel();
            next.focus();
        });
    });
    $('top-copy').addEventListener('click', () => copy(command()));
    if (!ONLINE) for (const el of document.querySelectorAll('[data-online]')) el.hidden = true;

    const fromHash = () => {
        const m = location.hash.match(/^#c=([A-Za-z0-9_-]+)/);
        if (!m) return false;
        try {
            loadConfig(m[1], t('Loaded shared configuration'));
            return true;
        } catch {
            return false;
        }
    };
    window.addEventListener('hashchange', fromHash);
    if (!fromHash()) {
        renderSide();
        renderMain();
        renderOutput();
    }
}

init();
