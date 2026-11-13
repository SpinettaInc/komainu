// Detectors for secrets and personal data. Regex sources are strings so the
// same list can be embedded verbatim in the generated hook script.

export const DETECTORS = [
    // secrets
    { id: 'private-key', cls: 'secrets', name: 'private key', ph: '[REDACTED_SECRET]', re: '-----BEGIN (?:[A-Z]+ )?PRIVATE KEY(?: BLOCK)?-----' },
    { id: 'aws-key', cls: 'secrets', name: 'AWS access key', ph: '[REDACTED_SECRET]', re: '\\b(?:AKIA|ASIA)[0-9A-Z]{16}\\b' },
    { id: 'github-token', cls: 'secrets', name: 'GitHub token', ph: '[REDACTED_SECRET]', re: '\\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\\b' },
    { id: 'slack-token', cls: 'secrets', name: 'Slack token', ph: '[REDACTED_SECRET]', re: '\\bxox[abposr]-[A-Za-z0-9-]{10,}' },
    { id: 'llm-key', cls: 'secrets', name: 'AI provider API key', ph: '[REDACTED_SECRET]', re: '\\bsk-(?:ant-|proj-|or-)?[A-Za-z0-9_-]{24,}' },
    { id: 'google-key', cls: 'secrets', name: 'Google API key', ph: '[REDACTED_SECRET]', re: '\\bAIza[0-9A-Za-z_-]{35}\\b' },
    { id: 'stripe-key', cls: 'secrets', name: 'Stripe key', ph: '[REDACTED_SECRET]', re: '\\b[sr]k_(?:live|test)_[0-9a-zA-Z]{20,}' },
    { id: 'jwt', cls: 'secrets', name: 'JSON Web Token', ph: '[REDACTED_SECRET]', re: '\\beyJ[A-Za-z0-9_-]{8,}\\.eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}' },
    { id: 'conn-string', cls: 'secrets', name: 'connection string with password', ph: '[REDACTED_SECRET]', re: '\\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\\+srv)?|redis|amqps?|mssql)://[^\\s:@/]+:[^\\s@/]{3,}@[^\\s"\']+' },
    { id: 'password', cls: 'secrets', name: 'hardcoded password or key', ph: '[REDACTED_SECRET]', flags: 'gi', re: '\\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\\b["\']?\\s*[:=]\\s*["\'](?![^"\']*(?:your|example|change|placeholder|redacted|xxxx|\\*\\*\\*))[^"\'\\s$<{]{8,}["\']' },
    // personal data
    { id: 'cc', cls: 'cc', name: 'payment card number', ph: '[REDACTED_CC]', check: 'luhn', re: '(?<![\\w.-])(?:\\d[ -]?){12,18}\\d(?![\\w-])' },
    { id: 'iban', cls: 'iban', name: 'IBAN', ph: '[REDACTED_IBAN]', check: 'iban', re: '\\b[A-Z]{2}\\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\\b' },
    { id: 'ssn', cls: 'ssn', name: 'US Social Security number', ph: '[REDACTED_SSN]', re: '\\b(?!000|666|9\\d\\d)\\d{3}-(?!00)\\d{2}-(?!0000)\\d{4}\\b' },
    { id: 'email', cls: 'email', name: 'email address', ph: '[REDACTED_EMAIL]', re: '\\b[A-Za-z0-9._%+-]+@(?!(?:[\\w-]+\\.)*example\\.(?:com|org|net)\\b)(?!users\\.noreply\\.)[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}\\b' },
    { id: 'phone', cls: 'phone', name: 'phone number', ph: '[REDACTED_PHONE]', re: '(?<![\\w.])\\+\\d{1,3}[ .-]?\\(?\\d{1,4}\\)?(?:[ .-]?\\d{2,4}){2,4}\\b' }
];

export const detectorsFor = (classes) => DETECTORS.filter((d) => classes.includes(d.cls));

// The scanner is kept as source text so the generated hook embeds exactly the
// same bytes whether it is produced by the web app, the CLI or the tests
// (bundlers reformat real functions). It is compiled lazily, and only in Node:
// the web app embeds it but never runs it, so the page needs no eval.
export const SCAN_SOURCE = String.raw`function scanText(text, detectors, terms) {
  const luhn = (s) => {
    const d = s.replace(/\D/g, '');
    if (d.length < 13 || d.length > 19 || /^(\d)\1+$/.test(d)) return false;
    let sum = 0;
    for (let i = 0; i < d.length; i++) {
      let n = +d[d.length - 1 - i];
      if (i % 2) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
    }
    return sum % 10 === 0;
  };
  const iban = (s) => {
    const v = s.replace(/ /g, '');
    if (v.length < 15 || v.length > 34) return false;
    const r = (v.slice(4) + v.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let m = 0;
    for (const ch of r) m = (m * 10 + +ch) % 97;
    return m === 1;
  };
  const spans = [];
  for (const d of detectors || []) {
    const re = new RegExp(d.re, d.flags || 'g');
    let m;
    while ((m = re.exec(text))) {
      if (!m[0]) { re.lastIndex++; continue; }
      if (d.check === 'luhn' && !luhn(m[0])) continue;
      if (d.check === 'iban' && !iban(m[0])) continue;
      spans.push({ id: d.id, cls: d.cls, name: d.name, ph: d.ph, start: m.index, end: m.index + m[0].length });
    }
  }
  const lower = text.toLowerCase();
  for (const t of terms || []) {
    const needle = String(t).trim().toLowerCase();
    if (needle.length < 2) continue;
    for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + needle.length)) {
      spans.push({ id: 'term', cls: 'term', name: 'sensitive term', ph: '[REDACTED_TERM]', start: i, end: i + needle.length });
    }
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const findings = [];
  let redacted = '';
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue;
    redacted += text.slice(pos, s.start) + s.ph;
    pos = s.end;
    findings.push({ id: s.id, cls: s.cls, name: s.name, placeholder: s.ph, line: text.slice(0, s.start).split('\n').length });
  }
  redacted += text.slice(pos);
  return { findings, redacted };
}`;

let compiled;
export function scanText(text, detectors, terms) {
    compiled ??= new Function(`return ${SCAN_SOURCE}`)();
    return compiled(text, detectors, terms);
}
