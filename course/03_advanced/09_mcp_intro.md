# MCP サーバー連携 入門

## この記事で学ぶこと
- MCP（Model Context Protocol）の概念と仕組み
- Claude Code での MCP サーバーの設定方法
- リモート MCP コネクタとカスタム MCP サーバーの違い

## 前提知識
- Claude Code の基本操作
- settings.json の編集方法（→ [settings.json 完全ガイド](../02_intermediate/11_settings_json.md)）

## 本文

### MCP とは何か

MCP（Model Context Protocol）は、AI エージェントが外部のツールやサービスと通信するための**標準プロトコル**です。「AI の USB ポート」と考えるとわかりやすいでしょう。USB ポートにさまざまなデバイスを接続できるように、MCP を通じてさまざまな外部サービスを Claude Code に接続できます。

MCP サーバーとは、この MCP プロトコルに対応した外部サービスの接続口のことです。Claude Code は MCP クライアントとして動作し、MCP サーバーに接続してツールを利用します。

### MCP の構成

```
Claude Code（MCPクライアント）
    ├── MCP サーバー A（GitHub 連携）
    ├── MCP サーバー B（Slack 連携）
    ├── MCP サーバー C（Notion 連携）
    └── MCP サーバー D（カスタムツール）
```

各 MCP サーバーは、Claude Code に対して「ツール」を公開します。たとえば Slack の MCP サーバーは「メッセージ送信」「チャンネル一覧取得」「メッセージ検索」といったツールを提供します。

### MCP サーバーの 2 つのタイプ

**1. リモート MCP コネクタ（推奨・簡単）**

Anthropic が公式に提供する、クラウドベースの MCP コネクタです。設定が簡単で、OAuth 認証により安全にサービスと接続できます。

対応サービスの例：
- GitHub
- Slack
- Google Calendar
- Notion
- Linear

**設定方法（デスクトップアプリ）：**
1. プロンプト入力欄の「+」ボタンをクリック
2. 「Connect an app」を選択
3. 接続したいサービスを選んで OAuth 認証を完了

**設定方法（CLI）：**
```
/mcp
```
このコマンドで MCP サーバーの管理画面が開きます。

**2. カスタム MCP サーバー（上級・柔軟）**

自分で MCP サーバーを構築・設定する方法です。公式に提供されていないサービスとの連携や、独自のツールを作る場合に使います。

**settings.json での設定例：**

```json
{
  "mcpServers": {
    "my-database": {
      "command": "node",
      "args": ["/path/to/my-mcp-server/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://localhost:5432/mydb"
      }
    },
    "file-search": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/path/to/allowed/directory"]
    }
  }
}
```

### MCP サーバーの設定ファイルの配置場所

| ファイル | スコープ | 用途 |
|---------|---------|------|
| `~/.claude/settings.json` | ユーザー全体 | 個人で使う MCP サーバー |
| `.claude/settings.json` | プロジェクト単位 | チームで共有する MCP サーバー |

### MCP ツールの使い方

MCP サーバーが接続されると、Claude Code はそのツールを自動的に認識します。自然言語で指示するだけで、適切な MCP ツールが呼び出されます。

```
Slackの#generalチャンネルに「デプロイ完了しました」と投稿して
```

Claude Code は内部で Slack MCP サーバーのメッセージ送信ツールを呼び出します。

**MCP プロンプトの利用：**

MCP サーバーが公開するプロンプト（テンプレート）は、以下の形式で呼び出せます。

```
/mcp__<サーバー名>__<プロンプト名>
```

例：
```
/mcp__github__create-issue
```

### MCP サーバーの状態確認

接続中の MCP サーバーの状態を確認するには、以下のコマンドを使います。

```
/mcp
```

各サーバーの接続状態、提供しているツールの一覧が表示されます。

### セキュリティに関する注意

MCP サーバーは外部サービスと通信するため、以下の点に注意してください。

1. **信頼できるソースの MCP サーバーのみを使用する**：公式コネクタまたは信頼できる開発者が作成したサーバーを選びましょう
2. **最小権限の原則**：MCP サーバーに渡す権限は必要最小限にしましょう
3. **環境変数の管理**：API キーやトークンは settings.json に直接書くのではなく、環境変数で管理しましょう
4. **ネットワーク通信の確認**：カスタム MCP サーバーがどこと通信しているかを確認しましょう

### よく使われる公開 MCP サーバー

| サーバー | 用途 | インストール方法 |
|---------|------|----------------|
| `@anthropic-ai/mcp-server-filesystem` | ファイルシステム操作 | `npx` で実行 |
| `@anthropic-ai/mcp-server-memory` | 永続的なメモリ | `npx` で実行 |
| `@anthropic-ai/mcp-server-puppeteer` | ブラウザ自動操作 | `npx` で実行 |
| `@anthropic-ai/mcp-server-postgres` | PostgreSQL 操作 | `npx` で実行 |

## やってみよう（ハンズオン）

### ステップ 1：MCP サーバーの状態を確認する

Claude Code で以下のコマンドを実行してください。

```
/mcp
```

現在接続されている MCP サーバーの一覧が表示されます。

### ステップ 2：リモートコネクタで GitHub を接続する（デスクトップアプリの場合）

1. プロンプト入力欄の「+」ボタンをクリック
2. 「Connect an app」→「GitHub」を選択
3. OAuth 認証を完了
4. 接続後、以下を試す：

```
GitHubの自分のリポジトリ一覧を表示して
```

### ステップ 3：カスタム MCP サーバーを設定する

ファイルシステム用の MCP サーバーを設定してみましょう。`~/.claude/settings.json` に以下を追加します。

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem", "/tmp/mcp-test"]
    }
  }
}
```

設定後、Claude Code を再起動して `/mcp` で接続を確認してください。

## まとめ
- MCP は AI エージェントと外部サービスをつなぐ標準プロトコル
- リモート MCP コネクタ（公式提供・簡単設定）とカスタム MCP サーバー（自分で構築・柔軟）の 2 種類がある
- settings.json に MCP サーバーの設定を記述して接続する
- 自然言語で指示するだけで、Claude Code が適切な MCP ツールを呼び出す
- セキュリティに注意し、信頼できるソースのサーバーのみを使用する

## 次に読む記事
- → [MCP 実践 — Slack / Notion / Google 連携](10_mcp_practice.md)
