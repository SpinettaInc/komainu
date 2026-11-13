// Builds the deployable static site into ./site. Dev-time only: the output is
// plain files that any static host can serve.

import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { toJapanese } from './ja-pages.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = (...p) => path.join(root, 'src', ...p);
const out = (...p) => path.join(root, 'site', ...p);
const sha256 = (buf, enc = 'hex') => crypto.createHash('sha256').update(buf).digest(enc);
const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };

fs.rmSync(out(), { recursive: true, force: true });

// 1. CLI + MCP server: one readable file, not minified on purpose.
await build({
    entryPoints: [src('cli', 'komainu.mjs')],
    outfile: out('komainu.mjs'),
    bundle: true, platform: 'node', format: 'esm', target: 'node18',
    loader: { '.md': 'text' },
    banner: { js: '#!/usr/bin/env node\n// Komainu single-file build: CLI, MCP server and skill installer.\n// Zero dependencies. Makes no network requests.\n// SPDX-License-Identifier: GPL-3.0-or-later' },
    legalComments: 'none'
});
fs.chmodSync(out('komainu.mjs'), 0o755);
const cli = fs.readFileSync(out('komainu.mjs'));

// 2. Two pages: the landing page and the full-width builder.
for (const name of ['site', 'builder', 'templates', 'quiz']) {
    await build({ entryPoints: [src('web', `${name}.js`)], outfile: out('assets', `${name}.js`), bundle: true, platform: 'browser', format: 'iife', target: 'es2020', legalComments: 'none' });
}
const { VERSION, RULES, DOMAINS, TARGETS, PRESETS } = await import(src('core', 'catalog.js'));
const { normalize, stats } = await import(src('core', 'config.js'));
const total = (strictness) => String(stats(normalize({ strictness, domains: DOMAINS.map((d) => d.id) })).total);
const { catalogMarkdown } = await import(src('core', 'docs.js'));

const css = fs.readFileSync(src('web', 'styles.css'), 'utf8');
write(out('assets', 'styles.css'), css);
write(out('assets', 'site.css'), fs.readFileSync(src('web', 'site.css'), 'utf8'));
fs.cpSync(src('web', 'fonts'), out('fonts'), { recursive: true });
fs.copyFileSync(src('web', 'logo.svg'), out('logo.svg'));

const csp = (script, style, font = "'self'") => `default-src 'none'; script-src ${script}; style-src ${style}; font-src ${font}; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'`;
const fillIn = (html) => html
    .replaceAll('__VERSION__', VERSION).replaceAll('__CLI_SHA__', sha256(cli))
    .replaceAll('__RULES__', String(RULES.length)).replaceAll('__AREAS__', String(DOMAINS.length)).replaceAll('__TARGETS__', String(TARGETS.length)).replaceAll('__PRESETS__', String(PRESETS.length))
    .replaceAll('__N_STRICT__', total('strict')).replaceAll('__N_BALANCED__', total('balanced')).replaceAll('__N_ADVISORY__', total('advisory'));
// The Japanese pages are the same markup with the wording swapped, written under ja/.
const page = (name, lang = 'en') => {
    const html = fs.readFileSync(src('web', name), 'utf8');
    return fillIn(lang === 'ja' ? toJapanese(name, html) : html);
};
for (const name of ['index.html', 'builder.html', 'templates.html', 'quiz.html']) {
    write(out(name), page(name).replace('__CSP__', csp("'self'", "'self'")));
    write(out('ja', name), page(name, 'ja').replace('__CSP__', csp("'self'", "'self'")));
}

// 3. Standalone builder: one file, usable from file:// with no connection.
// It cannot carry font files, so it falls back to system fonts.
const cssAlone = css.replace(/\/\* fonts:start \*\/[\s\S]*?\/\* fonts:end \*\/\n*/, '');
const inlineJs = fs.readFileSync(out('assets', 'builder.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const standalone = (lang) => page('builder.html', lang)
    .replace('__CSP__', csp(`'sha256-${sha256(inlineJs, 'base64')}'`, `'sha256-${sha256(cssAlone, 'base64')}'`, "'none'"))
    .replace(/<link rel="alternate"[^>]*>\n/, '')
    .replace(/<link rel="stylesheet" href="(\.\.\/)?assets\/styles\.css">/, () => `<style>${cssAlone}</style>`)
    .replace(/<script src="(\.\.\/)?assets\/builder\.js" defer><\/script>/, () => `<script>${inlineJs}</script>`)
    .replace(/href="index\.html" aria-label="([^"]*)" data-home/, 'href="#" aria-label="Komainu"')
    .replace(/ {2}<a class="crumb link" [^>]*data-online>[^<]*<\/a>\n/g, '');
write(out('komainu-standalone.html'), standalone('en'));
write(out('komainu-standalone-ja.html'), standalone('ja'));

// 4. Skill: browsable files plus archives. The CLI is bundled as its script.
const skill = out('skill', 'komainu-guardrails');
fs.cpSync(src('skill'), skill, { recursive: true });
write(path.join(skill, 'references', 'catalog.md'), catalogMarkdown());
write(path.join(skill, 'scripts', 'komainu.mjs'), cli);
execFileSync('tar', ['-czf', 'komainu-guardrails.tar.gz', '--owner=0', '--group=0', '--mtime=2026-01-01', 'komainu-guardrails'], { cwd: out('skill') });
try { execFileSync('zip', ['-qrX', 'komainu-guardrails.zip', 'komainu-guardrails'], { cwd: out('skill') }); } catch { /* zip is optional */ }

// 5. Host hints and checksums.
write(out('_headers'), `/*
  Content-Security-Policy: ${csp("'self'", "'self'")}; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: geolocation=(), camera=(), microphone=(), interest-cohort=()
/komainu-standalone.html
  ! Content-Security-Policy
/komainu-standalone-ja.html
  ! Content-Security-Policy
/komainu.mjs
  Content-Type: text/javascript; charset=utf-8
`);
const sums = ['komainu.mjs', 'komainu-standalone.html', 'komainu-standalone-ja.html', 'skill/komainu-guardrails.tar.gz', 'skill/komainu-guardrails.zip']
    .filter((f) => fs.existsSync(out(f))).map((f) => `${sha256(fs.readFileSync(out(f)))}  ${f}`).join('\n') + '\n';
write(out('SHA256SUMS'), sums);

const kb = (f) => `${(fs.statSync(out(f)).size / 1024).toFixed(0)} KB`;
console.log(`site/ built: komainu.mjs ${kb('komainu.mjs')}, builder.js ${kb('assets/builder.js')}, standalone ${kb('komainu-standalone.html')}`);
