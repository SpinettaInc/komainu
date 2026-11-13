import test from 'node:test';
import assert from 'node:assert/strict';

import { DETECTORS, SCAN_SOURCE, detectorsFor, scanText } from '../src/core/detectors.js';
import { AWS, CARD, IBAN } from './helpers.mjs';

const ids = (text, detectors = DETECTORS, terms = []) => scanText(text, detectors, terms).findings.map((f) => f.id);
const j = (...parts) => parts.join('');

// [label, text, expected detector ids]. Secret-shaped values are joined at runtime.
const CASES = [
    ['AWS access key', `key ${AWS} here`, ['aws-key']],
    ['AWS temporary key', j('ASIA', 'ABCDEFGHIJKLMNOP'), ['aws-key']],
    ['AWS-like but too short', j('AKIA', 'ABCDEFGH'), []],
    ['private key header', j('-----BEGIN RSA ', 'PRIVATE KEY-----'), ['private-key']],
    ['OpenSSH private key header', j('-----BEGIN OPENSSH ', 'PRIVATE KEY-----'), ['private-key']],
    ['public key header', '-----BEGIN PUBLIC KEY-----', []],
    ['GitHub personal token', j('ghp_', 'a'.repeat(36)), ['github-token']],
    ['GitHub fine-grained token', j('github_pat_', 'A1'.repeat(25)), ['github-token']],
    ['Slack bot token', j('xoxb-', '1234567890-abcdefghij'), ['slack-token']],
    ['AI provider key', j('sk-ant-', 'a1B2'.repeat(8)), ['llm-key']],
    ['project-scoped AI key', j('sk-proj-', 'a1B2'.repeat(8)), ['llm-key']],
    ['short sk- word', 'the sk-learn package', []],
    ['Google API key', j('AIza', 'B'.repeat(35)), ['google-key']],
    ['Stripe live key', j('sk_live_', 'a1'.repeat(12)), ['stripe-key']],
    ['Stripe restricted test key', j('rk_test_', 'a1'.repeat(12)), ['stripe-key']],
    ['JSON Web Token', j('eyJhbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', '.', 'abcDEF123456'), ['jwt']],
    ['Postgres URL with password', j('postgres://app:', 's3cretpw', '@db.internal:5432/x'), ['conn-string']],
    ['MongoDB SRV URL with password', j('mongodb+srv://u:', 'hunter22', '@cluster0.example.net/db'), ['conn-string']],
    ['database URL without password', 'postgres://db.internal:5432/x', []],
    ['hardcoded password', j('const password = "', 'hunter2hunter2', '"'), ['password']],
    ['hardcoded API key in JSON', j('"api_key": "', 'a1b2c3d4e5f6', '"'), ['password']],
    ['password placeholder', 'password = "<your-password>"', []],
    ['API key placeholder', 'api_key = "YOUR_API_KEY_HERE"', []],
    ['password from the environment', 'password = process.env.DB_PASSWORD', []],
    ['short password literal', 'password = "abc"', []],
    ['Visa test card with spaces', `card ${CARD}`, ['cc']],
    ['card with dashes', CARD.replace(/ /g, '-'), ['cc']],
    ['card without separators', CARD.replace(/ /g, ''), ['cc']],
    ['sixteen digits failing Luhn', '4111 1111 1111 1112', []],
    ['all-same digits', '0000 0000 0000 0000', []],
    ['long order number', 'order 1234567890123456789012', []],
    ['version and date', 'version 1.2.3.4 on 2026-11-13', []],
    ['valid IBAN', IBAN, ['iban']],
    ['IBAN without spaces', IBAN.replace(/ /g, ''), ['iban']],
    ['IBAN with a bad checksum', IBAN.replace(/32$/, '33'), []],
    ['US Social Security number', `ssn ${['123', '45', '6789'].join('-')}`, ['ssn']],
    ['SSN with an invalid area', '000-12-3456', []],
    ['SSN-like date range', '2020-2021-2022', []],
    ['email address', 'mail jane.doe@corp.test', ['email']],
    ['example.com address', 'mail user@example.com', []],
    ['subdomain of example.org', 'a@mail.example.org', []],
    ['GitHub noreply address', '123+u@users.noreply.github.com', []],
    ['international phone number', 'call +44 20 7946 0958', ['phone']],
    ['phone with dashes', '+1-202-555-0143', ['phone']],
    ['a plus sign in arithmetic', 'x = a +1', []]
];

for (const [label, text, expected] of CASES) {
    test(`detects: ${label}`, () => {
        assert.deepEqual(ids(text), expected);
    });
}

test('every detector has a case that triggers it', () => {
    const hit = new Set(CASES.flatMap(([, text]) => ids(text)));
    for (const d of DETECTORS) assert.ok(hit.has(d.id), `${d.id} has no positive case`);
});

test('every detector compiles and declares a placeholder', () => {
    for (const d of DETECTORS) {
        assert.doesNotThrow(() => new RegExp(d.re, d.flags || 'g'));
        assert.match(d.ph, /^\[REDACTED_[A-Z]+\]$/);
    }
});

test('detectorsFor filters by class', () => {
    assert.deepEqual(detectorsFor([]), []);
    assert.deepEqual([...new Set(detectorsFor(['cc', 'iban']).map((d) => d.cls))], ['cc', 'iban']);
    assert.deepEqual(ids(`${AWS} ${CARD}`, detectorsFor(['cc'])), ['cc']);
});

test('redaction replaces each value and keeps the rest', () => {
    const r = scanText(`a ${AWS}\nb ${CARD} c`, DETECTORS, []);
    assert.equal(r.redacted, 'a [REDACTED_SECRET]\nb [REDACTED_CC] c');
    assert.deepEqual(r.findings.map((f) => [f.line, f.placeholder]), [[1, '[REDACTED_SECRET]'], [2, '[REDACTED_CC]']]);
});

test('findings never contain the sensitive value', () => {
    const r = scanText(`${AWS} ${CARD} ${IBAN}`, DETECTORS, ['Falcon']);
    assert.ok(!JSON.stringify(r.findings).includes(AWS) && !JSON.stringify(r.findings).includes('4111'));
});

test('sensitive terms match case-insensitively and repeat', () => {
    const r = scanText('Falcon, FALCON and project falcon.', [], ['Falcon']);
    assert.equal(r.findings.length, 3);
    assert.equal(r.redacted, '[REDACTED_TERM], [REDACTED_TERM] and project [REDACTED_TERM].');
});

test('terms shorter than two characters are ignored', () => {
    assert.deepEqual(ids('a b c', [], ['a', ' ', '']), []);
});

test('overlapping matches are reported once', () => {
    const r = scanText(`password = "${AWS}"`, DETECTORS, []);
    assert.equal(r.findings.length, 1);
    assert.ok(!r.redacted.includes(AWS));
});

test('clean and empty text produce no findings', () => {
    assert.deepEqual(scanText('', DETECTORS, ['Falcon']), { findings: [], redacted: '' });
    assert.deepEqual(scanText('Nothing to see here.', DETECTORS, ['Falcon']).findings, []);
    assert.deepEqual(scanText('text', undefined, undefined).findings, []);
});

test('the scanner source is one self-contained function', () => {
    assert.match(SCAN_SOURCE, /^function scanText\(text, detectors, terms\) \{/);
    assert.ok(!SCAN_SOURCE.includes('import ') && !SCAN_SOURCE.includes('require('));
    const standalone = new Function(`return ${SCAN_SOURCE}`)();
    assert.deepEqual(standalone(`x ${AWS}`, DETECTORS, []), scanText(`x ${AWS}`, DETECTORS, []));
});

test('a long input is scanned quickly', () => {
    const big = `${'lorem ipsum dolor sit amet 1234 5678 '.repeat(20000)}${AWS}`;
    const started = Date.now();
    assert.deepEqual(ids(big), ['aws-key']);
    assert.ok(Date.now() - started < 3000, 'no catastrophic backtracking');
});
