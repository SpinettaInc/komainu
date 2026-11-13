import { DOMAINS, RULES, STRICTNESS, TARGETS, REDACT_CLASSES, ATTESTED } from './catalog.js';

/** The whole catalog as Markdown: the skill's reference and the `catalog` command. */
export function catalogMarkdown() {
    const out = ['# Komainu guardrail catalog', '', 'Tier 1 rules are on at every strictness, tier 2 from `balanced`, tier 3 only at `strict`. Turn individual rules on or off with the `on` and `off` lists in komainu.json.', ''];
    out.push('Strictness: ' + STRICTNESS.map((s) => `\`${s.id}\` (${s.blurb})`).join(' '), '');
    for (const d of DOMAINS) {
        out.push(`## ${d.name} (\`${d.id}\`)`, '', d.blurb, '', '| Rule id | Level | Tier | Rule | Notes |', '|---|---|---|---|---|');
        for (const r of RULES.filter((x) => x.d === d.id)) {
            const notes = [r.enf ? 'machine-enforceable' : '', ATTESTED.has(r.id) ? 'attested' : '', ...r.refs].filter(Boolean).join('; ');
            out.push(`| \`${r.id}\` | ${r.l} | ${r.tier} | **${r.t}.** ${r.x.replace(/\|/g, '\\|')} | ${notes} |`);
        }
        out.push('');
    }
    out.push('## Targets', '', ...TARGETS.map((t) => `- \`${t.id}\`: ${t.name}. ${t.hint}. Writes ${t.files.map((f) => `\`${f}\``).join(', ')}.`), '');
    out.push('## Redaction classes', '', ...REDACT_CLASSES.map((c) => `- \`${c.id}\`: ${c.name} (${c.hint})`), '');
    return out.join('\n');
}
