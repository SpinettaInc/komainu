// Policy templates: the catalog rules for a persona or an area, as a CSV file
// that people edit in a spreadsheet and import again.

import { DOMAINS, PRESETS, RULES } from './catalog.js';
import { normalize, isActive } from './config.js';

export const TEMPLATE_COLUMNS = ['id', 'area', 'level', 'title', 'rule', 'source'];

/** Every template on offer: one per persona, then one per area. */
export function policyTemplates() {
    return [
        ...PRESETS.map((p) => ({ id: p.id, kind: 'persona', name: p.name, blurb: p.blurb })),
        ...DOMAINS.map((d) => ({ id: `area-${d.id}`, kind: 'area', name: d.name, blurb: d.blurb }))
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

/** Rules as CSV. `source` is left empty for the organization's own policy clause. */
export function rulesCsv(rules) {
    const rows = rules.map((r) => [r.id, DOMAINS.find((d) => d.id === r.d).name, r.l, r.t, r.x, '']);
    return [TEMPLATE_COLUMNS, ...rows].map((row) => row.map(cell).join(',')).join('\n') + '\n';
}

export function templateCsv(id) {
    const rules = templateRules(id);
    return rules ? rulesCsv(rules) : null;
}

export const templateFileName = (id) => `komainu-policy-${id.replace(/^area-/, '')}.csv`;
