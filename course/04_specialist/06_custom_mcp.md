# カスタムMCPサーバーの構築

## この記事で学ぶこと
- MCP（Model Context Protocol）の仕組みと通信モデル
- カスタム MCP サーバーの設計と実装の手順
- Claude Code への接続設定とデバッグ方法

## 前提知識
- Node.js（または Python）の基本的な開発経験
- Claude Code の MCP 連携の基本概念
- → [プラグイン開発](05_plugins.md)（MCP サーバーのパッケージ化）

---

## 本文

### MCP とは何か

MCP（Model Context Protocol）は、AI モデルが外部のツールやデータソースと標準的な方法で通信するためのプロトコルです。Claude Code はリモート MCP コネクタ（GitHub、Slack、Notion など）を標準サポートしていますが、カスタム MCP サーバーを構築することで、社内システムや独自のデータベースとも連携できます。

### MCP の通信モデル

```
Claude Code（クライアント）
    │
    │  JSON-RPC 2.0（標準入出力 or HTTP+SSE）
    │
    ▼
MCP サーバー
    │
    ├── ツール（Tools）    : Claude が呼び出せる関数
    ├── リソース（Resources）: Claude が読み取れるデータ
    └── プロンプト（Prompts）: 定型の指示テンプレート
```

MCP サーバーは 3 種類の機能を提供できます。

| 機能 | 説明 | 例 |
|------|------|-----|
| **Tools** | Claude が実行できるアクション | データベースクエリの実行、API の呼び出し |
| **Resources** | Claude が参照できるデータ | テーブル定義、設定値、ドキュメント |
| **Prompts** | 定型の指示テンプレート | レポート生成手順、分析手順 |

### カスタム MCP サーバーの実装（Node.js）

以下は、社内のタスク管理システムと連携する MCP サーバーの実装例です。

```javascript
// mcp-server/index.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "task-manager",
  version: "1.0.0",
  description: "社内タスク管理システムとの連携"
});

// ツール: タスク一覧の取得
server.tool(
  "list_tasks",
  "指定されたプロジェクトのタスク一覧を取得します",
  {
    project: z.string().describe("プロジェクト名"),
    status: z.enum(["open", "closed", "all"]).default("open")
      .describe("タスクのステータスフィルター")
  },
  async ({ project, status }) => {
    // 実際のAPIコールやDBクエリに置き換えてください
    const tasks = await fetchTasks(project, status);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(tasks, null, 2)
        }
      ]
    };
  }
);

// ツール: タスクの作成
server.tool(
  "create_task",
  "新しいタスクを作成します",
  {
    project: z.string().describe("プロジェクト名"),
    title: z.string().describe("タスクのタイトル"),
    description: z.string().optional().describe("タスクの説明"),
    assignee: z.string().optional().describe("担当者")
  },
  async ({ project, title, description, assignee }) => {
    const task = await createTask({ project, title, description, assignee });
    return {
      content: [
        {
          type: "text",
          text: `タスクを作成しました: ${task.id} - ${task.title}`
        }
      ]
    };
  }
);

// リソース: プロジェクト一覧
server.resource(
  "projects",
  "projects://list",
  "利用可能なプロジェクトの一覧",
  async () => {
    const projects = await fetchProjects();
    return {
      contents: [
        {
          uri: "projects://list",
          mimeType: "application/json",
          text: JSON.stringify(projects, null, 2)
        }
      ]
    };
  }
);

// サーバー起動
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Claude Code への接続設定

MCP サーバーを Claude Code に登録するには、settings.json に以下を追加します。

```json
// .claude/settings.json（プロジェクト単位）
{
  "mcpServers": {
    "task-manager": {
      "command": "node",
      "args": ["mcp-server/index.js"],
      "env": {
        "API_BASE_URL": "https://tasks.example.com/api",
        "API_TOKEN": "${TASK_API_TOKEN}"
      }
    }
  }
}
```

環境変数 `${TASK_API_TOKEN}` のように、機密情報は環境変数経由で渡します。settings.json にトークンを直接記載しないでください。

登録後、Claude Code を再起動するか `/mcp` コマンドで接続状態を確認します。

```
/mcp
```

正常に接続されていれば、Claude が `list_tasks` や `create_task` をツールとして認識し、自然言語で呼び出せるようになります。

```
「プロジェクト "web-app" の未完了タスクを一覧にして」
→ Claude が list_tasks ツールを呼び出す
```

### Python での実装例

Python で MCP サーバーを構築する場合は、`mcp` パッケージを使用します。

```python
# mcp_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("task-manager")

@mcp.tool()
async def list_tasks(project: str, status: str = "open") -> str:
    """指定されたプロジェクトのタスク一覧を取得します"""
    tasks = await fetch_tasks(project, status)
    return json.dumps(tasks, ensure_ascii=False, indent=2)

@mcp.tool()
async def create_task(project: str, title: str, 
                      description: str = "", assignee: str = "") -> str:
    """新しいタスクを作成します"""
    task = await create_new_task(project, title, description, assignee)
    return f"タスクを作成しました: {task['id']} - {task['title']}"

mcp.run()
```

settings.json での登録は以下のようになります。

```json
{
  "mcpServers": {
    "task-manager": {
      "command": "python",
      "args": ["mcp_server.py"]
    }
  }
}
```

### セキュリティの考慮事項

カスタム MCP サーバーを構築する際は、以下のセキュリティ対策を必ず実施してください。

1. **入力のバリデーション**: ツールの引数を必ず検証する（SQL インジェクション、パストラバーサルなど）
2. **最小権限の原則**: MCP サーバーに与える権限は必要最小限にする
3. **認証情報の管理**: API トークンやパスワードは環境変数で管理し、コードにハードコードしない
4. **ログ記録**: すべてのツール呼び出しをログに記録し、不正な操作を検出できるようにする
5. **レート制限**: 外部 API を呼び出す場合は、レート制限を実装して過剰なリクエストを防ぐ

### デバッグのヒント

MCP サーバーの開発中に問題が発生した場合は、以下を確認してください。

1. **標準エラー出力**: MCP サーバーの stderr に出力されるログを確認する
2. **JSON-RPC の形式**: リクエスト・レスポンスが JSON-RPC 2.0 の仕様に準拠しているか確認する
3. **`/mcp` コマンド**: Claude Code 上で接続状態とツール一覧を確認する
4. **単独テスト**: MCP サーバーを直接起動し、標準入力から JSON-RPC メッセージを送って動作を確認する

---

## やってみよう（ハンズオン）

### ステップ 1: MCP サーバーのプロジェクトを作成する

```bash
mkdir mcp-server && cd mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
```

### ステップ 2: シンプルなツールを実装する

まずは、ファイルシステムの情報を返すだけのシンプルなツールを実装してください。外部 API への接続は後から追加します。

### ステップ 3: Claude Code に接続する

`.claude/settings.json` に MCP サーバーを登録し、`/mcp` で接続を確認してください。Claude に対して自然言語でツールを呼び出してみましょう。

---

## まとめ
- MCP はAI モデルと外部ツール・データを標準的に接続するプロトコル
- カスタム MCP サーバーで Tools（アクション）、Resources（データ）、Prompts（テンプレート）を提供できる
- 実装は Node.js（`@modelcontextprotocol/sdk`）または Python（`mcp`）で行う
- セキュリティ（入力検証、認証情報管理、ログ記録）は必須の考慮事項

## 次に読む記事
- → [Team / Enterprise 導入ガイド](07_team_enterprise.md)
