import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { RULES, DOMAINS, PRESETS, VERSION } from '../src/core/catalog.js';
import { CLI, site, read, tmp, run } from './helpers.mjs';

const PAGES = ['index.html', 'builder.html', 'templates.html', 'quiz.html', 'komainu-standalone.html'];
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const markup = (page) => read(page).split('<script')[0].replace(/<style>[\s\S]*<\/style>/, '');

for (const page of PAGES) {
    test(`${page}: locked down and free of leftovers`, () => {
        const html = read(page);
        const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
        assert.match(csp, /default-src 'none'/);
        assert.match(csp, /connect-src 'none'/);
        assert.match(csp, /form-action 'none'/);
        assert.ok(!csp.includes('unsafe-inline') && !csp.includes('unsafe-eval'));
        assert.ok(!/__[A-Z_]+__/.test(markup(page)), 'no unreplaced build placeholder');
        assert.ok(!/src="https?:|<link[^>]+href="https?:/.test(markup(page)), 'no external resource');
        assert.ok(!/ style="/.test(markup(page)), 'no inline style (the policy would drop it)');
        assert.ok(!/ on[a-z]+="/.test(markup(page)), 'no inline event handler');
        assert.match(html, /<html lang="en">/);
        assert.match(html, /<meta name="viewport"/);
        assert.match(html, /<title>[^<]{10,}<\/title>/);
        assert.match(html, /<meta name="referrer" content="no-referrer">/);
    });
}

for (const page of ['index.html', 'builder.html', 'templates.html', 'quiz.html']) {
    test(`${page}: every local link and asset exists`, () => {
        const html = read(page);
        const refs = [...html.matchAll(/(?:href|src)="([^"#:]+)(?:#[^"]*)?"/g)].map((m) => m[1]);
        assert.ok(refs.length > 2);
        for (const ref of new Set(refs)) assert.ok(fs.existsSync(site(ref)), `${page} → ${ref}`);
    });

    test(`${page}: every in-page anchor has a target`, () => {
        const html = read(page);
        const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
        for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(target), `#${target}`);
    });
}

test('links between pages point at real anchors', () => {
    const ids = new Set([...read('index.html').matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    for (const page of ['templates.html', 'builder.html']) {
        for (const [, target] of read(page).matchAll(/href="index\.html#([^"]+)"/g)) assert.ok(ids.has(target), `${page} → index.html#${target}`);
    }
});

test('the standalone builder is one self-contained file', () => {
    const html = read('komainu-standalone.html');
    assert.ok(!html.includes('assets/') && !html.includes('@font-face') && !html.includes('href="index.html"'));
    assert.match(html, /script-src 'sha256-[A-Za-z0-9+/=]+'/);
    assert.match(html, /font-src 'none'/);
    const inline = html.match(/<script>([\s\S]*)<\/script>/)[1];
    const digest = crypto.createHash('sha256').update(inline).digest('base64');
    assert.ok(html.includes(`'sha256-${digest}'`), 'the policy hash matches the inlined script');
});

for (const script of ['assets/site.js', 'assets/builder.js', 'assets/templates.js', 'assets/quiz.js']) {
    test(`${script}: no network and no browser storage`, () => {
        const js = read(script);
        for (const banned of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'new Function', 'eval(', 'importScripts', 'serviceWorker']) {
            assert.ok(!js.includes(banned), banned);
        }
    });
}

test('the CLI is one readable file with no network code', () => {
    const cli = fs.readFileSync(CLI, 'utf8');
    for (const banned of ['node:http', 'node:https', 'node:net', 'node:dgram', 'node:tls', 'fetch(', 'XMLHttpRequest', 'WebSocket']) assert.ok(!cli.includes(banned), banned);
    assert.match(cli, /^#!\/usr\/bin\/env node\n/);
    assert.ok(cli.split('\n').length > 1000, 'not minified');
    assert.ok(fs.statSync(CLI).mode & 0o100, 'executable');
    const imports = [...cli.matchAll(/^import .* from ["']([^"']+)["'];?$/gm)].map((m) => m[1]);
    assert.ok(imports.length >= 4 && imports.every((m) => m.startsWith('node:')), 'only Node built-ins are imported');
});

test('the page shows the checksum of the CLI it links to', () => {
    assert.ok(read('SHA256SUMS').includes(`${sha256(fs.readFileSync(CLI))}  komainu.mjs`));
});

test('SHA256SUMS matches every listed file', () => {
    const lines = read('SHA256SUMS').trim().split('\n');
    assert.ok(lines.length >= 3);
    for (const line of lines) {
        const [sum, file] = line.split('  ');
        assert.equal(sha256(fs.readFileSync(site(file))), sum, file);
    }
});

test('the host headers file carries the same policy', () => {
    const headers = read('_headers');
    assert.match(headers, /Content-Security-Policy: default-src 'none'/);
    assert.match(headers, /connect-src 'none'/);
    assert.match(headers, /X-Content-Type-Options: nosniff/);
    assert.match(headers, /Referrer-Policy: no-referrer/);
});

test('fonts are served from the site itself', () => {
    for (const f of ['inter-latin.woff2', 'jetbrains-mono-latin.woff2', 'space-grotesk-latin.woff2']) assert.ok(fs.statSync(site('fonts', f)).size > 10000, f);
    assert.ok(!/url\(["']?https?:/.test(read('assets/site.css') + read('assets/styles.css')));
});

test('the landing page states the catalog counts from this build', () => {
    const html = read('index.html');
    assert.ok(html.includes(`<b>${RULES.length}</b>`));
    assert.ok(html.includes(`<b>${DOMAINS.length}</b>`));
    assert.ok(html.includes(`${PRESETS.length} role templates`));
    assert.ok(html.includes(`v${VERSION}`));
});

test('the landing page and the builder link to each other and to the templates', () => {
    assert.match(read('index.html'), /href="builder\.html"/);
    assert.match(read('index.html'), /href="templates\.html"/);
    assert.match(read('templates.html'), /href="builder\.html"/);
    assert.match(read('builder.html'), /href="index\.html"/);
    assert.ok(!read('index.html').includes('id="rules"'), 'the landing page does not carry the builder');
});

test('the published skill is complete and its archive unpacks', () => {
    const skill = site('skill', 'komainu-guardrails');
    for (const f of ['SKILL.md', 'references/catalog.md', 'references/mapping.md', 'references/config.md', 'scripts/komainu.mjs']) assert.ok(fs.existsSync(path.join(skill, f)), f);
    assert.equal(fs.readFileSync(path.join(skill, 'scripts/komainu.mjs'), 'utf8'), fs.readFileSync(CLI, 'utf8'));
    const dir = tmp();
    assert.equal(spawnSync('tar', ['-xzf', site('skill', 'komainu-guardrails.tar.gz'), '-C', dir]).status, 0);
    assert.equal(fs.readFileSync(path.join(dir, 'komainu-guardrails/SKILL.md'), 'utf8'), fs.readFileSync(path.join(skill, 'SKILL.md'), 'utf8'));
});

test('skill install writes a valid skill, for both folder conventions', () => {
    for (const [flags, folder] of [[[], '.claude/skills'], [['--agents'], '.agents/skills']]) {
        const dir = tmp();
        assert.equal(run(['skill', 'install', ...flags, '--dir', dir]).status, 0);
        const skill = path.join(dir, folder, 'komainu-guardrails');
        const md = fs.readFileSync(path.join(skill, 'SKILL.md'), 'utf8');
        const fm = md.match(/^---\n([\s\S]*?)\n---\n/)[1];
        assert.match(fm, /^name: komainu-guardrails$/m, 'the name matches the folder');
        const description = fm.match(/^description: (.*)$/m)[1];
        assert.ok(description.length >= 50 && description.length <= 1024);
        assert.ok(md.split('\n').length < 500, 'under the recommended length');
        for (const ref of md.matchAll(/`references\/([a-z]+\.md)`/g)) assert.ok(fs.existsSync(path.join(skill, 'references', ref[1])), ref[1]);
        assert.equal(spawnSync('node', [path.join(skill, 'scripts/komainu.mjs'), '--version'], { encoding: 'utf8' }).stdout.trim(), VERSION);
    }
});

test('the skill catalog reference matches the catalog', () => {
    const md = read('skill', 'komainu-guardrails', 'references', 'catalog.md');
    for (const r of RULES) assert.ok(md.includes(`\`${r.id}\``), r.id);
});

test('the project is licensed under the GPL, version 3 or later', () => {
    const root = path.dirname(site());
    assert.match(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'), /GNU GENERAL PUBLIC LICENSE\s+Version 3, 29 June 2007/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).license, 'GPL-3.0-or-later');
    assert.match(fs.readFileSync(CLI, 'utf8'), /SPDX-License-Identifier: GPL-3\.0-or-later/);
    assert.match(read('skill', 'komainu-guardrails', 'SKILL.md'), /^license: GPL-3\.0-or-later$/m);
    for (const page of ['index.html', 'templates.html']) assert.match(read(page), /open source · GPLv3/);
});
