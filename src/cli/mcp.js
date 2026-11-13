// Komainu MCP server: stdio, zero dependencies, read-only.
//
// Speaks the stateless 2026-07-28 revision (per-request _meta, server/discover)
// and still answers the `initialize` handshake of earlier revisions, so both
// modern and legacy clients work.

import { VERSION, DOMAINS, RULES } from '../core/catalog.js';
import { normalize, stats, encode, renderText } from '../core/config.js';
import { generate, rulesMarkdown } from '../core/generate.js';
import { detectorsFor, scanText } from '../core/detectors.js';
import { catalogMarkdown } from '../core/docs.js';
import { agentPrompt } from '../core/commands.js';

const MODERN = ['2026-07-28'];
const LEGACY = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const META = 'io.modelcontextprotocol/';
const SERVER = { name: 'komainu', title: 'Komainu guardrails', version: VERSION };
const INSTRUCTIONS = 'Local, read-only access to this organization\'s AI guardrails. Call guardrails_list before starting work in a domain, guardrails_check before sending text anywhere outside this machine, and guardrails_redact to sanitize it. Nothing is sent over the network.';

const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const domainEnum = { type: 'string', enum: DOMAINS.map((d) => d.id), description: 'Limit to one domain' };

const TOOLS = [
    { name: 'guardrails_list', title: 'List guardrails in force', description: 'Returns the AI guardrails in force for this workspace (from komainu.json), optionally for one domain such as coding, hr, sales or marketing. Call this before starting work in a domain.', inputSchema: obj({ domain: domainEnum }) },
    { name: 'guardrails_check', title: 'Check text against guardrails', description: 'Scans text for secrets, personal data and the organization\'s sensitive terms before it is sent to a model, a tool, a file or a person. Returns findings without echoing the sensitive values.', inputSchema: obj({ text: { type: 'string', description: 'Text to check' } }, ['text']) },
    { name: 'guardrails_redact', title: 'Redact sensitive values', description: 'Returns the text with secrets, personal data and sensitive terms replaced by placeholders such as [REDACTED_SECRET].', inputSchema: obj({ text: { type: 'string', description: 'Text to sanitize' } }, ['text']) },
    { name: 'guardrails_route', title: 'Where may this data go?', description: 'Given a data classification level, says whether the data may be sent to a hosted AI service or must stay on the local route.', inputSchema: obj({ classification: { type: 'string', description: 'Classification level of the data' } }, ['classification']) },
    { name: 'guardrails_catalog', title: 'Browse the rule catalog', description: 'Returns the full Komainu rule catalog (all domains, rule ids, tiers, enforcement notes) for building or changing a configuration.', inputSchema: obj({ domain: domainEnum }) },
    { name: 'guardrails_build', title: 'Build guardrail files (dry run)', description: 'Generates the guardrail files for a komainu configuration and returns them without writing anything. Use it to preview a configuration; write the files with `komainu apply`.', inputSchema: obj({ config: { type: 'object', description: 'A komainu.json configuration (partial is fine)' }, contents: { type: 'boolean', description: 'Include file contents (default false: paths and sizes only)' } }, ['config']) }
];

const PROMPTS = [
    { name: 'build_guardrails', title: 'Build guardrails from our policies', description: 'Interview me and tailor the guardrails to our internal policy documents.', arguments: [] },
    { name: 'review_against_guardrails', title: 'Review work against guardrails', description: 'Review a draft, diff or plan against the guardrails in force.', arguments: [{ name: 'domain', description: 'Domain to review against, e.g. coding or marketing', required: false }] }
];

const RESOURCES = [
    { uri: 'komainu://guardrails', name: 'guardrails', title: 'Guardrails in force', description: 'The guardrails currently configured for this workspace, as Markdown.', mimeType: 'text/markdown' },
    { uri: 'komainu://catalog', name: 'catalog', title: 'Rule catalog', description: 'Every rule Komainu knows, by domain.', mimeType: 'text/markdown' }
];

export function createServer({ loadConfig }) {
    const cfg = () => normalize(loadConfig() || {});
    const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError: true } : {}) });

    const call = {
        guardrails_list({ domain }) {
            const c = cfg();
            if (domain && !c.domains.includes(domain)) return text(`The "${domain}" domain is not enabled in this workspace. Enabled: ${c.domains.join(', ')}.`);
            return text(rulesMarkdown(c, domain ? { only: [...new Set(['core', domain])] } : {}));
        },
        guardrails_check({ text: t }) {
            const c = cfg();
            const { findings } = scanText(String(t ?? ''), detectorsFor(c.redact), c.terms);
            if (!findings.length) return text('OK: no secrets, personal data or sensitive terms found.');
            return text(`BLOCKED: ${findings.length} finding(s). Redact before sending (guardrails_redact does it for you).\n` + findings.map((f) => `- line ${f.line}: ${f.name} → ${f.placeholder}`).join('\n'));
        },
        guardrails_redact({ text: t }) {
            const c = cfg();
            return text(scanText(String(t ?? ''), detectorsFor(c.redact), c.terms).redacted);
        },
        guardrails_route({ classification }) {
            const c = cfg();
            const want = String(classification ?? '').trim().toLowerCase();
            const i = c.levels.findIndex((l) => l.toLowerCase() === want);
            if (i === -1) return text(`Unknown classification "${classification}". Levels here, lowest to highest: ${c.levels.join(', ')}. If the data is unclassified, treat it as the highest level until someone classifies it.`);
            if (i <= c.levels.indexOf(c.hostedMax)) return text(`ALLOWED: "${c.levels[i]}" data may be sent to approved hosted AI services${c.tools ? ` (${c.tools})` : ''}. Redaction rules still apply.`);
            return text(`LOCAL ONLY: "${c.levels[i]}" is above the hosted limit ("${c.hostedMax}"). Use ${renderText('{local}', c)}. If that route is unavailable, stop and say so; do not fall back to a hosted service.`);
        },
        guardrails_catalog({ domain }) {
            if (!domain) return text(catalogMarkdown());
            const d = DOMAINS.find((x) => x.id === domain);
            return text([`# ${d.name}`, '', ...RULES.filter((r) => r.d === domain).map((r) => `- \`${r.id}\` (${r.l}, tier ${r.tier}) ${r.t}: ${r.x}`)].join('\n'));
        },
        guardrails_build({ config, contents }) {
            const c = normalize(config);
            const files = generate(c).filter((f) => f.mode !== 'self');
            const st = stats(c);
            const head = `${st.total} rules (${st.must} MUST, ${st.should} SHOULD; ${st.enforced} enforced, ${st.instructed} instructed, ${st.attested} attested).\nApply with: node komainu.mjs apply ${encode(c)}\n`;
            return text(head + '\n' + files.map((f) => (contents ? `===== ${f.path} (${f.mode}) =====\n${f.content}` : `- ${f.path} (${f.mode}, ${f.content.length} bytes)`)).join('\n'));
        }
    };

    const prompt = {
        build_guardrails: () => agentPrompt(cfg()),
        review_against_guardrails: ({ domain } = {}) => {
            const c = cfg();
            const only = domain && c.domains.includes(domain) ? [...new Set(['core', domain])] : undefined;
            return `Review the work I share next against the guardrails below. For each problem, quote the passage, name the rule it breaks, and propose a compliant rewrite. List MUST violations first. If nothing breaks a rule, say so plainly.\n\n${rulesMarkdown(c, { only })}`;
        }
    };

    const cacheable = (modern) => (modern ? { ttlMs: 60000, cacheScope: 'private' } : {});

    /** Handles one JSON-RPC message; returns the response object, or null for notifications. */
    function handle(msg) {
        if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
            return { jsonrpc: '2.0', id: msg?.id ?? null, error: { code: -32600, message: 'Invalid request' } };
        }
        if (msg.id === undefined || msg.id === null) return null; // notification
        const params = msg.params || {};
        const requested = params._meta?.[META + 'protocolVersion'];
        const modern = requested !== undefined;
        const ok = (result) => ({ jsonrpc: '2.0', id: msg.id, result: modern ? { resultType: 'complete', ...result, _meta: { [META + 'serverInfo']: SERVER } } : result });
        const err = (code, message, data) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message, ...(data ? { data } : {}) } });

        if (modern && !MODERN.includes(requested)) return err(-32022, 'Unsupported protocol version', { supported: MODERN, requested });
        const capabilities = { tools: {}, prompts: {}, resources: {} };

        try {
            switch (msg.method) {
                case 'server/discover':
                    return ok({ supportedVersions: MODERN, capabilities, instructions: INSTRUCTIONS, ttlMs: 3600000, cacheScope: 'public' });
                case 'initialize': // legacy handshake
                    return ok({ protocolVersion: LEGACY.includes(params.protocolVersion) ? params.protocolVersion : LEGACY[0], capabilities, serverInfo: SERVER, instructions: INSTRUCTIONS });
                case 'ping':
                    return ok({});
                case 'tools/list':
                    return ok({ tools: TOOLS, ...cacheable(modern) });
                case 'tools/call': {
                    const fn = call[params.name];
                    if (!fn) return err(-32602, `Unknown tool: ${params.name}`);
                    const tool = TOOLS.find((t) => t.name === params.name);
                    const args = params.arguments || {};
                    const missing = tool.inputSchema.required.filter((k) => args[k] === undefined);
                    if (missing.length) return ok(text(`Missing required argument(s): ${missing.join(', ')}`, true));
                    try { return ok(fn(args)); } catch (e) { return ok(text(`Error: ${e.message}`, true)); }
                }
                case 'prompts/list':
                    return ok({ prompts: PROMPTS, ...cacheable(modern) });
                case 'prompts/get': {
                    const fn = prompt[params.name];
                    if (!fn) return err(-32602, `Unknown prompt: ${params.name}`);
                    return ok({ description: PROMPTS.find((p) => p.name === params.name).description, messages: [{ role: 'user', content: { type: 'text', text: fn(params.arguments || {}) } }] });
                }
                case 'resources/list':
                    return ok({ resources: RESOURCES, ...cacheable(modern) });
                case 'resources/templates/list':
                    return ok({ resourceTemplates: [], ...cacheable(modern) });
                case 'resources/read': {
                    const body = params.uri === 'komainu://guardrails' ? rulesMarkdown(cfg()) : params.uri === 'komainu://catalog' ? catalogMarkdown() : null;
                    if (body === null) return err(-32602, `Unknown resource: ${params.uri}`);
                    return ok({ contents: [{ uri: params.uri, mimeType: 'text/markdown', text: body }], ...cacheable(modern) });
                }
                default:
                    return err(-32601, `Method not found: ${msg.method}`);
            }
        } catch (e) {
            return err(-32603, `Internal error: ${e.message}`);
        }
    }

    return { handle };
}

/** Run over stdio: one JSON-RPC message per line. stdout carries protocol messages only. */
export function serveStdio(server, { stdin = process.stdin, stdout = process.stdout } = {}) {
    let buf = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk) => {
        buf += chunk;
        for (let i = buf.indexOf('\n'); i !== -1; i = buf.indexOf('\n')) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line) continue;
            let res;
            try { res = server.handle(JSON.parse(line)); } catch { res = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }; }
            if (res) stdout.write(JSON.stringify(res) + '\n');
        }
    });
    stdin.on('end', () => process.exit(0));
}
