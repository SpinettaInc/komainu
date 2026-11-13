import { DOMAINS, RULES, STRICTNESS, TARGETS, REDACT_CLASSES, ATTESTED } from './catalog.js';
import { langOf, ruleIn, domainIn, text } from './i18n.js';

export const MAX_CUSTOM = 300;

export const DEFAULT_CONFIG = Object.freeze({
    v: 1,
    org: '',
    strictness: 'balanced',
    domains: ['core', 'coding', 'security', 'data'],
    on: [],
    off: [],
    custom: [],
    tools: '',
    contact: '',
    levels: ['Public', 'Internal', 'Confidential', 'Restricted'],
    hostedMax: 'Internal',
    local: '',
    redact: ['secrets', 'cc', 'iban', 'ssn'],
    terms: [],
    targets: ['agents', 'claude', 'hooks', 'policy'],
    cite: true,
    lang: 'en',
    // true: the hook records what it would stop and stops nothing
    observe: false
});

// Control characters are stripped from every text field on purpose.
// eslint-disable-next-line no-control-regex
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, max).trim();
const list = (v, allowed) => [...new Set((Array.isArray(v) ? v : []).map(String))].filter((x) => !allowed || allowed.includes(x));

/** Returns a complete, safe config from any partial or untrusted input. */
export function normalize(input) {
    const c = { ...DEFAULT_CONFIG, ...(input && typeof input === 'object' ? input : {}) };
    const ruleIds = RULES.map((r) => r.id);
    const domainIds = DOMAINS.map((d) => d.id);
    const levels = list(c.levels).map((l) => str(l, 40)).filter(Boolean).slice(0, 8);
    const out = {
        v: 1,
        org: str(c.org, 80),
        strictness: STRICTNESS.some((s) => s.id === c.strictness) ? c.strictness : 'balanced',
        domains: ['core', ...list(c.domains, domainIds).filter((d) => d !== 'core')],
        on: list(c.on, ruleIds),
        off: list(c.off, ruleIds),
        custom: (Array.isArray(c.custom) ? c.custom : []).slice(0, MAX_CUSTOM).map((r) => ({
            d: domainIds.includes(r?.d) ? r.d : 'core',
            l: r?.l === 'should' ? 'should' : 'must',
            x: str(r?.x, 600),
            ...(str(r?.src, 120) ? { src: str(r.src, 120) } : {})
        })).filter((r) => r.x),
        tools: str(c.tools, 300),
        contact: str(c.contact, 120),
        levels: levels.length >= 2 ? levels : [...DEFAULT_CONFIG.levels],
        hostedMax: str(c.hostedMax, 40),
        local: str(c.local, 160),
        redact: list(c.redact, REDACT_CLASSES.map((r) => r.id)),
        terms: list(c.terms).map((t) => str(t, 60)).filter((t) => t.length >= 2).slice(0, 200),
        targets: list(c.targets, TARGETS.map((t) => t.id)),
        cite: c.cite !== false,
        lang: langOf(c.lang),
        observe: c.observe === true
    };
    if (!out.levels.includes(out.hostedMax)) out.hostedMax = out.levels[Math.min(1, out.levels.length - 1)];
    out.on = out.on.filter((id) => !out.off.includes(id));
    return out;
}

const tierOf = (cfg) => STRICTNESS.find((s) => s.id === cfg.strictness).tier;

/** Is a catalog rule on by default for this config (before on/off overrides)? */
export const isDefaultOn = (rule, cfg) => cfg.domains.includes(rule.d) && rule.tier <= tierOf(cfg);

export const isActive = (rule, cfg) =>
    cfg.domains.includes(rule.d) && !cfg.off.includes(rule.id) && (rule.tier <= tierOf(cfg) || cfg.on.includes(rule.id));

export function renderText(body, cfg) {
    const T = text(cfg.lang);
    const vars = {
        tools: cfg.tools || T.vars.tools,
        contact: cfg.contact || T.vars.contact,
        levels: cfg.levels.join(T.listSep),
        hostedMax: cfg.hostedMax,
        local: cfg.local || T.vars.local
    };
    return body.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

/** How a rule is upheld, given the chosen targets. */
export function coverageOf(rule, cfg) {
    if (rule.enf) {
        const e = rule.enf;
        const hook = cfg.targets.includes('hooks') && (e.bash || e.paths || (e.scan === 'secrets' && cfg.redact.includes('secrets')) || (e.scan === 'pii' && cfg.redact.some((c) => c !== 'secrets')));
        const perms = cfg.targets.includes('claude') && (e.deny || e.ask);
        if (hook || perms) return 'enforced';
    }
    return ATTESTED.has(rule.id) ? 'attested' : 'instructed';
}

/** Active rules grouped by domain, with rendered text and coverage level. */
export function activeRules(cfg) {
    const groups = [];
    for (const d of DOMAINS) {
        if (!cfg.domains.includes(d.id)) continue;
        const rules = RULES.filter((r) => r.d === d.id && isActive(r, cfg)).map((r) => {
            const local = ruleIn(cfg.lang, r);
            return { ...local, x: renderText(local.x, cfg), cov: coverageOf(r, cfg) };
        });
        cfg.custom.filter((c) => c.d === d.id).forEach((c, i) => rules.push({ id: `custom.${d.id}.${i + 1}`, d: d.id, t: '', x: renderText(c.x, cfg), l: c.l, tier: 0, refs: c.src ? [c.src] : [], cov: 'instructed', custom: true }));
        rules.sort((a, b) => (a.l === b.l ? 0 : a.l === 'must' ? -1 : 1));
        if (rules.length) groups.push({ domain: domainIn(cfg.lang, d.id), rules });
    }
    return groups;
}

export function stats(cfg) {
    const all = activeRules(cfg).flatMap((g) => g.rules);
    const count = (k, v) => all.filter((r) => r[k] === v).length;
    return { total: all.length, must: count('l', 'must'), should: count('l', 'should'), enforced: count('cov', 'enforced'), instructed: count('cov', 'instructed'), attested: count('cov', 'attested') };
}

// ── Encoding: compact JSON → base64url. Only non-default fields are kept. ──
const fromB64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

export function compact(cfg) {
    const c = normalize(cfg);
    const out = { v: 1 };
    for (const k of Object.keys(DEFAULT_CONFIG)) {
        if (k !== 'v' && JSON.stringify(c[k]) !== JSON.stringify(DEFAULT_CONFIG[k])) out[k] = c[k];
    }
    return out;
}

export function encode(cfg) {
    const json = JSON.stringify(compact(cfg));
    let bin = '';
    for (const b of new TextEncoder().encode(json)) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Accepts a base64url token, a JSON string, or text containing either. */
export function decode(input) {
    const s = String(input || '').trim();
    if (!s) throw new Error('Empty configuration');
    if (s.startsWith('{')) return normalize(JSON.parse(s));
    // Every token is base64url of a JSON object, so it always starts with "eyJ".
    const token = (s.match(/eyJ[A-Za-z0-9_-]{5,}/g) || []).sort((a, b) => b.length - a.length)[0];
    if (!token) throw new Error('No configuration found in input');
    let parsed;
    try { parsed = JSON.parse(fromB64u(token)); } catch { throw new Error('Configuration is not valid (could not decode)'); }
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) throw new Error('Unsupported configuration version');
    return normalize(parsed);
}

/** The contact to name in generated text: the configured one, or the default wording. */
export const contactOf = (cfg) => cfg.contact || text(cfg.lang).vars.contact;
