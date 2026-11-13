import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { DOMAINS, RULES, VERSION } from '../src/core/catalog.js';
import { normalize, decode } from '../src/core/config.js';
import { createServer } from '../src/cli/mcp.js';
import { FULL, AWS, CARD, tmp, run } from './helpers.mjs';

const MODERN = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } };
let nextId = 1;

function client(config = FULL) {
    const server = createServer({ loadConfig: () => config });
    const request = (method, params = {}, modern = true) => server.handle({ jsonrpc: '2.0', id: nextId++, method, params: modern ? { ...params, ...MODERN } : params });
    const call = (name, args = {}) => request('tools/call', { name, arguments: args }).result;
    const text = (name, args) => call(name, args).content[0].text;
    return { server, request, call, text };
}

test('server/discover advertises the version, the capabilities and the server', () => {
    const { result } = client().request('server/discover');
    assert.deepEqual(result.supportedVersions, ['2026-07-28']);
    assert.deepEqual(Object.keys(result.capabilities).sort(), ['prompts', 'resources', 'tools']);
    assert.equal(result.resultType, 'complete');
    assert.equal(result._meta['io.modelcontextprotocol/serverInfo'].version, VERSION);
    assert.ok(result.instructions.length > 40);
    assert.equal(result.cacheScope, 'public');
});

test('an unsupported protocol version is rejected with the supported list', () => {
    const res = client().server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '1999-01-01' } } });
    assert.equal(res.error.code, -32022);
    assert.deepEqual(res.error.data, { supported: ['2026-07-28'], requested: '1999-01-01' });
});

for (const version of ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']) {
    test(`the legacy handshake works for ${version}`, () => {
        const { result } = client().request('initialize', { protocolVersion: version, capabilities: {}, clientInfo: { name: 't', version: '1' } }, false);
        assert.equal(result.protocolVersion, version);
        assert.equal(result.serverInfo.name, 'komainu');
        assert.equal(result.resultType, undefined, 'legacy results carry no modern fields');
        assert.equal(result._meta, undefined);
    });
}

test('an unknown legacy version is answered with the newest legacy version', () => {
    assert.equal(client().request('initialize', { protocolVersion: '2020-01-01' }, false).result.protocolVersion, '2025-11-25');
});

test('notifications get no response and ping is answered', () => {
    const { server, request } = client();
    assert.equal(server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
    assert.equal(server.handle({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 1 } }), null);
    assert.deepEqual(request('ping', {}, false).result, {});
});

test('malformed messages and unknown methods get JSON-RPC errors', () => {
    const { server, request } = client();
    assert.equal(server.handle({ id: 1, method: 'tools/list' }).error.code, -32600);
    assert.equal(server.handle(null).error.code, -32600);
    assert.equal(server.handle({ jsonrpc: '2.0', id: 1 }).error.code, -32600);
    assert.equal(request('nope/nope').error.code, -32601);
});

test('modern list results are cacheable; legacy ones carry no extra fields', () => {
    const c = client();
    for (const method of ['tools/list', 'prompts/list', 'resources/list', 'resources/templates/list']) {
        const modern = c.request(method).result;
        assert.deepEqual([modern.ttlMs, modern.cacheScope, modern.resultType], [60000, 'private', 'complete'], method);
        assert.equal(c.request(method, {}, false).result.ttlMs, undefined, method);
    }
});

test('tools are listed in a stable order with strict schemas', () => {
    const c = client();
    const tools = c.request('tools/list').result.tools;
    assert.deepEqual(tools.map((t) => t.name), ['guardrails_list', 'guardrails_check', 'guardrails_redact', 'guardrails_route', 'guardrails_catalog', 'guardrails_build']);
    assert.deepEqual(c.request('tools/list').result.tools, tools);
    for (const t of tools) {
        assert.equal(t.inputSchema.type, 'object');
        assert.equal(t.inputSchema.additionalProperties, false);
        assert.ok(t.description.length > 40 && t.title);
    }
});

test('guardrails_list returns the rules in force, or one area', () => {
    const c = client();
    assert.match(c.text('guardrails_list'), /## AI guardrails for Example Org/);
    const hr = c.text('guardrails_list', { domain: 'hr' });
    assert.ok(hr.includes('### Human resources') && hr.includes('### Universal') && !hr.includes('### Sales'));
    assert.match(client({ domains: ['core'] }).text('guardrails_list', { domain: 'hr' }), /"hr" domain is not enabled/);
});

test('guardrails_check reports findings without the value', () => {
    const c = client();
    assert.equal(c.text('guardrails_check', { text: 'nothing sensitive' }), 'OK: no secrets, personal data or sensitive terms found.');
    const blocked = c.text('guardrails_check', { text: `a\nkey ${AWS}\ncard ${CARD} for Project Falcon` });
    assert.match(blocked, /^BLOCKED: 3 finding\(s\)/);
    assert.match(blocked, /line 2: AWS access key → \[REDACTED_SECRET\]/);
    assert.match(blocked, /line 3: sensitive term/);
    assert.ok(!blocked.includes(AWS) && !blocked.includes('4111') && !blocked.includes('Falcon'));
});

test('guardrails_redact returns the sanitized text', () => {
    assert.equal(client().text('guardrails_redact', { text: `x ${AWS} Project Falcon` }), 'x [REDACTED_SECRET] [REDACTED_TERM]');
    assert.equal(client().text('guardrails_redact', { text: '' }), '');
});

test('guardrails_route applies the classification levels', () => {
    const c = client({ levels: ['Open', 'Staff', 'Secret'], hostedMax: 'Staff', local: 'the on-prem endpoint', tools: 'Tool A' });
    assert.match(c.text('guardrails_route', { classification: 'open' }), /^ALLOWED: "Open" data may be sent to approved hosted AI services \(Tool A\)/);
    assert.match(c.text('guardrails_route', { classification: 'Staff' }), /^ALLOWED/);
    assert.match(c.text('guardrails_route', { classification: ' SECRET ' }), /^LOCAL ONLY: "Secret" is above the hosted limit \("Staff"\)\. Use the on-prem endpoint\./);
    assert.match(c.text('guardrails_route', { classification: 'Purple' }), /^Unknown classification "Purple"\. Levels here, lowest to highest: Open, Staff, Secret\./);
});

test('guardrails_catalog returns everything, or one area', () => {
    const c = client();
    const all = c.text('guardrails_catalog');
    for (const r of RULES) assert.ok(all.includes(r.id), r.id);
    const hr = c.text('guardrails_catalog', { domain: 'hr' });
    assert.ok(hr.startsWith('# Human resources') && hr.includes('hr.bias') && !hr.includes('sales.truthful'));
});

test('guardrails_build previews a configuration and gives the command to apply it', () => {
    const c = client();
    const summary = c.text('guardrails_build', { config: { domains: ['sales'], targets: ['agents', 'policy'] } });
    assert.match(summary, /^\d+ rules \(\d+ MUST, \d+ SHOULD; \d+ enforced, \d+ instructed, \d+ attested\)\./);
    assert.match(summary, /- AGENTS\.md \(block, \d+ bytes\)/);
    assert.deepEqual(decode(summary.match(/apply (\S+)/)[1]), normalize({ domains: ['sales'], targets: ['agents', 'policy'] }));
    const full = c.text('guardrails_build', { config: { targets: ['agents'] }, contents: true });
    assert.match(full, /===== AGENTS\.md \(block\) =====/);
    assert.ok(full.includes('- MUST: '));
    assert.ok(!c.text('guardrails_build', { config: { targets: ['mcp'] } }).includes('.komainu/komainu.mjs'), 'the CLI copy is not a previewable file');
});

test('a missing argument is a tool error; an unknown tool is a protocol error', () => {
    const c = client();
    for (const name of ['guardrails_check', 'guardrails_redact', 'guardrails_route', 'guardrails_build']) {
        const res = c.call(name, {});
        assert.equal(res.isError, true, name);
        assert.match(res.content[0].text, /Missing required argument/);
    }
    assert.equal(c.request('tools/call', { name: 'nope', arguments: {} }).error.code, -32602);
});

test('prompts are listed and rendered', () => {
    const c = client();
    assert.deepEqual(c.request('prompts/list').result.prompts.map((p) => p.name), ['build_guardrails', 'review_against_guardrails']);
    const build = c.request('prompts/get', { name: 'build_guardrails' }).result;
    assert.equal(build.messages[0].role, 'user');
    assert.match(build.messages[0].content.text, /komainu-guardrails skill/);
    const review = c.request('prompts/get', { name: 'review_against_guardrails', arguments: { domain: 'marketing' } }).result.messages[0].content.text;
    assert.ok(review.includes('### Marketing') && !review.includes('### Sales'));
    assert.ok(c.request('prompts/get', { name: 'review_against_guardrails' }).result.messages[0].content.text.includes('### Sales'));
    assert.equal(c.request('prompts/get', { name: 'nope' }).error.code, -32602);
});

test('resources are listed and readable', () => {
    const c = client();
    assert.deepEqual(c.request('resources/list').result.resources.map((r) => r.uri), ['komainu://guardrails', 'komainu://catalog']);
    assert.deepEqual(c.request('resources/templates/list').result.resourceTemplates, []);
    const rules = c.request('resources/read', { uri: 'komainu://guardrails' }).result.contents[0];
    assert.equal(rules.mimeType, 'text/markdown');
    assert.match(rules.text, /AI guardrails for Example Org/);
    assert.match(c.request('resources/read', { uri: 'komainu://catalog' }).result.contents[0].text, /# Komainu guardrail catalog/);
    assert.equal(c.request('resources/read', { uri: 'komainu://nope' }).error.code, -32602);
});

test('with no komainu.json the server falls back to the defaults', () => {
    const c = client(null);
    assert.match(c.text('guardrails_list'), /^## AI guardrails\n/);
    assert.match(c.text('guardrails_route', { classification: 'Restricted' }), /^LOCAL ONLY/);
});

test('every area can be requested by id', () => {
    const c = client();
    for (const d of DOMAINS) assert.ok(c.text('guardrails_catalog', { domain: d.id }).startsWith(`# ${d.name}`), d.id);
});

test('over stdio: one JSON line per request, a parse error for bad input, silence for notifications', () => {
    const dir = tmp();
    run(['apply', JSON.stringify(normalize(FULL)), '--dir', dir]);
    const msgs = [
        { jsonrpc: '2.0', id: 1, method: 'server/discover', params: MODERN },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'guardrails_check', arguments: { text: `key ${AWS}` }, ...MODERN } },
        { jsonrpc: '2.0', id: 3, method: 'resources/read', params: { uri: 'komainu://guardrails' } }
    ];
    const r = run(['mcp', '--dir', dir], { input: `${msgs.map((m) => JSON.stringify(m)).join('\n')}\n\nnot json\n` });
    assert.equal(r.status, 0);
    assert.equal(r.stderr, '');
    const lines = r.stdout.trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(lines.map((l) => l.id), [1, 2, 3, null]);
    assert.match(lines[1].result.content[0].text, /^BLOCKED/);
    assert.match(lines[2].result.contents[0].text, /Example Org/, 'the server reads komainu.json from --dir');
    assert.equal(lines[3].error.code, -32700);
    assert.ok(!r.stdout.includes(AWS));
});

test('the server reads komainu.json again on every request', () => {
    const dir = tmp();
    const cfgFile = path.join(dir, 'komainu.json');
    fs.writeFileSync(cfgFile, JSON.stringify({ v: 1, org: 'First' }));
    const server = createServer({ loadConfig: () => JSON.parse(fs.readFileSync(cfgFile, 'utf8')) });
    const read = () => server.handle({ jsonrpc: '2.0', id: 1, method: 'resources/read', params: { uri: 'komainu://guardrails' } }).result.contents[0].text;
    assert.match(read(), /for First/);
    fs.writeFileSync(cfgFile, JSON.stringify({ v: 1, org: 'Second' }));
    assert.match(read(), /for Second/);
});
