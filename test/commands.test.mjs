import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { PRESETS } from '../src/core/catalog.js';
import { normalize, decode, encode } from '../src/core/config.js';
import { generate } from '../src/core/generate.js';
import { cliCommand, bashScript, powershellScript, agentPrompt, mcpSnippets } from '../src/core/commands.js';
import { FULL, tmp, run } from './helpers.mjs';

test('the command downloads the CLI from the site it was built on', () => {
    assert.equal(cliCommand({}, { base: 'https://example.org/k/' }), 'curl -fsSLo komainu.mjs https://example.org/k/komainu.mjs && node komainu.mjs apply eyJ2IjoxfQ');
    assert.equal(cliCommand({}, { base: 'https://example.org', shell: 'ps' }), 'Invoke-WebRequest https://example.org/komainu.mjs -OutFile komainu.mjs; node komainu.mjs apply eyJ2IjoxfQ');
});

test('with no site address the command uses a local copy', () => {
    assert.equal(cliCommand({}), 'node ./komainu.mjs apply eyJ2IjoxfQ');
    assert.equal(cliCommand({}, { base: '/opt/tools/' }), 'node /opt/tools/komainu.mjs apply eyJ2IjoxfQ');
});

test('the command carries the whole configuration', () => {
    assert.deepEqual(decode(cliCommand(FULL, { base: 'https://example.org' })), normalize(FULL));
    assert.ok(cliCommand(FULL, { base: 'https://example.org' }).endsWith(encode(FULL)));
});

test('the bash installer is valid bash and says what it will do', () => {
    const dir = tmp();
    const sh = path.join(dir, 'install.sh');
    fs.writeFileSync(sh, bashScript(FULL));
    assert.equal(spawnSync('bash', ['-n', sh]).status, 0);
    const text = bashScript(FULL);
    assert.match(text, /^#!\/usr\/bin\/env bash\n# Komainu [\d.]+: AI guardrails installer for Example Org\n/);
    assert.match(text, /set -euo pipefail/);
    assert.ok(!/curl|wget/.test(text.replace(/"re": "[^\n]*/g, '')), 'the installer downloads nothing');
});

test('the bash installer writes every file and never overwrites', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'install.sh'), bashScript(FULL));
    const work = path.join(dir, 'w');
    fs.mkdirSync(work);
    fs.writeFileSync(path.join(work, 'AGENTS.md'), '# Mine\n');
    const first = spawnSync('bash', ['../install.sh'], { cwd: work, encoding: 'utf8' });
    assert.equal(first.status, 0, first.stderr);
    for (const f of generate(FULL).filter((x) => x.mode !== 'self')) {
        const p = path.join(work, f.path);
        if (f.path === 'AGENTS.md') {
            assert.equal(fs.readFileSync(p, 'utf8'), '# Mine\n');
            assert.equal(fs.readFileSync(`${p}.komainu-new`, 'utf8'), f.content);
        } else {
            assert.equal(fs.readFileSync(p, 'utf8'), f.content, f.path);
        }
    }
    assert.ok(fs.statSync(path.join(work, '.claude/hooks/komainu-guard.mjs')).mode & 0o100, 'the hook is executable');
    assert.match(first.stdout, /exists\s+AGENTS\.md/);
    assert.match(first.stdout, /note: the MCP entry expects the komainu CLI/);
    const second = spawnSync('bash', ['../install.sh'], { cwd: work, encoding: 'utf8' });
    assert.match(second.stdout, /unchanged\s+komainu\.json/);
    assert.ok(!fs.existsSync(path.join(work, 'komainu.json.komainu-new')), 'an identical file leaves nothing behind');
    assert.equal(run(['status', '--dir', work]).stdout.match(/DRIFT/g).length, 2, 'only AGENTS.md and the CLI copy differ');
});

test('a heredoc delimiter inside a file does not end the file early', () => {
    const cfg = { targets: ['agents'], custom: [{ d: 'core', x: 'KOMAINU_EOF' }] };
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'i.sh'), bashScript(cfg));
    assert.equal(spawnSync('bash', ['i.sh'], { cwd: dir }).status, 0);
    assert.equal(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8'), generate(cfg).find((f) => f.path === 'AGENTS.md').content);
});

for (const p of PRESETS) {
    test(`installers for "${p.name}" contain every file`, () => {
        const files = generate(p.cfg).filter((f) => f.mode !== 'self');
        const sh = bashScript(p.cfg);
        const ps = powershellScript(p.cfg);
        for (const f of files) {
            assert.ok(sh.includes(`put '${f.path}' <<'`), `bash: ${f.path}`);
            assert.ok(ps.includes(`Put '${f.path}' @'`), `PowerShell: ${f.path}`);
        }
        assert.equal((ps.match(/^Put '/gm) || []).length, (ps.match(/^'@$/gm) || []).length, 'every here-string is closed');
    });
}

test('a PowerShell here-string terminator inside a file is neutralized', () => {
    const ps = powershellScript({ targets: ['agents'], custom: [{ d: 'core', x: 'A rule.' }] }).replace('A rule.', "'@ rule");
    assert.ok(ps.includes("'@ rule"));
    const safe = powershellScript({ targets: [], org: 'x' });
    assert.ok(!/^'@./m.test(safe));
});

test('the agent prompt names the skill, carries the configuration and asks for approval', () => {
    const online = agentPrompt(FULL, { base: 'https://example.org' });
    assert.match(online, /komainu-guardrails skill/);
    assert.match(online, /download https:\/\/example\.org\/komainu\.mjs/);
    assert.deepEqual(normalize(JSON.parse(online.match(/```json\n([\s\S]*?)\n```/)[1])), normalize(FULL));
    assert.match(online, /before writing anything/);
    assert.match(agentPrompt({}), /our local copy of the komainu CLI/);
});

test('MCP snippets point at the given path', () => {
    const s = mcpSnippets({ path: '/opt/komainu.mjs' });
    assert.equal(s.claude, 'claude mcp add komainu -- node /opt/komainu.mjs mcp');
    assert.deepEqual(JSON.parse(s.json), { mcpServers: { komainu: { command: 'node', args: ['/opt/komainu.mjs', 'mcp'] } } });
    assert.match(s.codex, /args = \["\/opt\/komainu\.mjs", "mcp"\]/);
    assert.match(mcpSnippets().claude, /\.\/komainu\.mjs/);
});
