// Small DOM helpers shared by the landing page and the builder.
// Nothing here touches the network or browser storage.

import { t, LANG } from './ui.js';

export { LANG };
export const ONLINE = /^https?:$/.test(location.protocol);
/** The folder this page is in. Links to sibling pages keep the page's language. */
export const PAGE_BASE = ONLINE ? new URL('.', location.href).href.replace(/\/$/, '') : '';
/** The site root, where komainu.mjs and the skill live. Japanese pages sit one folder down. */
export const BASE = LANG === 'ja' ? PAGE_BASE.replace(/\/ja$/, '') : PAGE_BASE;
export const $ = (id) => document.getElementById(id);
const nil = (v) => v === null || v === undefined;

export function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === false || nil(v)) continue;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className = v;
        else if (k in el && k !== 'list') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(3)) if (!nil(kid) && kid !== false) el.append(kid);
    return el;
}

export const fill = (el, ...kids) => { el.replaceChildren(...kids.flat(3).filter((k) => !nil(k) && k !== false)); return el; };
export const toggle = (arr, id, on) => (on ? [...new Set([...arr, id])] : arr.filter((x) => x !== id));

let toastTimer;
export function toast(msg) {
    const box = $('toast');
    box.textContent = msg;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 1800);
}

export async function copy(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const ta = h('textarea', { value: text, readOnly: true });
        document.body.append(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
    }
    toast(t('Copied'));
}

/** Saves text, or bytes with the given type, as a file. */
export function download(name, content, type = 'text/plain') {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** `actions` are extra buttons for the bar: [[label, handler]]. */
export function codebox(label, text, { file, nowrap, actions = [] } = {}) {
    return h('div', { class: 'codebox' + (nowrap ? ' nowrap' : '') },
        h('div', { class: 'bar' }, h('span', {}, label),
            h('div', {},
                actions.map(([name, run]) => h('button', { type: 'button', onclick: run }, name)),
                file && h('button', { type: 'button', onclick: () => download(file, text) }, t('Download')),
                h('button', { type: 'button', onclick: () => copy(text) }, t('Copy')))),
        h('pre', { tabIndex: 0, role: 'region', 'aria-label': label }, text));
}
