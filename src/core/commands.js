// Builds the things a person copies: a CLI one-liner, a self-contained shell
// or PowerShell script, and a prompt for an AI agent. Pure: no I/O.

import { VERSION } from './catalog.js';
import { encode, compact, normalize, stats } from './config.js';
import { generate } from './generate.js';

const trimBase = (base) => String(base || '').replace(/\/+$/, '');

/** Fetch the CLI once, then apply. `base` is the site URL, or empty for a local copy. */
export function cliCommand(cfg, { base = '', shell = 'sh' } = {}) {
    const token = encode(cfg);
    const b = trimBase(base);
    if (!/^https?:\/\//.test(b)) return `node ${b ? b + '/' : './'}komainu.mjs apply ${token}`;
    if (shell === 'ps') return `Invoke-WebRequest ${b}/komainu.mjs -OutFile komainu.mjs; node komainu.mjs apply ${token}`;
    return `curl -fsSLo komainu.mjs ${b}/komainu.mjs && node komainu.mjs apply ${token}`;
}

const header = (cfg, files, c) => {
    const st = stats(cfg);
    return [
        `${c} Komainu ${VERSION}: AI guardrails installer${cfg.org ? ` for ${cfg.org}` : ''}`,
        `${c} ${st.total} rules, ${files.length} files. It downloads nothing and needs no network access.`,
        `${c} Run from the root of the repository or folder the guardrails should live in.`,
        `${c} Existing files are never overwritten: a new version is written next to them as <name>.komainu-new.`
    ];
};

const writable = (cfg) => generate(cfg).filter((f) => f.mode !== 'self');
const needsCli = (cfg) => generate(cfg).some((f) => f.mode === 'self');

export function bashScript(input) {
    const cfg = normalize(input);
    const files = writable(cfg);
    let eof = 'KOMAINU_EOF';
    while (files.some((f) => f.content.split('\n').includes(eof))) eof += '_X';
    const out = [
        '#!/usr/bin/env bash',
        ...header(cfg, files, '#'),
        'set -euo pipefail',
        'put() {',
        '  local p="$1" t="$1"',
        '  mkdir -p "$(dirname "$p")"',
        '  [ -e "$p" ] && t="$p.komainu-new"',
        '  cat > "$t"',
        '  if [ "$t" != "$p" ] && cmp -s "$t" "$p"; then rm "$t"; echo "unchanged  $p"',
        '  elif [ "$t" != "$p" ]; then echo "exists     $p  (new version saved as $t; merge by hand)"',
        '  else echo "wrote      $p"; fi',
        '}',
        ''
    ];
    for (const f of files) {
        out.push(`put '${f.path}' <<'${eof}'`, f.content.replace(/\n$/, ''), eof);
        if (f.exec) out.push(`[ -e '${f.path}.komainu-new' ] || chmod +x '${f.path}'`);
        out.push('');
    }
    if (needsCli(cfg)) out.push('echo "note: the MCP entry expects the komainu CLI at .komainu/komainu.mjs; copy it there."');
    out.push('echo "Done. Review the files, then commit them."');
    return out.join('\n') + '\n';
}

export function powershellScript(input) {
    const cfg = normalize(input);
    const files = writable(cfg);
    const out = [
        ...header(cfg, files, '#'),
        "$ErrorActionPreference = 'Stop'",
        'function Put($Path, $Content) {',
        '  $full = Join-Path (Get-Location) $Path',
        '  $dir = Split-Path -Parent $full',
        '  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }',
        '  $target = $full',
        '  if (Test-Path $full) { $target = "$full.komainu-new" }',
        '  [System.IO.File]::WriteAllText($target, ($Content -replace "`r`n", "`n") + "`n", (New-Object System.Text.UTF8Encoding $false))',
        '  if ($target -ne $full) { Write-Host "exists     $Path  (new version saved as $Path.komainu-new; merge by hand)" } else { Write-Host "wrote      $Path" }',
        '}',
        ''
    ];
    for (const f of files) {
    // A line starting with '@ would end the here-string early; indent it.
        const body = f.content.replace(/\n$/, '').replace(/^'@/gm, " '@");
        out.push(`Put '${f.path}' @'`, body, "'@", '');
    }
    if (needsCli(cfg)) out.push('Write-Host "note: the MCP entry expects the komainu CLI at .komainu/komainu.mjs; copy it there."');
    out.push('Write-Host "Done. Review the files, then commit them."');
    return out.join('\n') + '\n';
}

/** A prompt that asks a local AI agent to tailor the draft to internal policy. */
export function agentPrompt(input, { base = '' } = {}) {
    const cfg = normalize(input);
    const b = trimBase(base);
    const http = /^https?:\/\//.test(b);
    return [
        'Use the komainu-guardrails skill to build AI guardrails for this organization, tailored to our internal policies.',
        '',
        http
            ? `If the skill is not installed yet, install it first: download ${b}/komainu.mjs and run \`node komainu.mjs skill install\`.`
            : 'If the skill is not installed yet, install it first with `node komainu.mjs skill install` using our local copy of the komainu CLI.',
        '',
        'Starting configuration (drafted in the Komainu web builder):',
        '',
        '```json',
        JSON.stringify(compact(cfg), null, 2),
        '```',
        '',
        'What I want:',
        '',
        '1. Ask me where our internal policies live (for example an acceptable-use policy, security policy, code of conduct, data classification standard, brand guidelines) and read them locally. Do not send their contents to any service other than the model you are already running on, and tell me first if any of them is classified above what this model is approved for.',
        '2. Compare each policy clause with the Komainu catalog. Turn matching clauses into catalog rules, clauses with no match into custom rules that cite the source clause, and list anything in the draft that our policy contradicts.',
        '3. Show me the proposed komainu.json and a coverage table (policy clause → rule → enforced / instructed / attested) before writing anything.',
        '4. After I approve, run `komainu apply`, then `komainu status`, and summarize what was installed and which rules still depend on people.'
    ].join('\n');
}

/** Snippets for registering the MCP server with common clients. */
export function mcpSnippets({ path = './komainu.mjs' } = {}) {
    return {
        claude: `claude mcp add komainu -- node ${path} mcp`,
        json: JSON.stringify({ mcpServers: { komainu: { command: 'node', args: [path, 'mcp'] } } }, null, 2),
        codex: `[mcp_servers.komainu]\ncommand = "node"\nargs = ["${path}", "mcp"]`
    };
}
