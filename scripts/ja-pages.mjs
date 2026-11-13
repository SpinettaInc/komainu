// Japanese wording for the static pages. The build reads each English page
// from src/web, swaps every fragment listed here and writes the result under
// public/ja/. The markup stays in one place, so the two languages cannot drift
// apart in structure. A fragment that no longer matches the English page
// stops the build, and a test looks for English sentences left behind.
//
// Fragments include their surrounding > and < where a bare word would also
// match somewhere else.

const ARROW = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';

/** Applied to every page, after the page's own list. A fragment here may be absent from a page. */
export const COMMON = [
    ['<html lang="en">', '<html lang="ja">'],
    ['>Skip to content<', '>本文へ移動<'],
    ['>Skip to the quiz<', '>クイズへ移動<'],
    ['>Skip to the editor<', '>エディターへ移動<'],
    ['aria-label="Komainu home"', 'aria-label="Komainu ホーム"'],
    ['aria-label="Main"', 'aria-label="メイン"'],
    ['aria-label="Footer"', 'aria-label="フッター"'],
    ['Komainu is a product of <a href="https://spinetta.tech/">Spinetta Inc. <span lang="ja">合同会社</span></a> · open source · GPLv3 · this page makes no requests to other sites', 'Komainu は <a href="https://spinetta.tech/">Spinetta Inc. <span lang="ja">合同会社</span></a>のプロダクトです · オープンソース · GPLv3 · このページは他のサイトへリクエストを送りません'],
    ['>Why guardrails<', '>なぜ必要か<'],
    ['>How it works<', '>仕組み<'],
    ['>Features<', '>機能<'],
    ['>Templates<', '>テンプレート<'],
    ['>Quickstart<', '>クイックスタート<'],
    ['>Data flow<', '>データの流れ<'],
    ['>Limits<', '>制限事項<'],
    ['>Home<', '>ホーム<'],
    ['>Builder<', '>ビルダー<'],
    ['>Copy<', '>コピー<']
];

export const PAGES = {
    'index.html': [
        ['<title>Komainu: build AI guardrails for your organization</title>', '<title>Komainu: 組織のための AI ガードレールを作る</title>'],
        ['content="Komainu is a static, store-nothing builder that turns your internal policy into AI guardrails for every team. You pick the rules, copy one command, and run it on your own machine."', 'content="Komainu は、社内ポリシーをすべてのチームのための AI ガードレールに変える、何も保存しない静的なビルダーです。ルールを選び、コマンドを 1 つコピーして、自分の端末で実行します。"'],
        ['content="Komainu: build AI guardrails for your organization"', 'content="Komainu: 組織のための AI ガードレールを作る"'],
        ['content="Turn your internal policy into rules every AI assistant loads, enforced locally where possible. Nothing is stored or sent."', 'content="社内ポリシーを、すべての AI アシスタントが読み込むルールに変え、可能なものはローカルで強制します。何も保存せず、何も送信しません。"'],
        ['AI guardrails builder · open source · v__VERSION__', 'AI ガードレールビルダー · オープンソース · v__VERSION__'],
        ['<h1>Turn your AI policy into guardrails every assistant follows</h1>', '<h1>AI ポリシーを、すべてのアシスタントが従うガードレールに</h1>'],
        ['<strong>Komainu builds AI guardrails for your whole organization, from your own policy.</strong> You pick the rules in the browser, copy one command, and run it on your own machine. Nothing you enter is stored or sent.', '<strong>Komainu は、自社のポリシーをもとに、組織全体の AI ガードレールを作ります。</strong>ブラウザーでルールを選び、コマンドを 1 つコピーして、自分の端末で実行します。入力した内容は保存も送信もされません。'],
        ['>Open the builder</a>', '>ビルダーを開く</a>'],
        ['>Run it locally</a>', '>ローカルで実行する</a>'],
        ['aria-label="One policy clause passing through Komainu"', 'aria-label="1 つのポリシー条項が Komainu を通る流れ"'],
        ['<span>One policy clause through Komainu · balanced strictness</span>', '<span>1 つのポリシー条項が Komainu を通る流れ · 厳格さ: 標準</span>'],
        ['aria-label="How the rule is upheld"', 'aria-label="ルールが守られる方法"'],
        ['aria-pressed="true">enforced</button>', 'aria-pressed="true">強制</button>'],
        ['aria-pressed="false">instructed</button>', 'aria-pressed="false">指示</button>'],
        ['aria-pressed="false">attested</button>', 'aria-pressed="false">宣誓</button>'],
        ['<span>1 · Your policy</span><span class="where">Your documents</span>', '<span>1 · 自社のポリシー</span><span class="where">自社の文書</span>'],
        ['<span>2 · Rule chosen</span><span class="where">This browser tab</span>', '<span>2 · 選んだルール</span><span class="where">このブラウザータブ</span>'],
        ['<span>3 · Installed</span><span class="where">Your machine</span>', '<span>3 · 導入</span><span class="where">自分の端末</span>'],
        ['<span>4 · In a session</span><span class="where">Hosted assistant</span>', '<span>4 · セッション中</span><span class="where">ホスト型アシスタント</span>'],
        ['data-enforced="Enforced rules are checked by a local hook or permission rule before anything reaches the model. With the default configuration, 6 of 35 rules are enforced."', 'data-enforced="強制ルールは、モデルに届く前に、ローカルのフックまたは権限ルールが確認します。既定の設定では、35 件のうち 6 件が強制ルールです。"'],
        ['data-instructed="Instructed rules are loaded into the assistant at the start of every session. It follows them, and nothing checks that it did."', 'data-instructed="指示ルールは、セッションの開始時にアシスタントへ読み込まれます。アシスタントは従いますが、従ったことを確認する仕組みはありません。"'],
        ['data-attested="Attested rules are organizational processes. The generated policy lists each one with a line for the person who confirms it."', 'data-attested="宣誓ルールは組織のプロセスです。生成されるポリシーには、確認する担当者の記入欄とともに 1 件ずつ記載されます。"'],

        ['<h2>How Komainu gets a written policy into daily use</h2>', '<h2>文書のポリシーを日々の業務に届ける方法</h2>'],
        ['An AI policy that sits in a document does not change what an assistant does. Komainu turns the policy into rules the assistant loads, and checks locally what can be checked.', '文書の中にあるだけの AI ポリシーは、アシスタントの動作を変えません。Komainu はポリシーをアシスタントが読み込むルールに変え、確認できるものはローカルで確認します。'],
        ['<h3>Runs locally</h3><p>The builder runs in your browser tab and the installer runs on your machine. Komainu has no service of its own.</p>', '<h3>ローカルで動く</h3><p>ビルダーはブラウザーのタブで、インストーラーは自分の端末で動きます。Komainu 自身のサービスはありません。</p>'],
        ['<h3>Stores nothing</h3><p>The site is static files. It has no database, no account and no form endpoint, and it uses no cookies or browser storage.</p>', '<h3>何も保存しない</h3><p>サイトは静的ファイルです。データベースも、アカウントも、フォームの送信先もなく、Cookie もブラウザーのストレージも使いません。</p>'],
        ['<h3>Labels every rule</h3><p>Each rule is marked enforced, instructed or attested, so an instruction is never mistaken for a technical control.</p>', '<h3>すべてのルールに区分を付ける</h3><p>各ルールには「強制」「指示」「宣誓」のいずれかが付くため、指示が技術的な統制と取り違えられることはありません。</p>'],
        ['<h3>Documents its limits</h3><p>Most rules depend on the assistant following instructions. The <a href="#limits">limits section</a> lists what Komainu does not do.</p>', '<h3>制限を明記する</h3><p>ほとんどのルールは、アシスタントが指示に従うことを前提にしています。Komainu が行わないことは<a href="#limits">制限事項</a>にまとめています。</p>'],

        ['<h2>Four steps from policy to installed guardrails</h2>', '<h2>ポリシーからガードレールの導入まで 4 ステップ</h2>'],
        ['The <a href="builder.html">builder</a>, the CLI, the MCP server and the agent skill all use the same rule catalog and write the same files.', '<a href="builder.html">ビルダー</a>、CLI、MCP サーバー、エージェントスキルは、すべて同じルールカタログを使い、同じファイルを書き出します。'],
        ['<h3>Choose</h3><p>Start from a template and pick the teams that use AI. Switch rules on and off, and set how strict to be.</p><div class="out">__AREAS__ areas → <b>__RULES__ rules</b></div>', '<h3>選ぶ</h3><p>テンプレートから始めて、AI を使うチームを選びます。ルールのオンとオフを切り替え、厳格さを決めます。</p><div class="out">__AREAS__ 領域 → <b>__RULES__ ルール</b></div>'],
        ['<h3>Add your own</h3><p>Download a policy template, edit it in a spreadsheet and import it. Or let the agent skill map your policy documents clause by clause.</p><div class="out">rules.csv → <b>your rules</b></div>', '<h3>独自のルールを加える</h3><p>ポリシーテンプレートをダウンロードし、表計算ソフトで編集してインポートします。または、エージェントスキルにポリシー文書を条項ごとに対応付けさせます。</p><div class="out">rules.csv → <b>独自のルール</b></div>'],
        ['<h3>Copy one command</h3><p>Your choices are encoded in the command itself. An offline installer and a prompt for your coding agent are also offered.</p>', '<h3>コマンドを 1 つコピーする</h3><p>選んだ内容はコマンドそのものに含まれています。オフラインインストーラーと、コーディングエージェント用のプロンプトも用意されます。</p>'],
        ['<h3>Install locally</h3><p>The command writes the rule files each assistant reads, a local enforcement hook and a policy document for people.</p>', '<h3>ローカルに導入する</h3><p>コマンドは、各アシスタントが読むルールファイル、ローカルの強制フック、人が読むためのポリシー文書を書き出します。</p>'],

        ['<h2>What Komainu includes</h2>', '<h2>Komainu に含まれるもの</h2>'],
        ['Komainu covers engineering teams, other departments, leadership, IT administrators and the people who audit them.', 'Komainu は、エンジニアリングチーム、その他の部門、経営層、IT 管理者、そして監査を行う人までを対象にしています。'],
        ['<h3>Full-width editor</h3><p>Areas on the left, the rules you are editing in the middle, and the command and generated files on the right. All three update as you edit.</p>', '<h3>全幅のエディター</h3><p>左に領域、中央に編集中のルール、右にコマンドと生成されるファイル。編集するたびに 3 つすべてが更新されます。</p>'],
        ['<h3>Your own rules</h3><p>Import rules from CSV or JSON. Common column names, separators and area names are recognized, and you see a preview before anything is added.</p>', '<h3>独自のルール</h3><p>CSV または JSON からルールをインポートできます。一般的な列名、区切り文字、領域名を認識し、追加する前にプレビューを表示します。</p>'],
        ['<h3>Local enforcement hook</h3><p>A Claude Code hook that blocks credentials, card numbers, your sensitive names, reads of secret files and dangerous commands before they leave the machine.</p>', '<h3>ローカルの強制フック</h3><p>認証情報、カード番号、機密名称、秘密ファイルの読み取り、危険なコマンドを、端末から出る前にブロックする Claude Code のフックです。</p>'],
        ['<h3>One source, every assistant</h3><p>The same rules are written for Claude Code, Cursor, GitHub Copilot, Gemini CLI and Windsurf. Existing files are merged.</p>', '<h3>1 つの定義をすべてのアシスタントへ</h3><p>同じルールを Claude Code、Cursor、GitHub Copilot、Gemini CLI、Windsurf 向けに書き出します。既存のファイルにはマージします。</p>'],
        ['<h3>Department packs</h3><p>One paste-in block per department for teams that use a chat assistant and never open a repository: HR, sales, marketing, support, legal and finance.</p>', '<h3>部門別パック</h3><p>リポジトリを開くことのない、チャットアシスタントを使うチームのために、部門ごとに貼り付け用のブロックを用意します: 人事、営業、マーケティング、サポート、法務、財務。</p>'],
        ['<h3>Policy for people</h3><p>A human-readable policy generated from the same configuration, with framework references and a checklist of the rules a person has to confirm.</p>', '<h3>人が読むためのポリシー</h3><p>同じ設定から生成される、人が読めるポリシーです。フレームワークへの参照と、人が確認する必要のあるルールのチェックリストが付きます。</p>'],
        ['<h3>Drift check</h3><p>Compares the installed files with <code>komainu.json</code> and exits with an error when they differ. Made for CI.</p>', '<h3>ずれの検出</h3><p>導入済みのファイルを <code>komainu.json</code> と比較し、違いがあればエラーで終了します。CI での利用を想定しています。</p>'],
        ['<h3>Leak scan</h3><p>Scans files, staged changes or standard input for credentials, personal data and your sensitive names. <code>komainu redact</code> replaces them with placeholders.</p>', '<h3>漏えいスキャン</h3><p>ファイル、ステージ済みの変更、標準入力を対象に、認証情報、個人データ、機密名称を検出します。<code>komainu redact</code> はそれらをプレースホルダーに置き換えます。</p>'],
        ['<h3>MCP server</h3><p>Six read-only tools for any MCP client: list the rules in force, check or redact text, decide where classified data may go, and preview a configuration.</p>', '<h3>MCP サーバー</h3><p>どの MCP クライアントでも使える、読み取り専用の 6 つのツールです: 有効なルールの一覧、テキストの検査と伏せ字化、分類されたデータの送り先の判断、設定のプレビュー。</p>'],
        ['<h3>Agent skill</h3><p>Teaches a coding agent to read your policy documents locally, map each clause to a rule, and report the gaps before it installs anything.</p>', '<h3>エージェントスキル</h3><p>コーディングエージェントに、ポリシー文書をローカルで読み、各条項をルールに対応付け、導入の前に不足を報告する手順を教えます。</p>'],
        ['<h3>Policy templates</h3><p>Download the rules for a role or an area as a CSV file, edit them in a spreadsheet and import the file. There are __PRESETS__ role templates and one for each area. <a href="templates.html">Browse the templates</a>.</p>', '<h3>ポリシーテンプレート</h3><p>役割または領域ごとのルールを CSV ファイルでダウンロードし、表計算ソフトで編集してインポートできます。役割テンプレートが __PRESETS__ 種類と、領域ごとのテンプレートがあります。<a href="templates.html">テンプレートを見る</a>。</p>'],
        ['<h3>Training quiz</h3><p>A quiz made from the rules you selected, as one HTML file to share with your team. Or send a link that opens the quiz directly. People answer, see the reason behind each answer, and nothing is recorded.</p>', '<h3>研修クイズ</h3><p>選んだルールから作るクイズを、チームに共有できる 1 つの HTML ファイルとして書き出します。クイズを直接開くリンクを送ることもできます。回答すると各問の理由が表示され、何も記録されません。</p>'],

        ['<p class="kicker">Coverage</p>', '<p class="kicker">対象範囲</p>'],
        ['<h2>What it covers</h2>', '<h2>対象とする範囲</h2>'],
        ['__RULES__ rules in __AREAS__ areas. The universal rules always apply; each other area is switched on per organization.', '__AREAS__ 領域に __RULES__ 件のルール。共通ルールは常に適用され、その他の領域は組織ごとにオンにします。'],
        ['<li>UNIVERSAL</li><li>CODING</li><li>SECURITY</li><li>DATA &amp; PRIVACY</li><li>AGENTS</li><li>COMMUNICATION</li><li>HR</li><li>SALES</li><li>MARKETING</li><li>SUPPORT</li><li>LEGAL</li><li>FINANCE</li><li>GOVERNANCE</li><li>AI PRODUCT TEAMS</li><li>IT CONTROLS</li><li>PUBLIC SERVICES</li><li>HEALTH</li><li>EDUCATION</li>', '<li>共通</li><li>コーディング</li><li>セキュリティ</li><li>データとプライバシー</li><li>エージェント</li><li>コミュニケーション</li><li>人事</li><li>営業</li><li>マーケティング</li><li>サポート</li><li>法務</li><li>財務</li><li>ガバナンス</li><li>AI プロダクトチーム</li><li>IT 統制</li><li>公共サービス</li><li>医療・介護</li><li>教育</li>'],
        ['Framework references are pointers for reviewers and are not a statement of compliance. The generated policy is a starting point and is not legal advice.', 'フレームワークへの参照はレビュー担当者のための手がかりであり、準拠を表明するものではありません。生成されるポリシーは出発点であり、法的助言ではありません。'],
        ['<p class="kicker">Strictness</p>', '<p class="kicker">厳格さ</p>'],
        ['<h2>Strictness levels</h2>', '<h2>厳格さのレベル</h2>'],
        ['The level decides which rules are on by default and what the hook does.', 'レベルによって、既定でオンになるルールとフックの動作が決まります。'],
        ['<span>__N_STRICT__ rules</span>', '<span>__N_STRICT__ ルール</span>'],
        ['<span>__N_BALANCED__ rules · default</span>', '<span>__N_BALANCED__ ルール · 既定</span>'],
        ['<span>__N_ADVISORY__ rules</span>', '<span>__N_ADVISORY__ ルール</span>'],
        ['Every rule is on. The hook blocks. For regulated and high-risk environments.', 'すべてのルールがオン。フックはブロックします。規制業種や高リスク環境向け。'],
        ['The essentials and good practice. The hook blocks clear violations.', '必須事項と良い慣行。フックは明確な違反をブロックします。'],
        ['The essentials only. The hook asks for confirmation and does not block.', '必須事項のみ。フックは確認を求め、ブロックはしません。'],

        ['<h2>Use it from the browser, the terminal or your agent</h2>', '<h2>ブラウザー、ターミナル、エージェントから使う</h2>'],
        ['All five paths use the same catalog and write the same files. The CLI is one JavaScript file with no dependencies, and it makes no network requests.', '5 つの方法はすべて同じカタログを使い、同じファイルを書き出します。CLI は依存関係のない 1 つの JavaScript ファイルで、ネットワークリクエストは行いません。'],
        [`Read komainu.mjs ${ARROW}`, `komainu.mjs を読む ${ARROW}`],
        [`Checksums ${ARROW}`, `チェックサム ${ARROW}`],
        [`<a class="link" href="komainu-standalone.html" download>Offline builder ${ARROW}`, `<a class="link" href="../komainu-standalone-ja.html" download>オフラインビルダー ${ARROW}`],
        ['aria-label="Ways to use Komainu"', 'aria-label="Komainu の使い方"'],
        ['# 1. build your configuration in the browser: {{BASE}}/builder.html', '# 1. ブラウザーで設定を作る: {{BASE}}/ja/builder.html'],
        ['# 2. copy the command it gives you and run it in your repository', '# 2. 表示されたコマンドをコピーして、リポジトリで実行する'],
        ['# preview without writing', '# 書き込まずに確認する'],
        ['# do the installed files still match?', '# 導入済みのファイルは今も一致しているか'],
        ['# one file, no dependencies, needs Node.js 18 or newer', '# 1 ファイル、依存関係なし、Node.js 18 以上が必要'],
        ['# the wizard: answer a few questions', '# ウィザード: いくつかの質問に答える'],
        ['# write the files from ./komainu.json', '# ./komainu.json からファイルを書き出す'],
        ['# exit 1 when files drift (use in CI)', '# ファイルがずれていたら exit 1 (CI 向け)'],
        ['# scan staged files (use as pre-commit)', '# ステージ済みファイルを検査 (pre-commit 向け)'],
        ['# a training quiz on your rules', '# ルールの研修クイズ'],
        ['# start from a template: the rules for a role or an area, as CSV', '# テンプレートから始める: 役割または領域のルールを CSV で'],
        ['# edit it, then import it', '# 編集してからインポートする'],
        ['# or write your own file: only the "rule" column is required', '# または独自のファイルを書く: 必須なのは "rule" 列だけ'],
        ['<span class="c"># then</span>', '<span class="c"># その後</span>'],
        ['# any MCP client (.mcp.json)', '# 任意の MCP クライアント (.mcp.json)'],
        ['# tools: guardrails_list', '# ツール: guardrails_list'],
        ['# read-only, stdio, speaks MCP 2026-07-28 and the earlier handshake', '# 読み取り専用、stdio、MCP 2026-07-28 と以前のハンドシェイクに対応'],
        ['# install the skill for your coding agent', '# コーディングエージェントにスキルを導入する'],
        ['# .agents/skills/ for other agents', '# 他のエージェント向けは .agents/skills/'],
        ['# or without Node.js', '# Node.js を使わない場合'],
        ['# then ask your agent:', '# その後、エージェントに依頼する:'],
        ['# "Build AI guardrails for our organization from our internal policies."', '# 「社内ポリシーをもとに、当社の AI ガードレールを作成してください。」'],

        ['<h2>What stays on your machine and what is sent</h2>', '<h2>端末に残るものと、送信されるもの</h2>'],
        ['<h3>Stays on your machine</h3>', '<h3>端末に残るもの</h3>'],
        ['<span>Everything you enter in the builder; the page cannot make network requests</span>', '<span>ビルダーに入力したすべての内容。このページはネットワークリクエストを送れません</span>'],
        ['<span>Your policy documents and the rules files you import</span>', '<span>ポリシー文書と、インポートするルールファイル</span>'],
        ['<span>Your sensitive names, which are kept out of every instruction file</span>', '<span>機密名称。どの指示ファイルにも書き込まれません</span>'],
        ['<span>What the hook blocks: credentials, card numbers and flagged commands</span>', '<span>フックがブロックするもの: 認証情報、カード番号、警告対象のコマンド</span>'],
        ['<h3>Sent to your AI provider</h3>', '<h3>AI プロバイダーに送信されるもの</h3>'],
        ['<span>The rule text in your instruction files, when your assistant loads them</span>', '<span>指示ファイルにあるルールの文言 (アシスタントが読み込むとき)</span>'],
        ["<span>Your organization's name and contact role, if you entered them</span>", '<span>組織の名称と担当の役割 (入力した場合)</span>'],
        ['<span>Komainu itself sends nothing, to your provider or to anyone else</span>', '<span>Komainu 自身は、プロバイダーにも他の誰にも、何も送信しません</span>'],

        ['<p class="kicker">In numbers</p>', '<p class="kicker">数字で見る</p>'],
        ['<h2>What is in the catalog</h2>', '<h2>カタログの内容</h2>'],
        ["The counts come from the catalog in this build. Rule wording is Komainu's own and has not been reviewed by a regulator or a standards body.", '数値はこのビルドのカタログから取得しています。ルールの文言は Komainu 独自のもので、規制当局や標準化団体の審査は受けていません。'],
        ['<span>rules, each marked must or should</span>', '<span>件のルール。それぞれ「必須」または「推奨」</span>'],
        ['<span>areas, from coding to governance</span>', '<span>領域。コーディングからガバナンスまで</span>'],
        ['<span>install targets across assistants and documents</span>', '<span>種類の導入先。アシスタントと文書</span>'],
        ['<span>network requests this page is allowed to make</span>', '<span>このページに許可されたネットワークリクエストの数</span>'],

        ['<h2>Known limits</h2>', '<h2>既知の制限</h2>'],
        ['Read these before relying on Komainu.', 'Komainu に頼る前にお読みください。'],
        ['<li>Most rules are instructed. An assistant that is told a rule usually follows it, and nothing checks that it did.</li>', '<li>ほとんどのルールは「指示」です。ルールを伝えられたアシスタントは通常それに従いますが、従ったことを確認する仕組みはありません。</li>'],
        ['<li>The enforcement hook works in Claude Code only. Other assistants receive the rules as instructions.</li>', '<li>強制フックが動作するのは Claude Code だけです。他のアシスタントはルールを指示として受け取ります。</li>'],
        ['<li>Detection is pattern-based. It catches common credential, card and bank-account formats and will miss others. For names and other personal data in prompts, use <a href="https://veil.spinetta.tech/">Veil</a>, our Python library that replaces them with tokens before the text leaves your machine.</li>', '<li>検出はパターンに基づきます。一般的な認証情報、カード、銀行口座の形式は検出しますが、それ以外は見逃します。プロンプト内の氏名やその他の個人データには、テキストが端末を出る前にトークンへ置き換える当社の Python ライブラリ <a href="https://veil.spinetta.tech/">Veil</a> を使ってください。</li>'],
        ['<li>Komainu is not a runtime filter for an AI product you ship. Pair it with one if you build AI applications. <a href="https://veil.spinetta.tech/">Veil</a> is the one we make for personal data.</li>', '<li>Komainu は、提供する AI プロダクトのための実行時フィルターではありません。AI アプリケーションを開発する場合は、実行時フィルターと組み合わせてください。個人データ向けには当社の <a href="https://veil.spinetta.tech/">Veil</a> があります。</li>'],
        ['<li>The generated policy is a starting point and is not legal advice. Have it reviewed by your legal, security and privacy owners.</li>', '<li>生成されるポリシーは出発点であり、法的助言ではありません。法務、セキュリティ、プライバシーの担当者によるレビューを受けてください。</li>'],
        ['<li>Sensitive names are stored in <code>komainu.json</code> and in the hook. Do not list a name there if the repository is shared with people who must not see it.</li>', '<li>機密名称は <code>komainu.json</code> とフックに保存されます。見せてはならない人とリポジトリを共有している場合は、そこに名称を登録しないでください。</li>'],

        ['<h2>Build guardrails from your own policy</h2>', '<h2>自社のポリシーからガードレールを作る</h2>'],
        ['Komainu makes a policy harder to ignore but does not make it impossible to break. Read the <a href="#limits">limits</a> before you rely on it.', 'Komainu はポリシーを無視しにくくしますが、破ることを不可能にするわけではありません。頼る前に<a href="#limits">制限事項</a>をお読みください。']
    ],

    'builder.html': [
        ['<title>Komainu builder: edit your AI guardrails</title>', '<title>Komainu ビルダー: AI ガードレールを編集する</title>'],
        ['content="The Komainu guardrails editor. Choose areas, review rules, import your own, and copy one command. Nothing is stored or sent."', 'content="Komainu のガードレールエディター。領域を選び、ルールを確認し、独自のルールをインポートして、コマンドを 1 つコピーします。何も保存せず、何も送信しません。"'],
        ['<span class="crumb">builder</span>', '<span class="crumb">ビルダー</span>'],
        ['title="This page has no backend, makes no requests and uses no browser storage.">nothing stored · nothing sent</span>', 'title="このページにはバックエンドがなく、リクエストを送らず、ブラウザーのストレージも使いません。">保存なし · 送信なし</span>'],
        ['data-online>templates</a>', 'data-online>テンプレート</a>'],
        ['>Copy command</button>', '>コマンドをコピー</button>'],
        ['aria-label="Sections"', 'aria-label="セクション"'],
        ['<aside class="out" aria-label="Output">', '<aside class="out" aria-label="出力">'],
        ['role="tablist" aria-label="Output"', 'role="tablist" aria-label="出力の種類"'],
        ['>command</button>', '>コマンド</button>'],
        ['>offline script</button>', '>オフラインスクリプト</button>'],
        ['>ai agent</button>', '>AI エージェント</button>'],
        ['>files</button>', '>ファイル</button>'],
        ['>quiz</button>', '>クイズ</button>'],
        ['>share</button>', '>共有</button>']
    ],

    'templates.html': [
        ['<title>Komainu policy templates: AI rules by role and area</title>', '<title>Komainu ポリシーテンプレート: 役割別・領域別の AI ルール</title>'],
        ['content="Browse Komainu\'s AI policy templates by role and by area, read every rule, and download each one as a CSV file to edit and import."', 'content="Komainu の AI ポリシーテンプレートを役割別・領域別に見て、すべてのルールを読み、CSV ファイルでダウンロードして編集・インポートできます。"'],
        ['Policy templates · __PRESETS__ roles · __AREAS__ areas', 'ポリシーテンプレート · __PRESETS__ 役割 · __AREAS__ 領域'],
        ['<h1>Policy templates for every role</h1>', '<h1>あらゆる役割のためのポリシーテンプレート</h1>'],
        ['<strong>Each template is a list of AI rules for one role or one area.</strong> Read the rules here, download them as a CSV file, edit the file in a spreadsheet and import it into the builder. The files are made in this tab and nothing is uploaded.', '<strong>各テンプレートは、1 つの役割または 1 つの領域のための AI ルールの一覧です。</strong>ここでルールを読み、CSV ファイルでダウンロードし、表計算ソフトで編集して、ビルダーにインポートします。ファイルはこのタブの中で作られ、何もアップロードされません。'],
        ['<p class="kicker">Edit and import</p>', '<p class="kicker">編集とインポート</p>'],
        ['<h2>What happens to each row when you import the file</h2>', '<h2>ファイルをインポートすると各行はどうなるか</h2>'],
        ['Open the file in any spreadsheet. Keep the <code>id</code> column as it is so Komainu can match each row to its rule.', 'ファイルは任意の表計算ソフトで開けます。Komainu が各行をルールに対応付けられるよう、<code>id</code> 列はそのままにしてください。'],
        ['<h3>Leave a row alone</h3><p>The catalog rule stays on, with its coverage label.</p>', '<h3>行をそのままにする</h3><p>カタログのルールが、区分のラベルとともにオンのまま残ります。</p>'],
        ['<h3>Change a row</h3><p>Your wording, level or area replaces the catalog rule and is listed under your rules.</p>', '<h3>行を変更する</h3><p>変更した文言、レベル、領域がカタログのルールを置き換え、独自のルールとして一覧に入ります。</p>'],
        ['<h3>Delete a row</h3><p>The catalog rule is switched off.</p>', '<h3>行を削除する</h3><p>カタログのルールがオフになります。</p>'],
        ['<h3>Add a row</h3><p>A row with an empty <code>id</code> becomes a rule of your own. Use <code>source</code> for the clause it comes from.</p>', '<h3>行を追加する</h3><p><code>id</code> が空の行は独自のルールになります。<code>source</code> には根拠となる条項を記入します。</p>']
    ],

    'quiz.html': [
        ['<title>AI guardrails quiz</title>', '<title>AI ガードレールクイズ</title>'],
        ['content="A training quiz on your organization\'s AI guardrails. The questions come from the link you opened, and nothing you answer is recorded or sent."', 'content="組織の AI ガードレールに関する研修クイズ。問題は開いたリンクから作られ、回答は記録も送信もされません。"'],
        ['id="quiz-kicker">Training quiz</p>', 'id="quiz-kicker">研修クイズ</p>'],
        ['id="quiz-title">AI guardrails quiz</h1>', 'id="quiz-title">AI ガードレールクイズ</h1>'],
        ['Loading the questions from the link.', 'リンクから問題を読み込んでいます。'],
        ['>Check my answers</button>', '>答え合わせをする</button>'],
        ['>Start again</button>', '>最初からやり直す</button>'],
        ['Your answers stay in this page. Nothing is recorded or sent.', '回答はこのページの中にとどまります。記録も送信もされません。']
    ]
};

/** The English page → the Japanese page. Throws when a fragment is missing, so the two cannot drift apart unnoticed. */
export function toJapanese(name, html) {
    let out = html;
    for (const [en, ja] of PAGES[name]) {
        if (!out.includes(en)) throw new Error(`ja/${name}: the English page no longer contains: ${en.slice(0, 90)}`);
        out = out.replaceAll(en, ja);
    }
    for (const [en, ja] of COMMON) out = out.replaceAll(en, ja);
    return out
        // the language switch and the alternate link point back at the English page
        .replace(/<a([^>]*) href="ja\/([a-z]+\.html)" lang="ja" hreflang="ja"([^>]*)>日本語<\/a>/g, '<a$1 href="../$2" lang="en" hreflang="en"$3>English</a>')
        .replace(/<link rel="alternate" hreflang="ja" href="ja\/([a-z]+\.html)">/g, '<link rel="alternate" hreflang="en" href="../$1">')
        // files that live at the site root
        .replace(/(href|src)="(assets\/|fonts\/|komainu\.mjs|SHA256SUMS)/g, '$1="../$2');
}
