# 調査レポート: Claude Code 自走モード / ハーネスエンジニアリング / 高インパクト事例

調査日: 2026-04-06  
調査者: Researcher エージェント

---

## 1. Claude Code の「自走モード」（許可スキップ）の仕組み

### 1-1. パーミッションモード一覧

Claude Code には **6 つのパーミッションモード**があり、右に行くほど自律度が上がります。

| モード | UI 表示名 | 許可なしで実行できること | 推奨シーン |
|--------|-----------|------------------------|-----------|
| `default` | Ask before edits | 読み取りのみ | 初めて使うとき、機密作業 |
| `acceptEdits` | Edit automatically | 読み取り＋ファイル編集 | コードレビューしながら反復 |
| `plan` | Plan mode | 読み取りのみ（計画だけ立てる） | コード探索・方針検討 |
| `auto` | Auto mode | **全操作**（安全分類器による背景チェックあり） | 長時間タスク、許可疲れ防止 |
| `dontAsk` | — | 事前許可済みツールのみ | CI/CD パイプライン |
| `bypassPermissions` | Bypass permissions | **全操作**（安全チェックなし） | 隔離コンテナ・VM 限定 |

### 1-2. デスクトップアプリでの設定方法

**デスクトップアプリ（Claude Code Desktop）の場合:**
- 送信ボタン横の **モードセレクター** をクリックして切り替え可能
- Auto モードと Bypass permissions は、**Desktop の設定画面で事前に有効化**しないと選択肢に表示されない

**VS Code 拡張の場合:**
- プロンプトボックス下部の **モードインジケーター** をクリック
- `claudeCode.initialPermissionMode` で起動時のデフォルトを設定可能
- 「Allow dangerously skip permissions」トグルを有効にすると Auto / Bypass が選択肢に追加

**CLI（ターミナル）の場合:**
- `Shift+Tab` で `default` → `acceptEdits` → `plan` を巡回
- `claude --permission-mode auto` / `claude --permission-mode acceptEdits` で起動
- `claude --dangerously-skip-permissions` = `bypassPermissions` モードと同等

### 1-3. `--dangerously-skip-permissions` について

- **ターミナル（CLI）専用のフラグ**です。デスクトップアプリでは直接このフラグを使うのではなく、設定画面で「Bypass permissions」を有効化してモードセレクターから選択します
- このフラグは安全チェックを**完全に無効化**するため、Anthropic はコンテナや VM など隔離環境のみでの使用を推奨しています
- より安全な代替として **Auto モード** が 2025 年後半に導入されました

### 1-4. 許可を個別に「Always allow」に設定する方法

`settings.json` の `permissions.allow` 配列にツールパターンを追加します。

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Edit",
      "Write",
      "Glob",
      "Grep",
      "Bash(git *)",
      "Bash(npm test)",
      "Bash(ls *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(sudo *)"
    ]
  }
}
```

- `settings.json` の場所: `~/.claude/settings.json`（ユーザー全体）
- プロジェクト単位: `.claude/settings.json`（リポジトリルート）
- セッション中に `/permissions` コマンドで確認・追加も可能

### 1-5. Auto モード（推奨の「自走モード」）の詳細

**仕組み:**
1. Claude Sonnet 4.6 ベースの**分類器（Classifier）**が、各操作の実行前にリスクを評価
2. 安全な操作は自動承認、危険な操作はブロック
3. ユーザーメッセージとツール呼び出しのみを分類器に渡し、ツール結果は除外（プロンプトインジェクション対策）

**2段階評価:**
- **Stage 1:** 高速な Yes/No フィルター（安全側に寄せる）
- **Stage 2:** 思考連鎖（Chain-of-Thought）による詳細判断（フラグされたものだけ）

**デフォルトでブロックされる操作:**
- `curl | bash` のような外部コード実行
- 機密データの外部送信
- 本番デプロイ・マイグレーション
- 大量ファイル削除
- IAM / リポジトリ権限の変更
- `main` への force push

**デフォルトで許可される操作:**
- 作業ディレクトリ内のファイル操作
- ロックファイルに宣言された依存関係のインストール
- 読み取り専用 HTTP リクエスト
- 現在のブランチへのプッシュ

**利用条件（重要）:**
- プラン: Team、Enterprise、または API（Pro/Max では利用不可）
- モデル: Claude Sonnet 4.6 または Opus 4.6
- プロバイダ: Anthropic API のみ（Bedrock/Vertex/Foundry は不可）
- 管理者が事前に有効化している必要がある

### 1-6. 初心者への推奨設定

**最も安全かつ効果的な段階的アプローチ:**

1. **まず `acceptEdits` モード**（推奨度: 最高）
   - ファイル編集は自動承認、コマンド実行は都度確認
   - 初心者でも安心。`git diff` で事後確認可能
   - `Shift+Tab` 1回で切り替え

2. **慣れたら `auto` モード**（推奨度: 高、ただし条件あり）
   - 安全分類器が危険操作を自動ブロック
   - 長時間タスクの自走に最適
   - Team/Enterprise プランが必要

3. **`settings.json` で安全なツールを事前許可**
   - `Read`, `Edit`, `Write`, `Glob`, `Grep` を allow に追加
   - `Bash(rm -rf *)`, `Bash(sudo *)` を deny に追加
   - これだけで許可ダイアログが大幅に減る

信頼度: **高**（公式ドキュメントおよび Anthropic エンジニアリングブログに基づく）

---

## 2. ハーネスエンジニアリングとは

### 2-1. 「ハーネス」の正確な定義

> **ハーネス（Harness）とは、AI エージェントそのものではなく、エージェントの動作を制御するインフラ全体のこと。**
> ツールへのアクセス権、安全のためのガードレール、自己修正のためのフィードバックループ、人間が行動を監視するための可観測性レイヤーを含む。

公式的な定式: **コーディングエージェント ＝ AI モデル ＋ ハーネス**

Mitchell Hashimoto（HashiCorp 創業者）の定義:
> 「エージェントがミスをするたびに、そのミスを二度と繰り返さないような仕組みをエンジニアリングすること」

### 2-2. Claude Code におけるハーネスの構成要素

| 構成要素 | 役割 | 具体例 |
|---------|------|--------|
| **CLAUDE.md** | プロジェクト固有のコンテキストと指示 | コーディング規約、使用言語、テスト手順の記述 |
| **settings.json** | 決定論的な動作の強制 | パーミッション（allow/deny）、デフォルトモード、モデル選択 |
| **Hooks** | エージェントライフサイクルの各ポイントで自動実行されるスクリプト | `PreToolUse` でセキュリティスキャン、`PostToolUse` でリント実行 |
| **Permission settings** | 操作の許可/拒否/確認のルール | `allow: ["Bash(git *)"]`, `deny: ["Bash(rm -rf *)"]` |
| **Sub-agents** | タスクの分離とコンテキスト管理 | レビュー担当、テスト担当などの役割分担 |
| **Skills** | 必要に応じて知識とツールを段階的に開示 | ドキュメント処理スキル、請求書整理スキル |
| **MCP サーバー** | 外部ツール・サービスとの接続 | Slack、GitHub、CRM との連携 |

### 2-3. 初心者向けの一言説明

> **「ハーネスエンジニアリング」とは、AI エージェントに"手綱"をつけて、安全に・正確に・自分好みに動いてもらうための設定づくりのこと。**

もう少し詳しく言うと:
> 「馬に乗るとき、手綱（ハーネス）があるから安全にコントロールできる。AI エージェントも同じで、CLAUDE.md で"何をすべきか"を教え、settings.json で"何をしていいか"を決め、hooks で"いつチェックするか"を仕込む。この仕組みづくり全体がハーネスエンジニアリング。」

### 2-4. プロンプトエンジニアリングとの違い

| 観点 | プロンプトエンジニアリング | ハーネスエンジニアリング |
|------|------------------------|----------------------|
| **対象** | 1 回の入力（プロンプト） | エージェントを取り巻くシステム全体 |
| **範囲** | 「何を聞くか」の最適化 | ツール管理、状態管理、エラー回復、権限制御、可観測性 |
| **比喩** | 「右に曲がれ」という指示 | 道路、ガードレール、標識、信号システム全体 |
| **持続性** | 1 セッション内 | セッションをまたいで永続 |
| **決定論性** | 確率的（モデル依存） | 決定論的（設定ファイルで強制） |

> プロンプトエンジニアリングはハーネスエンジニアリングの**一部**であり、ハーネスエンジニアリングは「コンテキストエンジニアリング」の一部である。

信頼度: **高**（HumanLayer ブログ、NxCode ガイド、Anthropic 公式ドキュメントに基づく）

---

## 3. 初心者でも最大限効果が出る高インパクト事例（7 選）

### 事例 1: 請求書 PDF の一括読み取り → 月次レポート自動生成

**内容:** フォルダ内の請求書 PDF 50 枚を全て読み取り、取引先・金額・日付を抽出して月次サマリーレポートを自動生成  
**効果:** 月 40 時間 → 月 5 時間（87% 削減）。転記ミスほぼゼロ  
**指示例:** 「/invoices フォルダ内の PDF を全て読んで、取引先名・金額・日付を CSV に抽出し、月次集計レポートを Excel で作成して」  
**対象:** 経理・総務  
**信頼度:** 高（[Uravation 事例記事](https://uravation.com/media/claude-code-automation-case-studies-2026/)）

### 事例 2: 請求書と発注データの突合チェック

**内容:** 請求書 PDF と発注データ CSV を突き合わせ、金額・数量・品目の不一致を自動検出してリスト化  
**効果:** 目視チェック 2〜3 時間 → 5 分。人的ミスによる見落としを大幅削減  
**指示例:** 「請求書 PDF と発注 CSV を照合して、金額・数量・品目の一致を確認し、差異がある項目を一覧にして」  
**対象:** 経理・購買  
**信頼度:** 高（[StartLink 事例記事](https://start-link.jp/hubspot-ai/ai/claude-code-practice/claude-code-non-engineer-use-cases)）

### 事例 3: 過去の会議メモ横断分析 → 未完了タスク洗い出し

**内容:** 過去 10 本の会議議事録を横断的に分析し、担当者ごとの未完了タスク・期限切れ項目を一覧化  
**効果:** 手作業で 1〜2 時間 → 2〜3 分。「誰が何を約束したか」の追跡漏れを防止  
**指示例:** 「/meeting-notes フォルダの議事録を全て読んで、担当者ごとのアクションアイテムを抽出し、完了/未完了を判定して一覧表にして」  
**対象:** 管理部門・プロジェクト管理  
**信頼度:** 中〜高（複数の実践記事に基づく推定）

### 事例 4: 週次レポートの完全自動生成

**内容:** 各部署の CSV データを自動取得し、前週比較・経営サマリーを Word 形式で自動生成、メール配信まで自動化  
**効果:** 週 3 時間 → 週 10 分（94% 削減）。土日の手動作業が不要に  
**指示例:** 「/data フォルダの各部署 CSV を読み込んで、前週比の増減を計算し、経営サマリーをレポート形式でまとめて」  
**対象:** 管理部門・経営企画  
**信頼度:** 高（[Uravation 事例記事](https://uravation.com/media/claude-code-automation-case-studies-2026/)）

### 事例 5: 顧客リスト × テンプレートでの個別メール一括生成

**内容:** 顧客リスト CSV の各行を読み込み、メールテンプレートに会社名・担当者名・提案内容を差し込んで個別メールドラフトを一括生成  
**効果:** 1 通 6 分 → 1 通 45 秒（87% 削減）。50 通で 5 時間 → 40 分  
**指示例:** 「顧客リスト.csv を読んで、メールテンプレート.txt の{会社名}{担当者名}を各行のデータで置換し、顧客ごとのメール下書きを作成して」  
**対象:** 営業・マーケティング  
**信頼度:** 高（[Uravation 事例記事](https://uravation.com/media/claude-code-automation-case-studies-2026/)）

### 事例 6: 競合 5 社の料金・機能比較表の自動作成

**内容:** 競合 5 社の Web サイトから料金・機能情報を自動収集し、比較表を作成  
**効果:** 1 社 30 分〜1 時間の調査が、5 社まとめて 5〜10 分で完了  
**指示例:** 「以下の 5 社の URL から料金プランと主要機能を取得して、比較表を作って」  
**対象:** マーケティング・企画  
**信頼度:** 中〜高（[StartLink 事例記事](https://start-link.jp/hubspot-ai/ai/claude-code-practice/claude-code-non-engineer-use-cases)）

### 事例 7: 経費データの勘定科目別集計 + 前月比分析

**内容:** 経費精算データ CSV を読み込み、勘定科目ごとに自動集計し、前月比の増減をハイライトしたレポートを生成  
**効果:** 月次経費分析 4〜5 時間 → 15 分  
**指示例:** 「先月の経費データ.csv を勘定科目別に集計して、前月比の増減率を計算し、10% 以上変動した項目をハイライトした表を作って」  
**対象:** 経理・管理部門  
**信頼度:** 高（[StartLink 事例記事](https://start-link.jp/hubspot-ai/ai/claude-code-practice/claude-code-non-engineer-use-cases)、[freedoor 記事](https://freedoor.co.jp/blog/claude-code-business-automation/)）

---

## 情報源一覧

### 公式ドキュメント
- [Choose a permission mode - Claude Code Docs](https://code.claude.com/docs/en/permission-modes)
- [Claude Code auto mode: a safer way to skip permissions - Anthropic Engineering](https://www.anthropic.com/engineering/claude-code-auto-mode)
- [Enabling Claude Code to work more autonomously - Anthropic](https://www.anthropic.com/news/enabling-claude-code-to-work-more-autonomously)

### ハーネスエンジニアリング
- [Skill Issue: Harness Engineering for Coding Agents - HumanLayer](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents)
- [What Is Harness Engineering? Complete Guide 2026 - NxCode](https://www.nxcode.io/resources/news/what-is-harness-engineering-complete-guide-2026)

### 事例・実践記事
- [Claude Codeで業務自動化した事例3選 - Uravation](https://uravation.com/media/claude-code-automation-case-studies-2026/)
- [非エンジニアがClaude Codeでできること - StartLink](https://start-link.jp/hubspot-ai/ai/claude-code-practice/claude-code-non-engineer-use-cases)
- [Claude Code gives Anthropic its viral moment - Fortune](https://fortune.com/2026/01/24/anthropic-boris-cherny-claude-code-non-coders-software-engineers/)
- [Claude Code Auto Approve Guide - SmartScope](https://smartscope.blog/en/generative-ai/claude/claude-code-auto-permission-guide/)
- [Claude Code for Business Owners - MindStudio](https://www.mindstudio.ai/blog/claude-code-business-owners-5-core-concepts-3)
- [非エンジニアのための Claude Code ベストプラクティス - Zenn](https://zenn.dev/storehero/articles/18f7cf454ad947)
- [Claude Code Changed Everything (非エンジニア視点) - Substack](https://futuredigestnews.substack.com/p/claude-code-changed-everything-heres)

### パーミッション詳細
- [Claude Code --dangerously-skip-permissions: 5 Modes - MorphLLM](https://www.morphllm.com/claude-code-dangerously-skip-permissions)
- [Claude Code Permission Modes Deep Dive - Claude Lab](https://claudelab.net/en/articles/claude-code/claude-code-permission-modes-production-security-guide)
