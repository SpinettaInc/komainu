// Landing page: copy buttons, code tabs and the demo.
// It makes no network requests and uses no browser storage.

const ONLINE = /^https?:$/.test(location.protocol);
const JA = document.documentElement.lang === 'ja';
// Japanese pages sit one folder down; the CLI and the skill live at the site root.
const BASE = ONLINE ? new URL(JA ? '..' : '.', location.href).href.replace(/\/$/, '') : JA ? '..' : '.';

// Commands are shown for the address this page is served from.
for (const el of document.querySelectorAll('[data-base]')) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) node.nodeValue = node.nodeValue.replaceAll('{{BASE}}', BASE);
}
if (!ONLINE) for (const el of document.querySelectorAll('[data-online]')) el.hidden = true;

// ---- copy buttons ----
for (const button of document.querySelectorAll('[data-copy]')) {
    button.addEventListener('click', async () => {
        const source = document.querySelector(button.getAttribute('data-copy'));
        if (!source || !navigator.clipboard) return;
        await navigator.clipboard.writeText(source.textContent.trim());
        const label = button.textContent;
        button.textContent = JA ? 'コピーしました' : 'Copied';
        setTimeout(() => { button.textContent = label; }, 1400);
    });
}

// ---- code tabs ----
const tabs = [...document.querySelectorAll('.tabs [role=tab]')];
function selectTab(tab) {
    for (const other of tabs) {
        const on = other === tab;
        other.setAttribute('aria-selected', String(on));
        other.tabIndex = on ? 0 : -1;
        document.getElementById(other.getAttribute('aria-controls')).hidden = !on;
    }
}
tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        const next = tabs[(index + step + tabs.length) % tabs.length];
        selectTab(next);
        next.focus();
    });
});

// ---- demo: one policy clause, followed through to a session ----
// Each pane is a list of parts: plain strings, or [class, text] for a marked span.
const DEMO_EN = {
    enforced: [
        ['Security Policy §4.2: ', ['warn', 'Credentials must never be shared'], ' with third-party tools.'],
        [['rule', 'core.no-secrets'], ' MUST · No credentials, ever. Never put API keys, passwords or tokens into prompts, files or outputs.'],
        ['The rule goes into ', ['file', 'AGENTS.md'], ', and its check into ', ['file', '.claude/hooks/komainu-guard.mjs'], '.'],
        ['You paste a key: ', ['warn', 'AKIA················'], '. The hook stops the prompt before it is sent: "replace it with ', ['rule', '[REDACTED_SECRET]'], '".']
    ],
    instructed: [
        ['Code of Conduct §7: ', ['warn', 'Recruiters make the hiring decision.']],
        [['rule', 'hr.no-auto-decisions'], ' MUST · People decide about people. AI must not make, or be the sole basis for, hiring decisions.'],
        ['The rule goes into ', ['file', 'AGENTS.md'], ' and into the HR pack ', ['file', 'assistant-instructions/hr.md'], '.'],
        ['Asked to pick the best candidate, the assistant summarizes the CVs and says the decision is yours, citing ', ['rule', 'hr.no-auto-decisions'], '.']
    ],
    attested: [
        ['AI Policy §3.1: ', ['warn', 'Staff complete AI training every year.']],
        [['rule', 'core.literacy'], ' SHOULD · Train before use. Everyone who uses AI at work completes the training for their role.'],
        ['The rule goes into ', ['file', 'ai-acceptable-use-policy.md'], ' as a checklist line: "Train before use, owner: ______".'],
        ['Nothing happens in the session. No assistant can check this one, so ', ['rule', 'a named person'], ' confirms it.']
    ]
};

const DEMO_JA = {
    enforced: [
        ['セキュリティポリシー 4.2: ', ['warn', '認証情報を外部ツールと共有してはならない'], '。'],
        [['rule', 'core.no-secrets'], ' 必須 · 認証情報は決して入れない。API キー、パスワード、トークンをプロンプト、ファイル、出力に入れない。'],
        ['ルールは ', ['file', 'AGENTS.md'], ' に、そのチェックは ', ['file', '.claude/hooks/komainu-guard.mjs'], ' に書き込まれます。'],
        ['キーを貼り付けると: ', ['warn', 'AKIA················'], '。フックが送信前にプロンプトを止めます: 「', ['rule', '[REDACTED_SECRET]'], ' に置き換えてください」。']
    ],
    instructed: [
        ['行動規範 7: ', ['warn', '採用の判断は採用担当者が行う。']],
        [['rule', 'hr.no-auto-decisions'], ' 必須 · 人に関する判断は人が行う。AI に採用の判断をさせず、唯一の根拠にもしない。'],
        ['ルールは ', ['file', 'AGENTS.md'], ' と、人事向けパック ', ['file', 'assistant-instructions/hr.md'], ' に書き込まれます。'],
        ['最適な候補者を選ぶよう頼まれると、アシスタントは履歴書を要約し、', ['rule', 'hr.no-auto-decisions'], ' を示して、判断はあなたが行うと伝えます。']
    ],
    attested: [
        ['AI ポリシー 3.1: ', ['warn', '職員は毎年 AI 研修を修了する。']],
        [['rule', 'core.literacy'], ' 推奨 · 使う前に研修を受ける。業務で AI を使う人は全員、役割に応じた研修を修了する。'],
        ['ルールは ', ['file', 'ai-acceptable-use-policy.md'], ' にチェックリストの 1 行として入ります: 「使う前に研修を受ける、担当: ______」。'],
        ['セッションの中では何も起こりません。アシスタントには確認できないため、', ['rule', '指名された担当者'], ' が確認します。']
    ]
};
const DEMO = JA ? DEMO_JA : DEMO_EN;

const demo = document.getElementById('demo');
const note = document.getElementById('demo-note');
const modeButtons = [...demo.querySelectorAll('[data-mode]')];

function render(mode) {
    DEMO[mode].forEach((parts, paneIndex) => {
        const target = demo.querySelector(`[data-pane="${paneIndex}"]`);
        target.textContent = '';
        parts.forEach((part, index) => {
            if (typeof part === 'string') {
                target.append(part);
                return;
            }
            const span = document.createElement('span');
            span.className = 'ent ' + part[0];
            span.style.animationDelay = `${paneIndex * 90 + index * 25}ms`;
            span.textContent = part[1];
            target.append(span);
        });
    });
    note.textContent = note.getAttribute('data-' + mode) || '';
    for (const button of modeButtons) button.setAttribute('aria-pressed', String(button.getAttribute('data-mode') === mode));
    demo.classList.remove('animate');
    void demo.offsetWidth;
    demo.classList.add('animate');
}
for (const button of modeButtons) button.addEventListener('click', () => render(button.getAttribute('data-mode')));
render('enforced');
