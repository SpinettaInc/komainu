// Parses an organization's own rules from CSV or JSON into custom rules.
// It does not throw on odd rows. It reports them.

import { DOMAINS, RULES } from './catalog.js';
import { MAX_CUSTOM } from './config.js';

const MAX_TEXT = 600;

// Column and key names people use, mapped to our fields.
const FIELDS = {
    id: ['id', 'rule id', 'key'],
    t: ['title', 'name', 'summary'],
    x: ['rule', 'rules', 'text', 'description', 'requirement', 'policy', 'statement', 'guardrail', 'guideline', 'control', 'instruction', 'x'],
    l: ['level', 'severity', 'priority', 'type', 'strength', 'obligation', 'l'],
    d: ['area', 'domain', 'category', 'team', 'department', 'function', 'scope', 'group', 'd'],
    src: ['source', 'reference', 'ref', 'clause', 'section', 'policy id', 'document', 'citation', 'src']
};

const AREA_ALIASES = {
    core: ['general', 'all', 'everyone', 'universal', 'company', 'organisation', 'organization', 'global', 'common', 'any'],
    coding: ['engineering', 'development', 'dev', 'software', 'code', 'developers', 'programming', 'devops', 'tech'],
    security: ['infosec', 'information security', 'cyber', 'cybersecurity', 'sec'],
    data: ['privacy', 'data', 'data protection', 'data privacy', 'gdpr', 'data and privacy'],
    agents: ['agents', 'automation', 'agentic', 'ai agents', 'agents and automation'],
    communication: ['comms', 'communications', 'pr', 'internal comms', 'writing'],
    hr: ['human resources', 'people', 'people ops', 'recruiting', 'recruitment', 'talent', 'hiring'],
    sales: ['revenue', 'business development', 'account management'],
    marketing: ['brand', 'content', 'social', 'social media', 'advertising'],
    support: ['customer support', 'customer service', 'cs', 'helpdesk', 'help desk', 'service desk', 'customer success'],
    legal: ['compliance', 'legal and compliance', 'regulatory'],
    finance: ['accounting', 'treasury', 'payments', 'fp&a'],
    governance: ['governance and accountability', 'accountability', 'risk', 'risk management', 'leadership', 'board', 'executive', 'ai governance'],
    building: ['ai product teams', 'ai product', 'product', 'machine learning', 'ml', 'data science', 'model development', 'ai development'],
    controls: ['it and security controls', 'it', 'it operations', 'infrastructure', 'sysadmin', 'security controls', 'it admin'],
    public: ['public services', 'public sector', 'government', 'agency', 'citizen services'],
    health: ['health and care', 'healthcare', 'clinical', 'medical', 'care', 'patients'],
    education: ['school', 'schools', 'university', 'teaching', 'students', 'academic']
};

const MUST = ['must', 'shall', 'required', 'mandatory', 'critical', 'high', 'blocker', 'never', 'always', 'hard', 'error'];
const SHOULD = ['should', 'recommended', 'recommend', 'optional', 'advisory', 'medium', 'low', 'nice to have', 'prefer', 'soft', 'warning', 'warn', 'info'];

// Control characters are stripped from imported text on purpose.
// eslint-disable-next-line no-control-regex
const clean = (v) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
const key = (v) => clean(v).toLowerCase().replace(/&/g, 'and').replace(/[_-]+/g, ' ');

const fieldOf = (name) => Object.keys(FIELDS).find((f) => FIELDS[f].includes(key(name)));

/** "People Ops" → "hr". Returns null when nothing matches. */
export function areaId(value) {
    const k = key(value);
    if (!k) return null;
    for (const d of DOMAINS) {
        if (k === d.id || k === key(d.name) || AREA_ALIASES[d.id].includes(k)) return d.id;
    }
    for (const d of DOMAINS) {
        if ([d.id, key(d.name), ...AREA_ALIASES[d.id]].some((a) => a.length > 3 && k.includes(a))) return d.id;
    }
    return null;
}

/** Level from an explicit value, else from the wording of the rule itself. */
function levelOf(value, text) {
    const k = key(value);
    if (MUST.includes(k)) return 'must';
    if (SHOULD.includes(k)) return 'should';
    const t = ` ${text.toLowerCase()} `;
    const soft = /\b(should|recommended|prefer(ably)?|where possible|ideally|consider|try to|encouraged)\b/.test(t);
    const hard = /\b(must|shall|never|do not|don't|may not|only|always|prohibited|forbidden|required)\b/.test(t);
    return soft && !hard ? 'should' : 'must';
}

/** RFC 4180-style CSV with quoted fields; delimiter is detected (comma, semicolon or tab). */
export function parseCsv(text) {
    const src = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const firstLine = src.split('\n').find((l) => l.trim()) || '';
    const count = (ch) => firstLine.replace(/"[^"]*"/g, '').split(ch).length - 1;
    const delim = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (quoted) {
            if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"' && cell.trim() === '') { quoted = true; cell = ''; } else if (ch === delim) { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function recordsFromCsv(text, notes) {
    const rows = parseCsv(text);
    if (!rows.length) return [];
    // One-letter names are JSON keys of komainu.json, not column headers.
    const header = rows[0].map((name) => (clean(name).length > 1 ? fieldOf(name) : undefined));
    if (header.includes('x')) {
        const unknown = rows[0].filter((_, i) => !header[i] && rows[0][i].trim());
        if (unknown.length) notes.push(`Ignored column${unknown.length > 1 ? 's' : ''}: ${unknown.map(clean).join(', ')}.`);
        return rows.slice(1).map((r, i) => {
            const rec = { row: i + 2 };
            header.forEach((f, c) => { if (f && rec[f] === undefined) rec[f] = r[c]; });
            return rec;
        });
    }
    // No recognizable header: take the longest column as the rule text.
    const width = Math.max(...rows.map((r) => r.length));
    const avg = (c) => rows.reduce((n, r) => n + clean(r[c]).length, 0) / rows.length;
    let textCol = 0;
    for (let c = 1; c < width; c++) if (avg(c) > avg(textCol)) textCol = c;
    notes.push(width > 1
        ? `No header row found, so column ${textCol + 1} was read as the rule text. Add a header row (rule, level, area, source) for full control.`
        : 'No header row found, so every line was read as one rule.');
    return rows.map((r, i) => ({ row: i + 1, x: r[textCol] }));
}

function recordsFromJson(data, notes) {
    const out = [];
    const push = (item, area) => {
        if (typeof item === 'string') { out.push({ row: out.length + 1, x: item, d: area }); return; }
        if (!item || typeof item !== 'object' || Array.isArray(item)) { out.push({ row: out.length + 1, x: '' }); return; }
        const own = {};
        for (const [k, v] of Object.entries(item)) {
            const f = fieldOf(k);
            if (f && own[f] === undefined && (typeof v === 'string' || typeof v === 'number')) own[f] = v;
        }
        const rec = { row: out.length + 1, d: area, ...own }; // a rule's own area beats its group
        out.push(rec);
    };
    if (Array.isArray(data)) { data.forEach((it) => push(it)); return out; }
    if (data && typeof data === 'object') {
        const list = ['rules', 'custom', 'guardrails', 'policies', 'items', 'data'].find((k) => Array.isArray(data[k]));
        if (list) {
            if (list === 'custom' && data.v === 1) notes.push('This is a komainu.json; only its custom rules were read. Use "Already have a configuration?" in step 1 to load all of it.');
            data[list].forEach((it) => push(it));
            return out;
        }
        // { "HR": ["rule", …], "Sales": [...] }
        const grouped = Object.entries(data).filter(([, v]) => Array.isArray(v));
        if (grouped.length) { for (const [area, items] of grouped) items.forEach((it) => push(it, area)); return out; }
    }
    throw new Error('JSON must be a list of rules, or an object with a "rules" list, or lists of rules keyed by area.');
}

/**
 * text → { format, rules, on, off, replaces, skipped, notes }
 *
 * `rules` are custom rules: [{ d, l, x, src? }].
 * A file with an `id` column is a policy template that was downloaded and
 * edited. For those rows:
 *   - an unchanged catalog rule is switched on (`on`);
 *   - an edited one is switched off (`off`) and added as a custom rule whose
 *     source is the rule id;
 *   - either way, an earlier edit of that rule is dropped (`replaces`);
 *   - a catalog rule missing from an area the file covers is switched off.
 *
 * `fallback` is the area for rules with no (or an unknown) area.
 * `existing` are the current custom rules, used to drop duplicates.
 */
export function parseRules(text, { name = '', fallback = 'core', existing = [] } = {}) {
    const body = String(text ?? '').replace(/^\uFEFF/, '').trim();
    const notes = [];
    const skipped = [];
    const empty = { rules: [], on: [], off: [], replaces: [], skipped };
    if (!body) return { format: null, ...empty, notes: ['The file is empty.'] };

    const looksJson = /\.json$/i.test(name) || /^[[{]/.test(body);
    let records;
    let format = 'csv';
    if (looksJson) {
        try {
            records = recordsFromJson(JSON.parse(body), notes);
            format = 'json';
        } catch (e) {
            if (/\.json$/i.test(name) || !body.includes('\n')) return { format: 'json', ...empty, notes: [`Could not read the JSON: ${e.message}`] };
            records = null; // not JSON; try CSV
        }
    }
    if (!records) records = recordsFromCsv(body, notes);

    const on = [];
    const off = [];
    const replaces = [];
    const listed = new Set();
    const kept = existing.filter((r) => !records.some((rec) => clean(rec.id) && clean(rec.id) === r.src));
    const seen = new Set(kept.map((r) => key(r.x)));
    const unknownAreas = new Set();
    const rules = [];
    let truncated = 0;
    let edited = 0;
    for (const rec of records) {
        let x = clean(rec.x);
        if (x.length < 4) {
            skipped.push({ row: rec.row, reason: x ? 'too short to be a rule' : 'no rule text' });
            continue;
        }
        const known = RULES.find((r) => r.id === clean(rec.id));
        const area = clean(rec.d);
        let d = areaId(area);
        if (!d) {
            if (area) unknownAreas.add(area);
            d = known ? known.d : fallback;
        }
        const l = levelOf(rec.l, x);
        if (known) {
            listed.add(known.id);
            replaces.push(known.id); // an earlier edit of this row no longer applies
            if (x === clean(known.x) && l === known.l && d === known.d) {
                on.push(known.id);
                continue;
            }
            off.push(known.id);
            edited++;
        }
        if (x.length > MAX_TEXT) {
            x = x.slice(0, MAX_TEXT).trim();
            truncated++;
        }
        if (seen.has(key(x))) {
            skipped.push({ row: rec.row, reason: 'duplicate' });
            continue;
        }
        if (rules.length + kept.length >= MAX_CUSTOM) {
            skipped.push({ row: rec.row, reason: `over the limit of ${MAX_CUSTOM} custom rules` });
            continue;
        }
        seen.add(key(x));
        const src = clean(rec.src).slice(0, 120) || (known ? known.id : '');
        rules.push({ d, l, x, ...(src ? { src } : {}) });
    }

    // A template is the full list for the areas it covers: a catalog rule that
    // was deleted from the file is switched off.
    if (listed.size) {
        const areas = new Set([...listed].map((id) => RULES.find((r) => r.id === id).d));
        const removed = RULES.filter((r) => areas.has(r.d) && !listed.has(r.id)).map((r) => r.id);
        off.push(...removed);
        notes.push(`This is a policy template with rule ids. ${on.length} catalog rule${on.length === 1 ? ' is' : 's are'} kept as written, ${edited} ${edited === 1 ? 'was' : 'were'} edited, and ${removed.length} not in the file ${removed.length === 1 ? 'is' : 'are'} switched off.`);
    }
    if (truncated) notes.push(`${truncated} rule${truncated > 1 ? 's were' : ' was'} longer than ${MAX_TEXT} characters and cut. Split long clauses into one obligation per rule.`);
    if (unknownAreas.size) notes.push(`Unrecognized area${unknownAreas.size > 1 ? 's' : ''} (${[...unknownAreas].slice(0, 6).join(', ')}) filed under ${DOMAINS.find((dom) => dom.id === fallback).name}.`);
    if (!rules.length && !on.length && !skipped.length) notes.push('No rules found.');
    return { format, rules, on, off, replaces, skipped, notes };
}

/**
 * Applies a parse result to a configuration and returns the new one.
 * Shared by the builder and the CLI so both treat a template the same way.
 */
export function applyImport(cfg, res) {
    const custom = [...cfg.custom.filter((c) => !res.replaces.includes(c.src)), ...res.rules];
    const touched = new Set([...res.rules.map((r) => r.d), ...res.on.map((id) => RULES.find((r) => r.id === id).d)]);
    return {
        ...cfg,
        custom,
        on: [...new Set([...cfg.on.filter((id) => !res.off.includes(id)), ...res.on])],
        off: [...new Set([...cfg.off.filter((id) => !res.on.includes(id)), ...res.off])],
        domains: [...new Set([...cfg.domains, ...touched])]
    };
}

export const TEMPLATE_CSV = [
    'rule,level,area,source',
    '"Get approval from the People team before using AI on performance data.",must,HR,AI Policy 5.2',
    '"Never paste customer contracts into an AI tool that Legal has not approved.",must,Legal,Security Policy 4.1',
    '"Prefer the internal style guide over the assistant\'s default tone.",should,Marketing,Brand Guide 2',
    '"Run the linter and the test suite before proposing a commit.",should,Engineering,'
].join('\n') + '\n';

export const TEMPLATE_JSON = JSON.stringify({
    rules: [
        { rule: 'Get approval from the People team before using AI on performance data.', level: 'must', area: 'HR', source: 'AI Policy 5.2' },
        { rule: 'Prefer the internal style guide over the assistant\'s default tone.', level: 'should', area: 'Marketing' },
        'A plain string works too: it is read as a MUST rule for everyone.'
    ]
}, null, 2) + '\n';
