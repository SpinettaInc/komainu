// Shared test helpers.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import { DOMAINS, TARGETS, REDACT_CLASSES } from '../src/core/catalog.js';

export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const site = (...p) => path.join(root, 'public', ...p);
export const CLI = site('komainu.mjs');
export const read = (...p) => fs.readFileSync(site(...p), 'utf8');

export const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'komainu-'));
export const run = (args, opts = {}) => spawnSync('node', [CLI, ...args], { encoding: 'utf8', ...opts });

// Fake values are assembled at runtime so no file holds a secret-shaped literal.
export const AWS = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
export const CARD = ['4111', '1111', '1111', '1111'].join(' ');
export const IBAN = ['GB82', 'WEST', '1234', '5698', '7654', '32'].join(' ');
export const git = (...a) => ['git', ...a].join(' ');
export const rm = (...a) => ['rm', ...a].join(' ');

/** Every area, every target, every redaction class, strict. */
export const FULL = {
    org: 'Example Org',
    strictness: 'strict',
    domains: DOMAINS.map((d) => d.id),
    terms: ['Project Falcon'],
    redact: REDACT_CLASSES.map((c) => c.id),
    targets: TARGETS.map((t) => t.id)
};

/** jsdom lacks a few things every browser has. */
export function prepare(window) {
    window.TextEncoder = TextEncoder;
    window.TextDecoder = TextDecoder;
}

/** Loads a built page into jsdom and runs its bundled script. */
export function loadPage(name, { hash = '' } = {}) {
    const html = read(name);
    const script = html.match(/<script src="([^"]+)"/)[1];
    const dom = new JSDOM(html, { url: `http://localhost:4173/${name}${hash}`, runScripts: 'outside-only', pretendToBeVisual: true });
    const { window } = dom;
    prepare(window);
    const state = { copied: [], downloads: [] };
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async (t) => { state.copied.push(t); } }, configurable: true });
    window.URL.createObjectURL = () => 'blob:test';
    window.URL.revokeObjectURL = () => {};
    window.HTMLAnchorElement.prototype.click = function click() { if (this.download) state.downloads.push(this.download); };
    // A page under ja/ loads its script from the folder above.
    window.eval(read(path.posix.join(path.posix.dirname(name), script)));
    const $ = (sel) => window.document.querySelector(sel);
    const $$ = (sel) => [...window.document.querySelectorAll(sel)];
    const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
    const type = (sel, value) => { const el = $(sel); el.value = value; fire(el, 'input'); fire(el, 'change'); return el; };
    return { window, document: window.document, $, $$, fire, type, state };
}
