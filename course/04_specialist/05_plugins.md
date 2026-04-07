# プラグイン開発 — スキル・フック・MCPのパッケージ化

## この記事で学ぶこと
- プラグインの構造と、スキル・フック・MCP サーバーの統合方法
- 再利用可能なプラグインを設計・開発する手順
- プラグインの公開と配布の方法

## 前提知識
- Hooks の仕組み（→ [Hooks 上級](03_hooks_advanced.md)）
- Agent Teams の概念（→ [Agent Teams](04_agent_teams.md)）
- MCP の基本概念（→ [MCP 実践 — Slack / Notion / Google 連携](../03_advanced/10_mcp_practice.md)）

---

## 本文

### プラグインとは

Claude Code のプラグインは、**スキル、エージェント、フック、MCP サーバー、LSP 設定をひとつのパッケージとして管理する仕組み**です。プラグインを使うことで、特定の業務ドメインや技術スタックに特化した拡張機能を、チームやコミュニティで共有できます。

### プラグインの構造

プラグインは以下の構造を持ちます。

```
my-plugin/
├── plugin.json          # プラグインのメタデータ
├── skills/
│   ├── my-skill.md      # スキル定義（マークダウン）
│   └── another-skill.md
├── hooks/
│   ├── pre-edit.sh       # Hook スクリプト
│   └── post-commit.sh
├── agents/
│   └── specialist.json   # サブエージェント定義
├── mcp/
│   └── server.js         # MCP サーバー実装
└── README.md             # 使い方の説明
```

### plugin.json の構造

```json
{
  "name": "typescript-quality",
  "version": "1.0.0",
  "description": "TypeScript プロジェクト向けの品質管理プラグイン",
  "author": "your-name",
  "skills": [
    {
      "name": "ts-review",
      "file": "skills/ts-review.md",
      "trigger": "TypeScriptのコードレビューをお願い"
    }
  ],
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "command": "hooks/post-edit-lint.sh"
      }
    ]
  },
  "agents": [
    {
      "name": "ts-reviewer",
      "file": "agents/specialist.json"
    }
  ],
  "mcp": {
    "servers": [
      {
        "name": "quality-metrics",
        "command": "node",
        "args": ["mcp/server.js"]
      }
    ]
  }
}
```

### スキルの作成

スキルは、Claude Code に追加の知識と手順を提供するマークダウンファイルです。`/skills` コマンドで一覧を確認でき、スラッシュコマンドとして呼び出せます。

```markdown
# skills/ts-review.md

## TypeScript コードレビュースキル

このスキルは TypeScript コードのレビューを行います。

### チェック項目
1. 型安全性: `any` の使用を最小限にしているか
2. null チェック: Optional Chaining と Nullish Coalescing を適切に使用しているか
3. エラーハンドリング: try-catch が適切に配置されているか
4. パフォーマンス: 不要な再レンダリングや N+1 クエリがないか

### 手順
1. 対象ファイルを読み込む
2. 上記チェック項目に沿ってレビューする
3. 問題があれば修正案を提示する
4. 問題がなければ「レビュー完了」と報告する
```

### フックのパッケージ化

プラグイン内の Hook スクリプトは、相対パスで参照されます。プラグインがインストールされると、パスが自動的に解決されます。

```bash
#!/bin/bash
# hooks/post-edit-lint.sh
# プラグインのルートディレクトリからの相対パスで動作

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$1"

if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  npx eslint "$FILE" --config "$PLUGIN_DIR/config/.eslintrc.json" 2>&1
  if [ $? -ne 0 ]; then
    echo "LINT_ERROR: TypeScript lint チェックに失敗しました"
    exit 1
  fi
fi
exit 0
```

### プラグインのインストールと管理

```bash
# プラグインのインストール（ローカルディレクトリから）
/plugin install /path/to/my-plugin

# プラグインのインストール（リモートリポジトリから）
/plugin install github:username/my-plugin

# インストール済みプラグインの一覧
/plugin list

# プラグインの無効化
/plugin disable my-plugin

# プラグインの削除
/plugin uninstall my-plugin
```

### プラグイン開発の実践的な手順

**ステップ 1: 課題を特定する**

まず、繰り返し行っている作業や、チーム内で標準化したいプロセスを洗い出します。

```
例:
- 毎回 PR 作成前にセキュリティチェックをしている → Hook 化
- 新しいAPIエンドポイントの作成手順が決まっている → スキル化
- 外部サービスのデータを頻繁に取得している → MCP サーバー化
```

**ステップ 2: 最小構成で始める**

いきなりフル機能のプラグインを作るのではなく、まずスキル 1 つ、または Hook 1 つから始めましょう。

```
my-plugin/
├── plugin.json
└── skills/
    └── my-skill.md
```

**ステップ 3: テストと改善**

プラグインを自分のプロジェクトにインストールして実際に使い、フィードバックをもとに改善します。

**ステップ 4: ドキュメントと配布**

README.md に使い方を記載し、Git リポジトリとして公開します。

### 設計のベストプラクティス

1. **単一責任**: 1 つのプラグインは 1 つのドメインに集中する（「TypeScript 品質管理」「React コンポーネント生成」など）
2. **依存関係の明示**: 必要な外部ツール（ESLint、Prettier など）は README に明記する
3. **設定の外部化**: ハードコードを避け、設定ファイルでカスタマイズできるようにする
4. **エラーメッセージの充実**: Hook が失敗したとき、Claude が何をすべきか分かるメッセージを返す
5. **バージョニング**: セマンティックバージョニング（SemVer）に従い、破壊的変更はメジャーバージョンを上げる

---

## やってみよう（ハンズオン）

### ステップ 1: プラグインのスケルトンを作成する

以下のコマンドで、プラグインの基本構造を作成してください。

```bash
mkdir -p my-plugin/{skills,hooks,agents,mcp}
touch my-plugin/plugin.json
touch my-plugin/skills/my-skill.md
```

### ステップ 2: スキルを作成してテストする

`skills/my-skill.md` に、あなたの業務で頻繁に行う手順を記述してください。プラグインをインストールし、スキルが呼び出せることを確認しましょう。

### ステップ 3: Hook を追加する

ファイル編集後に自動で実行されるチェックスクリプトを作成し、`plugin.json` に登録してください。

---

## まとめ
- プラグインは、スキル・フック・エージェント・MCP サーバーを 1 つのパッケージに統合する仕組み
- `plugin.json` にメタデータを定義し、各コンポーネントを適切なディレクトリに配置する
- 開発は最小構成から始め、実際に使いながら段階的に拡張する
- 単一責任、依存関係の明示、設定の外部化がベストプラクティス

## 次に読む記事
- → [カスタムMCPサーバーの構築](06_custom_mcp.md)
