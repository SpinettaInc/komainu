import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { PRESETS } from '../src/core/catalog.js';
import { generate } from '../src/core/generate.js';
import { zip, crc32 } from '../src/core/zip.js';
import { FULL, tmp } from './helpers.mjs';

const text = (s) => new TextEncoder().encode(s);
const hasUnzip = spawnSync('unzip', ['-v']).status === 0;

/** Reads the entries back from the central directory. */
function entries(bytes) {
    const view = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    assert.equal(view.getUint32(end, true), 0x06054B50, 'end-of-archive record');
    const count = view.getUint16(end + 10, true);
    let at = view.getUint32(end + 16, true);
    const out = [];
    for (let i = 0; i < count; i++) {
        assert.equal(view.getUint32(at, true), 0x02014B50, 'central directory entry');
        const size = view.getUint32(at + 24, true);
        const nameLength = view.getUint16(at + 28, true);
        const mode = view.getUint32(at + 38, true) >>> 16;
        const offset = view.getUint32(at + 42, true);
        const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
        assert.equal(view.getUint32(offset, true), 0x04034B50, 'local header');
        const dataAt = offset + 30 + view.getUint16(offset + 26, true);
        const data = bytes.subarray(dataAt, dataAt + size);
        assert.equal(view.getUint32(at + 16, true), crc32(data), `checksum of ${name}`);
        out.push({ name, mode, content: new TextDecoder().decode(data) });
        at += 46 + nameLength;
    }
    return out;
}

test('crc32 matches the standard check values', () => {
    assert.equal(crc32(text('')), 0);
    assert.equal(crc32(text('123456789')), 0xCBF43926);
    assert.equal(crc32(text('The quick brown fox jumps over the lazy dog')), 0x414FA339);
});

test('an empty archive is a valid end record', () => {
    const bytes = zip([]);
    assert.equal(bytes.length, 22);
    assert.deepEqual(entries(bytes), []);
});

test('entries keep their path, content and executable bit', () => {
    const files = [{ path: 'a.txt', content: 'hello\n' }, { path: 'dir/sub/b.mjs', content: '#!/usr/bin/env node\n', exec: true }, { path: 'empty.txt', content: '' }];
    assert.deepEqual(entries(zip(files)), [
        { name: 'a.txt', mode: 0o100644, content: 'hello\n' },
        { name: 'dir/sub/b.mjs', mode: 0o100755, content: '#!/usr/bin/env node\n' },
        { name: 'empty.txt', mode: 0o100644, content: '' }
    ]);
});

test('non-ASCII names and content survive', () => {
    const [entry] = entries(zip([{ path: 'docs/政策.md', content: 'Café 合同会社 → ok' }]));
    assert.deepEqual([entry.name, entry.content], ['docs/政策.md', 'Café 合同会社 → ok']);
});

test('the same files always give the same bytes', () => {
    const files = generate(FULL).filter((f) => f.mode !== 'self');
    assert.deepEqual(zip(files), zip(files));
});

for (const p of PRESETS) {
    test(`the archive for "${p.name}" holds every generated file`, () => {
        const files = generate(p.cfg).filter((f) => f.mode !== 'self');
        const got = entries(zip(files));
        assert.deepEqual(got.map((e) => e.name), files.map((f) => f.path));
        for (const [i, f] of files.entries()) assert.equal(got[i].content, f.content, f.path);
    });
}

test('unzip accepts the archive and restores the files', { skip: !hasUnzip && 'unzip is not installed' }, () => {
    const dir = tmp();
    const files = generate(FULL).filter((f) => f.mode !== 'self');
    fs.writeFileSync(path.join(dir, 'all.zip'), zip(files));
    assert.equal(spawnSync('unzip', ['-tq', 'all.zip'], { cwd: dir }).status, 0, 'the archive passes unzip -t');
    assert.equal(spawnSync('unzip', ['-q', 'all.zip', '-d', 'out'], { cwd: dir }).status, 0);
    for (const f of files) assert.equal(fs.readFileSync(path.join(dir, 'out', f.path), 'utf8'), f.content, f.path);
    assert.ok(fs.statSync(path.join(dir, 'out/.claude/hooks/komainu-guard.mjs')).mode & 0o100, 'the hook is executable after unzip');
    assert.ok(!(fs.statSync(path.join(dir, 'out/AGENTS.md')).mode & 0o100));
});
