import test from 'node:test';
import assert from 'node:assert/strict';

import { TARGETS, DOMAINS, PRESETS, RULES } from '../src/core/catalog.js';
import { normalize, compact, stats } from '../src/core/config.js';
import { generate, rulesMarkdown, mergeBlock, mergeJson, BLOCK_START, BLOCK_END } from '../src/core/generate.js';
import { FULL, git } from './helpers.mjs';

const file = (cfg, path) => generate(cfg).find((f) => f.path === path);
const paths = (cfg) => generate(cfg).map((f) => f.path);
const PACKS = 'docs/ai-guardrails/assistant-instructions/';

test('generation is deterministic', () => {
    assert.deepEqual(generate(FULL), generate(FULL));
});

test('komainu.json is always written and holds the compact configuration', () => {
    assert.deepEqual(paths({ targets: [] }), ['komainu.json']);
    assert.deepEqual(JSON.parse(file(FULL, 'komainu.json').content), compact(FULL));
});

const EXPECTED = {
    agents: ['AGENTS.md'],
    claude: ['CLAUDE.md', '.claude/settings.json'],
    hooks: ['.claude/settings.json', '.claude/hooks/komainu-guard.mjs'],
    cursor: ['.cursor/rules/komainu-guardrails.mdc'],
    copilot: ['.github/copilot-instructions.md'],
    gemini: ['GEMINI.md'],
    windsurf: ['.windsurf/rules/komainu-guardrails.md'],
    policy: ['docs/ai-guardrails/ai-acceptable-use-policy.md'],
    assistants: ['everyone', 'coding', 'security', 'data'].map((n) => `${PACKS}${n}.md`),
    mcp: ['.mcp.json', '.komainu/komainu.mjs']
};

for (const t of TARGETS) {
    test(`target ${t.id} writes exactly its files`, () => {
        assert.deepEqual(paths({ targets: [t.id] }), ['komainu.json', ...EXPECTED[t.id]]);
    });
}

test('every target has an expectation', () => {
    assert.deepEqual(Object.keys(EXPECTED).sort(), TARGETS.map((t) => t.id).sort());
});

for (const p of PRESETS) {
    test(`template "${p.name}" generates non-empty, well-formed files`, () => {
        for (const f of generate(p.cfg)) {
            assert.ok(['file', 'block', 'json', 'self'].includes(f.mode));
            if (f.mode !== 'self') assert.ok(f.content.endsWith('\n') && f.content.length > 10, f.path);
            if (f.mode === 'json' || f.path.endsWith('.json')) assert.doesNotThrow(() => JSON.parse(f.content), f.path);
            if (f.mode === 'block') assert.ok(f.content.startsWith(BLOCK_START) && f.content.trimEnd().endsWith(BLOCK_END), f.path);
            assert.ok(!/undefined|\[object Object\]|NaN/.test(f.content), `${f.path} has no leaked placeholder`);
        }
    });
}

test('rule lines carry the level, the title and the text', () => {
    const md = rulesMarkdown(normalize({}));
    assert.match(md, /^## AI guardrails$/m);
    assert.match(md, /^- MUST: A human owns every output\. Treat AI output as a draft\./m);
    assert.match(md, /^- SHOULD: /m);
    assert.ok(!md.includes('**'), 'no bold markup');
    assert.ok(!md.includes('{'), 'every placeholder is rendered');
});

test('rules can be limited to some areas and re-levelled for a standalone file', () => {
    const cfg = normalize({ domains: ['core', 'hr', 'sales'] });
    const md = rulesMarkdown(cfg, { only: ['core', 'hr'], heading: '#' });
    assert.match(md, /^# AI guardrails$/m);
    assert.match(md, /^## Human resources$/m);
    assert.ok(!md.includes('## Sales'));
});

test('the data section reflects levels, route, redaction and terms', () => {
    const md = rulesMarkdown(normalize({ levels: ['Open', 'Staff', 'Secret'], hostedMax: 'Open', local: 'the on-prem endpoint', terms: ['Falcon'], redact: ['secrets', 'cc'] }));
    assert.match(md, /lowest to highest: Open → Staff → Secret\./);
    assert.match(md, /up to and including Open\./);
    assert.match(md, /Data classified Staff or Secret goes only via the on-prem endpoint\./);
    assert.match(md, /`\[REDACTED_SECRET\]`, `\[REDACTED_CC\]`/);
    assert.match(md, /list of sensitive names/);
    const top = rulesMarkdown(normalize({ levels: ['A', 'B'], hostedMax: 'B', redact: [], terms: [] }));
    assert.ok(!top.includes('goes only via') && !top.includes('Redact before use') && !top.includes('sensitive names'));
});

test('sensitive terms appear only in the configuration and the hook', () => {
    for (const f of generate(FULL)) {
        const allowed = /komainu\.json$|komainu-guard\.mjs$/.test(f.path);
        assert.equal(f.content.includes('Project Falcon'), allowed, f.path);
    }
});

test('the organization name and contact reach the files', () => {
    const md = file({ org: 'Example Org', contact: 'the security team', targets: ['agents'] }, 'AGENTS.md').content;
    assert.match(md, /## AI guardrails for Example Org/);
    assert.match(md, /Questions and incidents go to the security team\./);
});

test('CLAUDE.md imports AGENTS.md when both are chosen and stands alone otherwise', () => {
    assert.match(file({ targets: ['agents', 'claude'] }, 'CLAUDE.md').content, /^@AGENTS\.md$/m);
    const alone = file({ targets: ['claude'] }, 'CLAUDE.md').content;
    assert.ok(!alone.includes('@AGENTS.md') && alone.includes('- MUST: '));
});

test('Claude settings hold permissions for claude and hooks for hooks', () => {
    const both = JSON.parse(file({ targets: ['claude', 'hooks'] }, '.claude/settings.json').content);
    assert.ok(both.permissions.deny.includes('Read(./.env)'));
    assert.ok(both.permissions.ask.includes(`Bash(${git('push', '*')})`));
    assert.equal(both.hooks.PreToolUse.length, 1);
    assert.equal(both.hooks.UserPromptSubmit.length, 1);
    assert.match(both.hooks.PreToolUse[0].hooks[0].command, /komainu-guard\.mjs$/);
    assert.equal(JSON.parse(file({ targets: ['hooks'] }, '.claude/settings.json').content).permissions, undefined);
    assert.equal(JSON.parse(file({ targets: ['claude'] }, '.claude/settings.json').content).hooks, undefined);
});

test('turning a rule off removes its permissions', () => {
    const s = JSON.parse(file({ targets: ['claude'], off: ['coding.secret-files'] }, '.claude/settings.json').content);
    assert.equal(s.permissions.deny, undefined);
    assert.equal(file({ targets: ['claude'], domains: ['core'] }, '.claude/settings.json'), undefined, 'no permissions, so no file');
});

test('the Cursor rule file has frontmatter and is always applied', () => {
    assert.match(file({ targets: ['cursor'] }, '.cursor/rules/komainu-guardrails.mdc').content, /^---\ndescription: .+\nalwaysApply: true\n---\n\n# AI guardrails/);
});

test('the policy lists every active rule with how it is upheld', () => {
    const cfg = normalize(FULL);
    const policy = file(cfg, 'docs/ai-guardrails/ai-acceptable-use-policy.md').content;
    assert.match(policy, /^# AI acceptable-use policy: Example Org$/m);
    for (const r of RULES) assert.ok(policy.includes(r.t), r.id);
    const s = stats(cfg);
    assert.ok(policy.includes(`| ${s.enforced} | ${s.instructed} | ${s.attested} |`));
    assert.equal((policy.match(/^- \[ \] /gm) || []).length, s.attested, 'one checklist line per attested rule');
    assert.match(policy, /## 8\. Framework references/);
    assert.ok(!file({ ...FULL, cite: false }, 'docs/ai-guardrails/ai-acceptable-use-policy.md').content.includes('Framework references'));
});

test('pipes in custom rules do not break the policy table', () => {
    const policy = file({ targets: ['policy'], custom: [{ d: 'core', x: 'Use A | B only.' }] }, 'docs/ai-guardrails/ai-acceptable-use-policy.md').content;
    assert.ok(policy.includes('Use A \\| B only.'));
});

test('there is one assistant pack per enabled area, each with the universal rules', () => {
    const files = generate({ targets: ['assistants'], domains: ['core', 'hr', 'sales'] }).filter((f) => f.path.startsWith(PACKS));
    assert.deepEqual(files.map((f) => f.path.split('/').pop()), ['everyone.md', 'hr.md', 'sales.md']);
    assert.match(files[1].content, /^# AI guardrails, Human resources$/m);
    assert.ok(files[1].content.includes('## Universal') && files[1].content.includes('## Human resources') && !files[1].content.includes('## Sales'));
    assert.equal(generate({ ...FULL, targets: ['assistants'] }).length, DOMAINS.length + 1);
});

test('the MCP entry points at the copied CLI', () => {
    assert.deepEqual(JSON.parse(file({ targets: ['mcp'] }, '.mcp.json').content), { mcpServers: { komainu: { command: 'node', args: ['.komainu/komainu.mjs', 'mcp'] } } });
    assert.equal(file({ targets: ['mcp'] }, '.komainu/komainu.mjs').mode, 'self');
});

test('the hook embeds its data and the scanner, and is marked executable', () => {
    const hook = file(FULL, '.claude/hooks/komainu-guard.mjs');
    assert.equal(hook.exec, true);
    assert.match(hook.content, /^#!\/usr\/bin\/env node\n/);
    assert.match(hook.content, /"mode": "deny"/);
    assert.match(file({ ...FULL, strictness: 'advisory' }, '.claude/hooks/komainu-guard.mjs').content, /"mode": "ask"/);
    assert.ok(hook.content.includes('const scanText = function scanText('));
    assert.ok(!/\bimport\b .* from/.test(hook.content), 'the hook imports nothing');
});

test('mergeBlock creates, appends and replaces', () => {
    const block = `${BLOCK_START}\nnew\n${BLOCK_END}\n`;
    assert.equal(mergeBlock(null, block), block);
    assert.equal(mergeBlock('  \n', block), block);
    assert.equal(mergeBlock('# Mine\n', block), `# Mine\n\n${block}`);
    assert.equal(mergeBlock(`# Mine\n\n${BLOCK_START}\nold\n${BLOCK_END}\n\nTail.\n`, block), `# Mine\n\n${BLOCK_START}\nnew\n${BLOCK_END}\n\nTail.\n`);
    const once = mergeBlock('# Mine\n', block);
    assert.equal(mergeBlock(once, block), once, 'applying twice changes nothing');
    assert.equal(mergeBlock(`${BLOCK_END} stray ${BLOCK_START}`, block), `${BLOCK_END} stray ${BLOCK_START}\n\n${block}`, 'markers in the wrong order are left alone');
});

test('mergeJson keeps both sides and is idempotent', () => {
    const ours = JSON.parse(file(FULL, '.claude/settings.json').content);
    const theirs = { model: 'm', permissions: { deny: ['Bash(sudo *)'], allow: ['Bash(ls *)'] }, hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'mine.sh' }] }], Stop: [{ hooks: [] }] } };
    const merged = mergeJson(theirs, ours);
    assert.equal(merged.model, 'm');
    assert.deepEqual(merged.permissions.allow, ['Bash(ls *)']);
    assert.ok(merged.permissions.deny.includes('Bash(sudo *)') && merged.permissions.deny.includes('Read(./.env)'));
    assert.equal(merged.hooks.PreToolUse.length, 2);
    assert.equal(merged.hooks.Stop.length, 1);
    assert.deepEqual(mergeJson(merged, ours), merged);
    assert.deepEqual(mergeJson({}, ours), ours);
});

test('mergeJson replaces an older Komainu hook entry', () => {
    const old = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node old/komainu-guard.mjs' }] }] } };
    const merged = mergeJson(old, JSON.parse(file({ targets: ['hooks'] }, '.claude/settings.json').content));
    assert.equal(merged.hooks.PreToolUse.length, 1);
    assert.ok(!JSON.stringify(merged).includes('old/komainu-guard'));
});

test('mergeJson lets the new value win on a type conflict', () => {
    assert.deepEqual(mergeJson({ a: 1, b: [1], c: { x: 1 } }, { a: { n: 1 }, b: { n: 1 }, c: [2] }), { a: { n: 1 }, b: { n: 1 }, c: [2] });
});
