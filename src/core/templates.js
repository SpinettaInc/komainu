// Policy templates: the catalog rules for a persona or an area, as a CSV file
// that people edit in a spreadsheet and import again.

import { DOMAINS, PRESETS, RULES } from './catalog.js';
import { normalize, isActive } from './config.js';
import { domainIn, presetIn, ruleIn } from './i18n.js';

export const TEMPLATE_COLUMNS = ['id', 'area', 'level', 'title', 'rule', 'source'];

/** Every template on offer, named in the given language: one per persona, then one per area. */
export function policyTemplates(lang = 'en') {
    return [
        ...PRESETS.map((p) => ({ id: p.id, kind: 'persona', name: presetIn(lang, p.id).name, blurb: presetIn(lang, p.id).blurb })),
        ...DOMAINS.map((d) => ({ id: `area-${d.id}`, kind: 'area', name: domainIn(lang, d.id).name, blurb: domainIn(lang, d.id).blurb }))
    ];
}

/** The catalog rules a template contains. Area templates hold every rule of the area. */
export function templateRules(id) {
    const preset = PRESETS.find((p) => p.id === id);
    if (preset) {
        const cfg = normalize(preset.cfg);
        return RULES.filter((r) => isActive(r, cfg));
    }
    const area = DOMAINS.find((d) => `area-${d.id}` === id);
    if (area) return RULES.filter((r) => r.d === area.id);
    return null;
}

const cell = (v) => (/[",\n\r]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/**
 * Rules as CSV, written in the given language. The column names stay in
 * English so the file imports the same way everywhere. `source` is left empty
 * for the organization's own policy clause.
 */
export function rulesCsv(rules, lang = 'en') {
    const rows = rules.map((r) => {
        const local = ruleIn(lang, r);
        return [r.id, domainIn(lang, r.d).name, r.l, local.t, local.x, ''];
    });
    return [TEMPLATE_COLUMNS, ...rows].map((row) => row.map(cell).join(',')).join('\n') + '\n';
}

export function templateCsv(id, lang = 'en') {
    const rules = templateRules(id);
    return rules ? rulesCsv(rules, lang) : null;
}

export const templateFileName = (id) => `komainu-policy-${id.replace(/^area-/, '')}.csv`;
