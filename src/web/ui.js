// Interface wording. The English string is the key, so the code reads
// naturally and a missing translation falls back to English. A test checks
// that every string passed to t() has a Japanese entry.

/** The language of the page: Japanese pages live under /ja/ and say so on <html>. */
export const LANG = document.documentElement.lang === 'ja' ? 'ja' : 'en';

const JA = {
    // shared
    'Copied': 'コピーしました',
    'Download': 'ダウンロード',
    'Copy': 'コピー',
    'Remove': '削除',
    'Remove all': 'すべて削除',
    'Discard': '破棄',
    'optional': '任意',
    '{n} rules': '{n} 件のルール',
    '{n} rule': '{n} 件のルール',
    '{n} files': '{n} 個のファイル',
    '{n} file': '{n} 個のファイル',
    '{n} areas': '{n} 領域',
    '{n} area': '{n} 領域',
    '{n} questions': '{n} 問',
    '{n} question': '{n} 問',
    '{n} must': '必須 {n}',
    '{n} should': '推奨 {n}',
    'must': '必須',
    'should': '推奨',
    'off': 'オフ',

    // sidebar
    'Setup': '設定',
    'Template': 'テンプレート',
    'Organization': '組織',
    'Data handling': 'データの取り扱い',
    'Install targets': '導入先',
    'Areas': '領域',
    'Your rules': '独自のルール',
    'Templates and import': 'テンプレートとインポート',
    'Include {name}': '{name} を含める',
    'Always included': '常に含まれます',

    // template view
    'Start from a template': 'テンプレートから始める',
    'A template sets the areas, the strictness and where the guardrails are installed. Everything stays editable afterwards.': 'テンプレートは、領域、厳格さ、ガードレールの導入先を設定します。その後もすべて編集できます。',
    'Loaded "{name}"': '「{name}」を読み込みました',
    '{n} areas · {level}': '{n} 領域 · {level}',
    'Open an existing configuration': '既存の設定を開く',
    'Paste a komainu.json, a share link or a command you were sent.': 'komainu.json、共有リンク、または受け取ったコマンドを貼り付けてください。',
    'Paste a komainu.json, a share link or a command': 'komainu.json、共有リンク、またはコマンドを貼り付け',
    'Open it': '開く',
    'Configuration loaded': '設定を読み込みました',
    'Loaded shared configuration': '共有された設定を読み込みました',

    // organization view
    'Your organization': '組織について',
    'These details are written into the generated files. Use roles and channels. Leave out personal contact details.': 'ここに入力した内容は生成されるファイルに書き込まれます。役割やチャンネル名を使い、個人の連絡先は入れないでください。',
    'Name': '名称',
    'Shown in the generated files': '生成されるファイルに表示されます',
    'Owner of AI questions and incidents': 'AI に関する質問とインシデントの担当',
    'A role or channel': '役割またはチャンネル',
    'Approved AI tools': '承認済みの AI ツール',
    'e.g. Claude Enterprise, GitHub Copilot Business': '例: Claude Enterprise、GitHub Copilot Business',
    'Strictness': '厳格さ',
    'Language of the generated files': '生成されるファイルの言語',

    // data view
    'What may go to a hosted AI service, and what is blocked or redacted on the machine before it leaves.': 'ホスト型 AI サービスに送ってよいものと、端末から出る前にブロックまたは伏せるものを設定します。',
    'Classification levels, lowest first': '分類レベル (低い順)',
    'Highest level for hosted AI': 'ホスト型 AI に送れる最高レベル',
    'Enter at least two levels': 'レベルを 2 つ以上入力してください',
    'Route for anything higher': 'それより高いレベルの経路',
    'e.g. the on-premises model endpoint': '例: オンプレミスのモデルエンドポイント',
    'Block and redact locally': 'ローカルでブロック・伏せ字にするもの',
    'Sensitive names to block': 'ブロックする機密名称',
    'Client names, project codenames. One per line or comma-separated.': 'クライアント名、プロジェクトのコードネームなど。1 行に 1 つ、またはカンマ区切り。',
    'The local hook enforces these. They are never written into instruction files, so they are not sent to a model.': 'これらはローカルのフックが強制します。指示ファイルには書き込まれないため、モデルに送られることはありません。',

    // targets view
    'Where to install them': 'どこに導入するか',
    'Pick every assistant your teams use. Each one gets the same rules in its own format.': 'チームが使うアシスタントをすべて選んでください。それぞれの形式で同じルールが書き出されます。',

    // area view
    'Area': '領域',
    'This area is off, so none of its rules are installed.': 'この領域はオフのため、ルールは導入されません。',
    'Turn on {name}': '{name} をオンにする',
    'Filter rules': 'ルールを絞り込む',
    'Show': '表示',
    'all': 'すべて',
    'on': 'オン',
    'enforced': '強制',
    '{n} shown': '{n} 件を表示',
    'All on': 'すべてオン',
    'Reset to {level}': '{level} に戻す',
    'No rules match.': '一致するルールはありません。',
    'Your rule': '独自のルール',
    'Add your own {name} rule': '{name} の独自ルールを追加',
    'New {name} rule': '{name} の新しいルール',
    'Level': 'レベル',
    'MUST': '必須',
    'SHOULD': '推奨',
    'Add rule': 'ルールを追加',

    // templates and import view
    'Download a policy template to edit, or bring the rules your organization already keeps. Files are read in this tab and are not uploaded anywhere.': 'ポリシーテンプレートをダウンロードして編集するか、組織で既に管理しているルールを取り込みます。ファイルはこのタブの中で読み取られ、どこにもアップロードされません。',
    'Start from a policy template': 'ポリシーテンプレートから始める',
    'Download the rules for a role or an area as a CSV file. Edit the wording in a spreadsheet, delete the rows that do not apply and add rows of your own. Then import the file below. Rows you leave alone stay catalog rules, and rows you change become your rules.': '役割または領域ごとのルールを CSV ファイルとしてダウンロードします。表計算ソフトで文言を編集し、当てはまらない行を削除し、独自の行を追加してから、下でファイルをインポートしてください。変更しなかった行はカタログのルールのまま、変更した行は独自のルールになります。',
    'By role': '役割別',
    'By area': '領域別',
    'Download CSV': 'CSV をダウンロード',
    'Import a file': 'ファイルをインポート',
    'Columns or keys: rule, level, area, source. Only rule is required. A template also has id and title.': '列またはキー: rule、level、area、source。必須なのは rule だけです。テンプレートには id と title もあります。',
    'Found {rules} of your own in {name}: {areas}.': '{name} に独自のルールが{rules}見つかりました: {areas}。',
    'Found {rules} of your own: {areas}.': '独自のルールが{rules}見つかりました: {areas}。',
    'Read the template in {name}. No rule text was changed.': '{name} のテンプレートを読み取りました。ルールの文言に変更はありません。',
    'Read the template. No rule text was changed.': 'テンプレートを読み取りました。ルールの文言に変更はありません。',
    'No rules could be read from {name}.': '{name} からルールを読み取れませんでした。',
    'No rules could be read.': 'ルールを読み取れませんでした。',
    'Skipped {n} ({why}): row {rows}.': '{n} 件をスキップ ({why}): {rows} 行目。',
    'The rules files, the policy and the quiz are written in this language.': 'ルールファイル、ポリシー、クイズはこの言語で書き出されます。',
    'Choose a file': 'ファイルを選択',
    'or drop one here, or paste below': 'またはここにドロップするか、下に貼り付け',
    'Paste CSV or JSON': 'CSV または JSON を貼り付け',
    'Area when a rule names none': '領域の指定がないルールの領域',
    'Read rules': 'ルールを読み取る',
    'Blank CSV': '空の CSV',
    'Blank JSON': '空の JSON',
    'That file is larger than 2 MB. Export only the rules.': 'ファイルが 2 MB を超えています。ルールだけを書き出してください。',
    'Skipped {n} ({why}): rows {rows}.': '{n} 件をスキップ ({why}): {rows} 行目。',
    'Applying this also turns on: {areas}.': '適用すると、次の領域もオンになります: {areas}。',
    'Showing the first 100 of {n}.': '{n} 件のうち最初の 100 件を表示しています。',
    'Apply this template': 'このテンプレートを適用',
    'Add {rules}': '{rules}を追加',
    'Template applied': 'テンプレートを適用しました',
    'Added {rules}': '{rules}を追加しました',
    '{rules} of your own': '独自のルール {rules}',
    'Your rules were removed': '独自のルールを削除しました',
    'Rule': 'ルール',
    'Source': '出典',

    // output
    '{rules} · {files}': '{rules} · {files}',
    'Shell': 'シェル',
    'Terminal': 'ターミナル',
    'Run this in the root of the repository or folder where the guardrails should live. It writes {files} and merges with what is already there.': 'ガードレールを置くリポジトリまたはフォルダーのルートで実行してください。{files}を書き込み、既にあるものとマージします。',
    'This configuration is large. ': 'この設定は大きなサイズです。',
    'Some terminals cut very long commands, so download komainu.json into the folder and run the short command instead.': 'ターミナルによっては非常に長いコマンドが途中で切れるため、komainu.json をフォルダーにダウンロードし、代わりに短いコマンドを実行してください。',
    'Downloads the Komainu CLI. It is one readable file with no dependencies, and it makes no network calls.': 'Komainu CLI をダウンロードします。依存関係のない、読める 1 つのファイルで、ネットワーク通信は行いません。',
    'Uses the komainu.mjs you downloaded with this page; keep it next to where you run the command.': 'このページと一緒にダウンロードした komainu.mjs を使います。コマンドを実行する場所の隣に置いてください。',
    'Your choices are inside the command. No server received them.': '選んだ内容はコマンドの中にあります。どのサーバーにも送られていません。',
    'Needs Node.js 18 or newer. Add --dry-run to preview without writing.': 'Node.js 18 以上が必要です。--dry-run を付けると、書き込まずに確認できます。',
    'A self-contained installer with every file inside it. No download and no Node.js needed. It never overwrites an existing file.': 'すべてのファイルを含む、単体で動くインストーラーです。ダウンロードも Node.js も不要で、既存のファイルを上書きしません。',
    'Paste into PowerShell, or download and run: ./install-guardrails.ps1': 'PowerShell に貼り付けるか、ダウンロードして実行: ./install-guardrails.ps1',
    'Paste into a terminal, or download and run: bash install-guardrails.sh': 'ターミナルに貼り付けるか、ダウンロードして実行: bash install-guardrails.sh',
    'Paste this into your coding agent. It reads your internal policy documents on your machine, maps each clause to a rule, shows you the gaps, and only then installs.': 'これをコーディングエージェントに貼り付けてください。エージェントは端末上の社内ポリシー文書を読み、各条項をルールに対応付け、不足を示したうえで導入します。',
    'Prompt': 'プロンプト',
    'written by Komainu': 'Komainu が書き込み',
    'managed block inside your file': 'ファイル内の管理ブロック',
    'merged into your settings': '設定にマージ',
    'a copy of the CLI': 'CLI のコピー',
    '(The komainu CLI copies itself here so the MCP server can run from the repository.)': '(MCP サーバーをリポジトリから実行できるよう、komainu CLI が自身をここにコピーします。)',
    'Download all': 'すべてダウンロード',
    '"Download all" saves {files} as one zip, in the folders shown above. Unzip it in the root of your repository. Unzipping replaces files of the same name, so use the command if the folder already has files such as AGENTS.md.': '「すべてダウンロード」は、{files}を上記のフォルダー構成のまま 1 つの zip に保存します。リポジトリのルートで展開してください。展開すると同名のファイルは置き換えられるため、AGENTS.md などが既にある場合はコマンドを使ってください。',
    ' The copy of the CLI is not included; the command and the offline script cover it.': ' CLI のコピーは含まれません。コマンドとオフラインスクリプトが対応します。',
    'A quiz made from the rules you selected, to share with your team for training. The HTML file works on its own: people open it, answer, and see the reason behind each answer. It records nothing.': '選んだルールから作るクイズです。研修用にチームに共有できます。HTML ファイルは単体で動作し、開いて回答すると、各解答の理由が表示されます。何も記録しません。',
    'Questions': '問題数',
    'Different questions': '別の問題にする',
    '{questions}: {scenarios} from written situations, {generated} generated from the rule text. They cover {rules}.': '{questions}: 場面設定の問題 {scenarios} 問、ルールの文言から生成した問題 {generated} 問。{rules}を扱います。',
    'Download quiz (HTML)': 'クイズをダウンロード (HTML)',
    'Quiz link': 'クイズのリンク',
    'Open the quiz in a new tab': '新しいタブでクイズを開く',
    '. Anyone with the link gets the same questions. The rules sit after the # in the address, which browsers do not send to any server, and your sensitive names are left out of it.': '。リンクを知っている人は同じ問題を受けられます。ルールはアドレスの # より後ろにあり、ブラウザーはその部分をサーバーに送りません。機密名称はリンクに含まれません。',
    'Sample: question {n}': 'サンプル: 問 {n}',
    'Answer: {letter}': '解答: {letter}',
    'Markdown suits printing and wikis. CSV has one row per question for a form builder or a learning system.': 'Markdown は印刷や wiki に向いています。CSV は 1 問 1 行で、フォーム作成ツールや学習システムに取り込めます。',
    'Send this link to a colleague to continue from the same choices. The configuration sits after the # in the address, which browsers do not send to any server.': 'このリンクを同僚に送ると、同じ選択から続けられます。設定はアドレスの # より後ろにあり、ブラウザーはその部分をサーバーに送りません。',
    'Share link': '共有リンク',
    'Careful: ': '注意: ',
    'this configuration contains your sensitive names. Share it only with people allowed to see them.': 'この設定には機密名称が含まれています。見てよい人にだけ共有してください。',

    // templates page
    'Role template': '役割テンプレート',
    'Area template': '領域テンプレート',
    'Filter these rules': 'このルールを絞り込む',
    'Download quiz': 'クイズをダウンロード',
    'Take the quiz': 'クイズを受ける',
    'Open in the builder': 'ビルダーで開く',
    '{shown} of {rules} shown. The CSV file contains all of them, with the columns id, area, level, title, rule and source. In the file, words in braces such as {contact} are filled in from your configuration.': '{rules}のうち {shown} 件を表示しています。CSV ファイルにはすべてが含まれ、列は id、area、level、title、rule、source です。ファイル内の {contact} のような波かっこの語は、設定の値に置き換えられます。',
    'Showing {name}, {rules}.': '{name} を表示中、{rules}。',

    // quiz page
    'There is no quiz in this link': 'このリンクにクイズはありません',
    'This link has no quiz in it': 'このリンクにクイズが含まれていません',
    'The link names an area with no rules switched on': 'リンクが指定する領域に、オンになっているルールがありません',
    '{message}. Ask whoever sent the link for a new one, or make a quiz in the ': '{message}。リンクを送った人に新しいリンクを依頼するか、',
    'builder': 'ビルダー',
    ' or from a ': 'または',
    'template': 'テンプレート',
    '. ': 'からクイズを作成してください。'
};

/** Returns the wording for the page's language, with {name} slots filled in. */
export function t(en, vars) {
    const template = (LANG === 'ja' && JA[en]) || en;
    return vars ? template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : template;
}

/** "3 rules" or "3 件のルール". */
export const count = (n, word) => t(n === 1 ? `{n} ${word}` : `{n} ${word}s`, { n });

export const UI_JA = JA;
