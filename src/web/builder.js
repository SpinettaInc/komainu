// Komainu builder: a three-pane editor. Navigation on the left, the section
// being edited in the middle, live output on the right.
// It makes no network requests and uses no browser storage. State lives in
// memory and in what the visitor copies.

import { DOMAINS, RULES, STRICTNESS, TARGETS, PRESETS, REDACT_CLASSES, COVERAGE } from '../core/catalog.js';
import { DEFAULT_CONFIG, normalize, decode, encode, compact, stats, isActive, isDefaultOn, renderText, coverageOf } from '../core/config.js';
import { generate } from '../core/generate.js';
import { cliCommand, bashScript, powershellScript, agentPrompt } from '../core/commands.js';
import { parseRules, applyImport, TEMPLATE_CSV, TEMPLATE_JSON } from '../core/import.js';
import { policyTemplates, templateCsv, templateFileName } from '../core/templates.js';
import { zip } from '../core/zip.js';
import { buildQuiz, quizLink, QUIZ_FORMATS, QUIZ_SIZES } from '../core/quiz.js';
import { ONLINE, BASE, $, h, fill, toggle, toast, copy, download, codebox } from './dom.js';

let cfg = normalize({});
const ui = { quizCount: 10, quizSeed: 0, view: 'template', tab: 'command', shell: /Win/i.test(navigator.platform || '') ? 'ps' : 'sh', file: 0, q: '', filter: 'all' };
const domain = (id) => DOMAINS.find((d) => d.id === id);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

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
const SETUP = [['template', 'Template'], ['org', 'Organization'], ['data', 'Data handling'], ['targets', 'Install targets']];

function navItem(view, label, meta) {
    return h('button', { type: 'button', class: 'nav-item', 'aria-current': ui.view === view ? 'page' : null, onclick: () => go(view) }, h('span', {}, label), meta !== null && meta !== undefined && h('small', {}, meta));
}

function renderSide() {
    const counts = (d) => {
        const rules = RULES.filter((r) => r.d === d.id);
        const mine = cfg.custom.filter((c) => c.d === d.id).length;
        return `${rules.filter((r) => isActive(r, cfg)).length + (cfg.domains.includes(d.id) ? mine : 0)}/${rules.length + mine}`;
    };
    fill($('side'),
        h('p', { class: 'side-h' }, 'Setup'),
        SETUP.map(([v, label]) => navItem(v, label, v === 'targets' ? cfg.targets.length : v === 'org' ? cfg.strictness : null)),
        h('p', { class: 'side-h' }, 'Areas'),
        DOMAINS.map((d) => h('div', { class: 'area-row' + (cfg.domains.includes(d.id) ? '' : ' off') },
            h('input', { type: 'checkbox', checked: cfg.domains.includes(d.id), disabled: !!d.locked, 'aria-label': `Include ${d.name}`, title: d.locked ? 'Always included' : `Include ${d.name}`, onchange: (e) => update({ domains: toggle(cfg.domains, d.id, e.target.checked) }) }),
            navItem('area:' + d.id, d.name, cfg.domains.includes(d.id) ? counts(d) : 'off'))),
        h('p', { class: 'side-h' }, 'Your rules'),
        navItem('import', 'Templates and import', cfg.custom.length || null));
}

// ── middle: views ───────────────────────────────────────────────────────────
const head = (kicker, title, sub) => h('header', { class: 'view-head' }, h('p', { class: 'kicker' }, kicker), h('h1', { tabIndex: -1 }, title), sub && h('p', { class: 'sub' }, sub));

function textField(label, key, placeholder, { optional, max = 300 } = {}) {
    const id = 'f-' + key;
    return h('div', { class: 'field' },
        h('label', { for: id }, label, optional && h('span', { class: 'opt' }, 'optional')),
        h('input', { id, type: 'text', autocomplete: 'off', maxLength: max, placeholder, value: cfg[key], oninput: (e) => update({ [key]: e.target.value }, { main: false }) }));
}

const checks = (items, selected, onchange, cls = '') => h('div', { class: 'checks ' + cls }, items.map((it) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: selected.includes(it.id), onchange: (e) => onchange(it.id, e.target.checked) }),
    h('span', {}, it.name), h('small', {}, it.hint + (it.hint.endsWith('.') ? '' : '.')))));

function loadConfig(text, okMsg) {
    cfg = normalize(decode(text));
    renderSide(); renderMain(); renderOutput();
    if (okMsg) toast(okMsg);
}

const views = {
    template() {
        const text = h('textarea', { id: 'import-text', rows: 4, spellcheck: false, placeholder: 'Paste a komainu.json, a share link or a command' });
        const msg = h('span', { id: 'import-msg', role: 'status' });
        return [
            head('Setup', 'Start from a template', 'A template sets the areas, the strictness and where the guardrails are installed. Everything stays editable afterwards.'),
            h('div', { class: 'cards wide', id: 'presets' }, PRESETS.map((p) => h('button', { type: 'button', class: 'card', onclick: () => {
                // A template replaces every structural choice; what was typed about the organization stays.
                const { strictness, domains, targets, redact, levels, hostedMax } = DEFAULT_CONFIG;
                update({ strictness, domains, targets, redact, levels, hostedMax, ...p.cfg, on: [], off: [] });
                toast(`Loaded "${p.name}"`);
            } }, h('strong', {}, p.name), h('small', {}, p.blurb), h('small', { class: 'meta' }, `${p.cfg.domains.length} areas · ${p.cfg.strictness}`)))),
            h('section', { class: 'block' },
                h('h2', {}, 'Open an existing configuration'),
                h('label', { for: 'import-text', class: 'hint' }, 'Paste a komainu.json, a share link or a command you were sent.'),
                text,
                h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small go', id: 'import-btn', onclick: () => {
                    try { loadConfig(text.value, 'Configuration loaded'); } catch (e) { msg.textContent = e.message; }
                } }, 'Open it'), msg))
        ];
    },

    org() {
        return [
            head('Setup', 'Your organization', 'These details are written into the generated files. Use roles and channels. Leave out personal contact details.'),
            h('div', { class: 'grid2' },
                textField('Name', 'org', 'Shown in the generated files', { optional: true, max: 80 }),
                textField('Owner of AI questions and incidents', 'contact', 'A role or channel', { max: 120 })),
            textField('Approved AI tools', 'tools', 'e.g. Claude Enterprise, GitHub Copilot Business'),
            h('fieldset', { class: 'field' }, h('legend', {}, 'Strictness'),
                h('div', { class: 'seg', id: 'strictness' }, STRICTNESS.map((s) => h('label', { class: 'card' },
                    h('input', { type: 'radio', name: 'strictness', value: s.id, checked: cfg.strictness === s.id, onchange: () => update({ strictness: s.id }) }),
                    h('strong', {}, s.name), h('small', {}, s.blurb)))))
        ];
    },

    data() {
        const levels = h('input', { id: 'f-levels', type: 'text', autocomplete: 'off', spellcheck: false, value: cfg.levels.join(', '), onchange: (e) => {
            const list = e.target.value.split(',').map((l) => l.trim()).filter(Boolean);
            if (list.length >= 2) update({ levels: list });
            else { toast('Enter at least two levels'); e.target.value = cfg.levels.join(', '); }
        } });
        return [
            head('Setup', 'Data handling', 'What may go to a hosted AI service, and what is blocked or redacted on the machine before it leaves.'),
            h('div', { class: 'grid2' },
                h('div', { class: 'field' }, h('label', { for: 'f-levels' }, 'Classification levels, lowest first'), levels),
                h('div', { class: 'field' }, h('label', { for: 'f-hosted' }, 'Highest level for hosted AI'),
                    h('select', { id: 'f-hosted', onchange: (e) => update({ hostedMax: e.target.value }) }, cfg.levels.map((l) => h('option', { value: l, selected: l === cfg.hostedMax }, l))))),
            textField('Route for anything higher', 'local', 'e.g. the on-premises model endpoint', { optional: true, max: 160 }),
            h('fieldset', { class: 'field' }, h('legend', {}, 'Block and redact locally'),
                h('div', { id: 'redact' }, checks(REDACT_CLASSES, cfg.redact, (id, on) => update({ redact: toggle(cfg.redact, id, on) })))),
            h('div', { class: 'field' },
                h('label', { for: 'f-terms' }, 'Sensitive names to block', h('span', { class: 'opt' }, 'optional')),
                h('textarea', { id: 'f-terms', rows: 4, spellcheck: false, placeholder: 'Client names, project codenames. One per line or comma-separated.', value: cfg.terms.join('\n'), oninput: (e) => update({ terms: e.target.value.split(/[\n,]+/) }, { main: false }) }),
                h('p', { class: 'hint' }, 'The local hook enforces these. They are never written into instruction files, so they are not sent to a model.'))
        ];
    },

    targets() {
        return [
            head('Setup', 'Where to install them', 'Pick every assistant your teams use. Each one gets the same rules in its own format.'),
            h('div', { id: 'targets' }, checks(TARGETS, cfg.targets, (id, on) => update({ targets: toggle(cfg.targets, id, on) }), 'tall'))
        ];
    },

    area(id) {
        const d = domain(id);
        const on = cfg.domains.includes(id);
        const rules = RULES.filter((r) => r.d === id);
        const list = h('ul', { class: 'rule-list', id: 'rules' });
        const count = h('span', { class: 'count' });

        const setRule = (rule, value) => (isDefaultOn(rule, cfg) ? update({ off: toggle(cfg.off, rule.id, !value) }) : update({ on: toggle(cfg.on, rule.id, value) }));
        const row = (rule) => {
            const active = isActive(rule, cfg);
            const cov = coverageOf(rule, cfg);
            const cid = 'r-' + rule.id.replace(/\W/g, '-');
            return h('li', { class: 'rule' + (active ? '' : ' off') },
                h('input', { type: 'checkbox', id: cid, checked: active, disabled: !on, onchange: (e) => setRule(rule, e.target.checked) }),
                h('label', { for: cid, class: 't' }, rule.t),
                h('span', { class: 'tags' }, h('span', { class: 'lvl ' + rule.l }, rule.l), h('span', { class: 'cov ' + cov, title: COVERAGE[cov].blurb }, COVERAGE[cov].name)),
                h('span', { class: 'x' }, renderText(rule.x, cfg)),
                h('code', { class: 'rid' }, rule.id));
        };
        const mineRow = ([c, i]) => h('li', { class: 'rule mine-rule' },
            h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'),
            h('span', { class: 't' }, 'Your rule'),
            h('span', { class: 'tags' }, h('span', { class: 'lvl ' + c.l }, c.l), h('span', { class: 'cov instructed' }, 'Instructed')),
            h('span', { class: 'x' }, c.x),
            h('span', { class: 'rid' }, c.src && h('code', {}, c.src), h('button', { type: 'button', class: 'x-btn', onclick: () => update({ custom: cfg.custom.filter((_, n) => n !== i) }) }, 'Remove')));

        const draw = () => {
            const q = ui.q.trim().toLowerCase();
            const pass = {
                all: () => true, on: (r) => isActive(r, cfg), off: (r) => !isActive(r, cfg), must: (r) => r.l === 'must', should: (r) => r.l === 'should', enforced: (r) => coverageOf(r, cfg) === 'enforced'
            }[ui.filter];
            const shown = rules.filter((r) => pass(r) && (!q || `${r.t} ${r.x} ${r.id}`.toLowerCase().includes(q)));
            const mine = cfg.custom.map((c, i) => [c, i]).filter(([c]) => c.d === id && (!q || c.x.toLowerCase().includes(q)) && !['off', 'enforced'].includes(ui.filter) && (!['must', 'should'].includes(ui.filter) || c.l === ui.filter));
            fill(list, shown.map(row), mine.map(mineRow), !shown.length && !mine.length && h('li', { class: 'empty' }, 'No rules match.'));
            count.textContent = `${shown.length + mine.length} shown`;
        };

        const text = h('input', { type: 'text', placeholder: `Add your own ${d.name.toLowerCase()} rule`, 'aria-label': `New ${d.name} rule`, maxLength: 600 });
        const lvl = h('select', { 'aria-label': 'Level' }, h('option', { value: 'must' }, 'MUST'), h('option', { value: 'should' }, 'SHOULD'));
        const add = () => { if (text.value.trim()) update({ custom: [...cfg.custom, { d: id, l: lvl.value, x: text.value }] }); };
        text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

        const ids = rules.map((r) => r.id);
        const without = (arr) => arr.filter((x) => !ids.includes(x));
        draw();
        return [
            head('Area', d.name, d.blurb),
            !on && h('div', { class: 'banner' }, h('span', {}, 'This area is off, so none of its rules are installed.'),
                h('button', { type: 'button', class: 'btn small go', onclick: () => update({ domains: [...cfg.domains, id] }) }, `Turn on ${d.name}`)),
            h('div', { class: 'toolbar' },
                h('input', { type: 'text', class: 'search', placeholder: 'Filter rules', 'aria-label': 'Filter rules', value: ui.q, oninput: (e) => { ui.q = e.target.value; draw(); } }),
                h('div', { class: 'toggle', role: 'group', 'aria-label': 'Show' }, ['all', 'on', 'off', 'must', 'should', 'enforced'].map((f) => h('button', { type: 'button', 'aria-pressed': String(ui.filter === f), onclick: (e) => {
                    ui.filter = f;
                    for (const b of e.target.parentNode.children) b.setAttribute('aria-pressed', String(b === e.target));
                    draw();
                } }, f))),
                count,
                h('span', { class: 'spacer' }),
                on && h('button', { type: 'button', class: 'btn small', onclick: () => update({ off: without(cfg.off), on: [...without(cfg.on), ...rules.filter((r) => !isDefaultOn(r, cfg)).map((r) => r.id)] }) }, 'All on'),
                on && h('button', { type: 'button', class: 'btn small', onclick: () => update({ off: without(cfg.off), on: without(cfg.on) }) }, `Reset to ${cfg.strictness}`)),
            list,
            on && h('div', { class: 'add' }, text, lvl, h('button', { type: 'button', class: 'btn small go', onclick: add }, 'Add rule'))
        ];
    },

    import() {
        const preview = h('div', { id: 'rules-preview', role: 'status', 'aria-live': 'polite' });
        const fallback = h('select', { id: 'rules-fallback' }, DOMAINS.map((d) => h('option', { value: d.id }, d.name)));
        const text = h('textarea', { id: 'rules-text', rows: 6, spellcheck: false, placeholder: 'rule,level,area,source\n"Get approval before using AI on performance data.",must,HR,AI Policy 5.2' });
        const templates = policyTemplates();
        const group = (kind, label) => h('optgroup', { label }, templates.filter((t) => t.kind === kind).map((t) => h('option', { value: t.id }, t.name)));
        const tplPick = h('select', { id: 'tpl-pick' }, group('persona', 'By role'), group('area', 'By area'));
        let pending = null;

        const show = (res, name) => {
            pending = res.rules.length || res.on.length ? res : null;
            const byArea = {};
            for (const r of res.rules) byArea[r.d] = (byArea[r.d] || 0) + 1;
            const reasons = {};
            for (const s of res.skipped) (reasons[s.reason] ||= []).push(s.row);
            const areasIn = new Set([...Object.keys(byArea), ...res.on.map((id) => id.split('.')[0])]);
            const newAreas = [...areasIn].filter((d) => !cfg.domains.includes(d)).map((d) => domain(d).name);
            const from = name ? ` in ${name}` : '';
            const summary = res.rules.length
                ? `Found ${plural(res.rules.length, 'rule')} of your own${from}: ${Object.entries(byArea).map(([d, n]) => `${n} ${domain(d).name}`).join(' · ')}.`
                : res.on.length ? `Read the template${from}. No rule text was changed.` : `No rules could be read${name ? ` from ${name}` : ''}.`;
            fill(preview,
                h('p', { class: 'sum' + (pending ? '' : ' bad') }, summary),
                (res.notes.length || res.skipped.length || newAreas.length) ? h('ul', {},
                    res.notes.map((n) => h('li', {}, n)),
                    Object.entries(reasons).map(([why, rows]) => h('li', {}, `Skipped ${rows.length} (${why}): row${rows.length > 1 ? 's' : ''} ${rows.slice(0, 12).join(', ')}${rows.length > 12 ? '…' : ''}.`)),
                    newAreas.length ? h('li', {}, `Applying this also turns on: ${newAreas.join(', ')}.`) : null) : null,
                res.rules.length ? ruleTable(res.rules.slice(0, 100)) : null,
                res.rules.length > 100 ? h('p', { class: 'hint' }, `Showing the first 100 of ${res.rules.length}.`) : null,
                pending ? h('div', { class: 'row' },
                    h('button', { type: 'button', class: 'btn small go', onclick: () => {
                        const applied = pending;
                        update(applyImport(cfg, applied));
                        toast(applied.on.length ? 'Template applied' : `Added ${plural(applied.rules.length, 'rule')}`);
                    } }, res.on.length ? 'Apply this template' : `Add ${plural(res.rules.length, 'rule')}`),
                    h('button', { type: 'button', class: 'btn small', onclick: () => { pending = null; fill(preview); } }, 'Discard')) : null);
        };
        const read = (body, name) => show(parseRules(body, { name, fallback: fallback.value, existing: cfg.custom }), name);
        const readFile = async (file) => {
            if (!file) return;
            if (file.size > 2_000_000) return show({ rules: [], on: [], off: [], replaces: [], skipped: [], notes: ['That file is larger than 2 MB. Export only the rules.'] }, file.name);
            read(await file.text(), file.name);
        };

        const input = h('input', { type: 'file', id: 'rules-file', accept: '.csv,.tsv,.json,.txt,text/csv,application/json', onchange: (e) => { readFile(e.target.files[0]); e.target.value = ''; } });
        const drop = h('div', { class: 'drop', id: 'rules-drop' }, input, h('label', { for: 'rules-file', class: 'btn small' }, 'Choose a file'), h('span', {}, 'or drop one here, or paste below'));
        for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
        for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); });
        drop.addEventListener('drop', (e) => readFile(e.dataTransfer?.files?.[0]));

        return [
            head('Your rules', 'Templates and import', 'Download a policy template to edit, or bring the rules your organization already keeps. Files are read in this tab and are not uploaded anywhere.'),
            h('section', { class: 'block first' },
                h('h2', {}, 'Start from a policy template'),
                h('p', { class: 'hint' }, 'Download the rules for a role or an area as a CSV file. Edit the wording in a spreadsheet, delete the rows that do not apply and add rows of your own. Then import the file below. Rows you leave alone stay catalog rules, and rows you change become your rules.'),
                h('div', { class: 'row' },
                    h('label', { for: 'tpl-pick', class: 'hint' }, 'Template'), tplPick,
                    h('button', { type: 'button', class: 'btn small go', id: 'tpl-download', onclick: () => download(templateFileName(tplPick.value), templateCsv(tplPick.value)) }, 'Download CSV'))),
            h('section', { class: 'block' },
                h('h2', {}, 'Import a file'),
                h('p', { class: 'hint' }, 'Columns or keys: ', h('code', {}, 'rule'), ' ', h('code', {}, 'level'), ' ', h('code', {}, 'area'), ' ', h('code', {}, 'source'), '. Only ', h('code', {}, 'rule'), ' is required. A template also has ', h('code', {}, 'id'), ' and ', h('code', {}, 'title'), '.'),
                drop,
                h('div', { class: 'field' }, h('label', { for: 'rules-text' }, 'Paste CSV or JSON'), text),
                h('div', { class: 'row' },
                    h('label', { for: 'rules-fallback', class: 'hint' }, 'Area when a rule names none'), fallback,
                    h('button', { type: 'button', class: 'btn small go', id: 'rules-parse', onclick: () => read(text.value, '') }, 'Read rules'),
                    h('button', { type: 'button', class: 'btn small', id: 'rules-tpl-csv', onclick: () => download('komainu-rules-blank.csv', TEMPLATE_CSV) }, 'Blank CSV'),
                    h('button', { type: 'button', class: 'btn small', id: 'rules-tpl-json', onclick: () => download('komainu-rules-blank.json', TEMPLATE_JSON) }, 'Blank JSON')),
                preview),
            cfg.custom.length ? h('section', { class: 'block' },
                h('div', { class: 'mine' }, h('h2', {}, `${plural(cfg.custom.length, 'rule')} of your own`),
                    h('button', { type: 'button', onclick: () => { update({ custom: [] }); toast('Your rules were removed'); } }, 'Remove all')),
                ruleTable(cfg.custom, (i) => update({ custom: cfg.custom.filter((_, n) => n !== i) }))) : null
        ];
    }
};

function ruleTable(rules, onRemove) {
    return h('div', { class: 'mini' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Area', 'Level', 'Rule', 'Source', onRemove && ''].filter((t) => t !== undefined && t !== false).map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, rules.map((r, i) => h('tr', {}, h('td', {}, domain(r.d).name), h('td', {}, r.l), h('td', {}, r.x), h('td', {}, r.src || ''),
            onRemove && h('td', {}, h('button', { type: 'button', class: 'x-btn', onclick: () => onRemove(i) }, 'Remove')))))));
}

function renderMain() {
    const [name, arg] = ui.view.split(':');
    fill($('main'), views[name](arg));
}

// ── right: output ───────────────────────────────────────────────────────────
function renderStats() {
    const s = stats(cfg);
    const meter = h('div', { class: 'meter', role: 'img', 'aria-label': `${s.enforced} enforced, ${s.instructed} instructed, ${s.attested} attested` });
    for (const k of ['enforced', 'instructed', 'attested']) if (s[k]) { const i = h('i', { class: k }); i.style.flex = String(s[k]); meter.append(i); }
    fill($('stats'),
        h('div', { class: 'big' }, `${plural(s.total, 'rule')} `, h('small', {}, `${s.must} must · ${s.should} should · ${plural(cfg.domains.length, 'area')}`)),
        meter,
        h('div', { class: 'legend' }, ['enforced', 'instructed', 'attested'].map((k) => h('span', { title: COVERAGE[k].blurb }, h('span', { class: 'dot ' + k }), h('b', {}, String(s[k])), ' ' + COVERAGE[k].name.toLowerCase()))));
    $('top-count').textContent = `${plural(s.total, 'rule')} · ${plural(generate(cfg).length, 'file')}`;
}

const shellToggle = () => h('div', { class: 'toggle', role: 'group', 'aria-label': 'Shell' },
    [['sh', 'macOS / Linux'], ['ps', 'Windows']].map(([id, name]) => h('button', { type: 'button', 'aria-pressed': String(ui.shell === id), onclick: () => { ui.shell = id; renderPanel(); } }, name)));

const command = () => cliCommand(cfg, { base: BASE, shell: ui.shell });

const panels = {
    command() {
        const files = generate(cfg);
        const cmd = command();
        const long = cmd.length > 6000;
        const label = ui.shell === 'ps' ? 'PowerShell' : 'Terminal';
        return [
            h('p', {}, `Run this in the root of the repository or folder where the guardrails should live. It writes ${plural(files.length, 'file')} and merges with what is already there.`),
            h('div', { class: 'pick' }, shellToggle()),
            ...(long ? [
                h('p', {}, h('strong', {}, 'This configuration is large. '), 'Some terminals cut very long commands, so download komainu.json into the folder and run the short command instead.'),
                codebox('komainu.json', JSON.stringify(compact(cfg), null, 2) + '\n', { file: 'komainu.json', nowrap: true }),
                codebox(label, cmd.replace(/apply \S+$/, 'apply'))
            ] : [codebox(label, cmd)]),
            h('ol', {},
                h('li', {}, ONLINE ? 'Downloads the Komainu CLI. It is one readable file with no dependencies, and it makes no network calls.' : 'Uses the komainu.mjs you downloaded with this page; keep it next to where you run the command.'),
                h('li', {}, 'Your choices are inside the command. No server received them.'),
                h('li', {}, 'Needs Node.js 18 or newer. Add --dry-run to preview without writing.'))
        ];
    },
    script() {
        const ps = ui.shell === 'ps';
        const text = ps ? powershellScript(cfg) : bashScript(cfg);
        const name = ps ? 'install-guardrails.ps1' : 'install-guardrails.sh';
        return [
            h('p', {}, 'A self-contained installer with every file inside it. No download and no Node.js needed. It never overwrites an existing file.'),
            h('div', { class: 'pick' }, shellToggle()),
            codebox(`${name} · ${Math.ceil(text.length / 1024)} KB`, text, { file: name, nowrap: true }),
            h('p', {}, ps ? 'Paste into PowerShell, or download and run: ./install-guardrails.ps1' : 'Paste into a terminal, or download and run: bash install-guardrails.sh')
        ];
    },
    agent() {
        return [
            h('p', {}, 'Paste this into your coding agent. It reads your internal policy documents on your machine, maps each clause to a rule, shows you the gaps, and only then installs.'),
            codebox('Prompt', agentPrompt(cfg, { base: BASE }))
        ];
    },
    files() {
        const files = generate(cfg);
        ui.file = Math.min(ui.file, files.length - 1);
        const f = files[ui.file];
        const writable = files.filter((x) => x.mode !== 'self');
        const downloadAll = () => download('komainu-guardrails.zip', zip(writable), 'application/zip');
        const modes = { file: 'written by Komainu', block: 'managed block inside your file', json: 'merged into your settings', self: 'a copy of the CLI' };
        return [
            h('ul', { class: 'tree', id: 'file-tree' }, files.map((x, i) => h('li', {}, h('button', { type: 'button', 'aria-current': i === ui.file ? 'true' : null, onclick: () => { ui.file = i; renderPanel(); } }, x.path)))),
            codebox(`${f.path} · ${modes[f.mode]}`, f.mode === 'self' ? '(The komainu CLI copies itself here so the MCP server can run from the repository.)' : f.content, { file: f.mode === 'self' ? null : f.path.split('/').pop(), nowrap: f.path.endsWith('.mjs') || f.path.endsWith('.json'), actions: [['Download all', downloadAll]] }),
            h('p', {}, `"Download all" saves ${plural(writable.length, 'file')} as one zip, in the folders shown above. Unzip it in the root of your repository. Unzipping replaces files of the same name, so use the command if the folder already has files such as AGENTS.md.${writable.length < files.length ? ' The copy of the CLI is not included; the command and the offline script cover it.' : ''}`)
        ];
    },
    quiz() {
        const options = { count: ui.quizCount, seed: ui.quizSeed ? String(ui.quizSeed) : '' };
        const made = buildQuiz(cfg, options);
        const link = ONLINE ? quizLink(cfg, options, BASE) : '';
        const scenarios = made.questions.filter((q) => q.type === 'scenario').length;
        const sample = made.questions.find((q) => q.type === 'scenario') || made.questions[0];
        const save = (id) => download(QUIZ_FORMATS[id].file, QUIZ_FORMATS[id].render(made), QUIZ_FORMATS[id].type);
        return [
            h('p', {}, 'A quiz made from the rules you selected, to share with your team for training. The HTML file works on its own: people open it, answer, and see the reason behind each answer. It records nothing.'),
            h('div', { class: 'pick' },
                h('label', { for: 'quiz-count' }, 'Questions'),
                h('select', { id: 'quiz-count', onchange: (e) => { ui.quizCount = Number(e.target.value); renderPanel(); } }, QUIZ_SIZES.map((n) => h('option', { value: n, selected: n === ui.quizCount }, String(n)))),
                h('button', { type: 'button', class: 'btn small', id: 'quiz-shuffle', onclick: () => { ui.quizSeed++; renderPanel(); } }, 'Different questions')),
            h('p', { id: 'quiz-summary' }, `${plural(made.total, 'question')}: ${scenarios} from written situations, ${made.total - scenarios} generated from the rule text. They cover ${plural(new Set(made.questions.map((q) => q.rule).filter(Boolean)).size, 'rule')}.`),
            h('div', { class: 'row' },
                h('button', { type: 'button', class: 'btn small go', id: 'quiz-html', onclick: () => save('html') }, 'Download quiz (HTML)'),
                h('button', { type: 'button', class: 'btn small', id: 'quiz-md', onclick: () => save('md') }, 'Markdown'),
                h('button', { type: 'button', class: 'btn small', id: 'quiz-csv', onclick: () => save('csv') }, 'CSV')),
            link ? codebox('Quiz link', link) : null,
            link ? h('p', {}, h('a', { id: 'quiz-open', href: link, target: '_blank', rel: 'noopener' }, 'Open the quiz in a new tab'), '. Anyone with the link gets the same questions. The rules sit after the # in the address, which browsers do not send to any server, and your sensitive names are left out of it.') : null,
            sample ? codebox(`Sample: question ${sample.n}`, `${sample.prompt}\n\n${sample.options.map((o, n) => `${'ABCD'[n]}. ${o}`).join('\n')}\n\nAnswer: ${'ABCD'[sample.answer]}`) : null,
            h('p', {}, 'Markdown suits printing and wikis. CSV has one row per question for a form builder or a learning system.')
        ];
    },
    share() {
        const link = `${location.href.split('#')[0]}#c=${encode(cfg)}`;
        return [
            h('p', {}, 'Send this link to a colleague to continue from the same choices. The configuration sits after the # in the address, which browsers do not send to any server.'),
            codebox('Share link', link),
            cfg.terms.length ? h('p', {}, h('strong', {}, 'Careful: '), 'this configuration contains your sensitive names. Share it only with people allowed to see them.') : null,
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
        try { loadConfig(m[1], 'Loaded shared configuration'); return true; } catch { return false; }
    };
    window.addEventListener('hashchange', fromHash);
    if (!fromHash()) { renderSide(); renderMain(); renderOutput(); }
}

init();
