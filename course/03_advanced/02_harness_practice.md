# ハーネス設計の実践

## この記事で学ぶこと
- CLAUDE.md と settings.json を組み合わせた実践的なハーネス設計
- プロジェクトの種類に応じた設定パターン
- ハーネスの段階的な強化方法

## 前提知識
- ハーネスエンジニアリングの概念（→ [ハーネスエンジニアリングとは何か](01_harness_concept.md)）
- CLAUDE.md の基本的な書き方

## 本文

### ハーネス設計の全体像

ハーネス設計は、次の 3 つのレイヤーで考えると整理しやすくなります。

1. **コンテキストレイヤー**：CLAUDE.md でプロジェクトの知識とルールを伝える
2. **権限レイヤー**：settings.json でできること/できないことを制御する
3. **自動化レイヤー**：Hooks で品質チェックやセキュリティスキャンを自動実行する

### レイヤー 1：コンテキストレイヤー（CLAUDE.md）

CLAUDE.md は、エージェントに「このプロジェクトの文化」を教えるファイルです。効果的な CLAUDE.md には、次の要素を含めます。

```markdown
# プロジェクト概要
このプロジェクトは○○のWebアプリケーションです。
TypeScript + Next.js + Prisma で構築されています。

# コーディング規約
- 変数名はキャメルケース（camelCase）を使用
- コンポーネントはパスカルケース（PascalCase）を使用
- 関数は必ず型注釈をつける

# テスト方針
- 新しい関数には必ずユニットテストを書く
- テスト実行コマンド: `npm test`
- テストが失敗する変更はコミットしない

# ディレクトリ構成
- src/components/ : UIコンポーネント
- src/lib/ : ビジネスロジック
- src/app/ : ページルーティング
- prisma/ : データベーススキーマ

# 禁止事項
- 本番データベースへの直接接続は禁止
- 環境変数(.env)をコミットしない
- main ブランチへの直接プッシュは禁止
```

**ポイント**：CLAUDE.md は「聞かれなくても教えておきたいこと」を書く場所です。エージェントがミスをしたら、そのミスを防ぐルールを CLAUDE.md に追記していきましょう。これがまさにハーネスエンジニアリングの実践です。

### レイヤー 2：権限レイヤー（settings.json）

settings.json は、CLAUDE.md と違い**決定論的**に動作を制御します。CLAUDE.md のルールは AI が「守ろうとする」ものですが、settings.json のルールは「物理的に守らせる」ものです。

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Edit",
      "Write",
      "Glob",
      "Grep",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git push origin HEAD)",
      "Bash(npm test)",
      "Bash(npm run lint)",
      "Bash(npm run build)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(mkdir *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(sudo *)",
      "Bash(git push --force *)",
      "Bash(git push origin main)",
      "Bash(curl * | bash)",
      "Bash(wget * | bash)"
    ]
  }
}
```

**設定ファイルの配置場所**：

| ファイル | スコープ | 用途 |
|---------|---------|------|
| `~/.claude/settings.json` | ユーザー全体 | 個人の共通ルール |
| `.claude/settings.json` | プロジェクト単位 | チームで共有するルール |
| `.claude/settings.local.json` | プロジェクト単位（個人） | 個人の上書き設定（Git 管理外） |

### レイヤー 3：自動化レイヤー（Hooks）

Hooks の詳細は次の記事で扱いますが、ここではハーネス設計における位置づけを理解しておきましょう。

Hooks は「エージェントが何かをする前後に、自動でスクリプトを実行する仕組み」です。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npm run lint -- --fix $CLAUDE_FILE_PATH"
          }
        ]
      }
    ]
  }
}
```

この例では、ファイルを編集・作成するたびに自動でリンター（コード品質チェックツール）が実行されます。

### プロジェクト種類別の設定パターン

**パターン A：個人開発プロジェクト（自由度高め）**

```json
{
  "permissions": {
    "allow": [
      "Read", "Edit", "Write", "Glob", "Grep",
      "Bash(git *)", "Bash(npm *)", "Bash(ls *)"
    ],
    "deny": [
      "Bash(rm -rf *)", "Bash(sudo *)"
    ]
  }
}
```

**パターン B：チーム開発プロジェクト（安全性重視）**

```json
{
  "permissions": {
    "allow": [
      "Read", "Glob", "Grep",
      "Bash(git status)", "Bash(git diff *)",
      "Bash(npm test)", "Bash(npm run lint)"
    ],
    "deny": [
      "Bash(rm -rf *)", "Bash(sudo *)",
      "Bash(git push --force *)",
      "Bash(git push origin main)",
      "Bash(npm publish *)"
    ]
  }
}
```

**パターン C：CI/CD パイプライン（完全自動化）**

```json
{
  "permissions": {
    "allow": [
      "Read", "Edit", "Write", "Glob", "Grep",
      "Bash(git *)", "Bash(npm *)", "Bash(docker *)"
    ],
    "deny": [
      "Bash(rm -rf /)",
      "Bash(sudo *)"
    ]
  }
}
```

### ハーネスの段階的な強化

ハーネスは一度に完璧にする必要はありません。次のサイクルで段階的に強化していきましょう。

1. **最小限の設定で始める**（allow/deny の基本設定のみ）
2. **エージェントを使う**（通常の開発作業に使用）
3. **問題を発見する**（意図しない動作、ミスの発生）
4. **ハーネスに反映する**（CLAUDE.md にルール追記、deny に追加、Hooks で自動チェック）
5. **2 に戻る**

この継続的な改善サイクルこそが、ハーネスエンジニアリングの本質です。

## やってみよう（ハンズオン）

### ステップ 1：プロジェクトの設定ファイルを作成する

```bash
# プロジェクトルートで実行
mkdir -p .claude
```

### ステップ 2：settings.json を作成する

自分のプロジェクトに合ったパターン（A/B/C）を選び、`.claude/settings.json` として保存してください。

### ステップ 3：CLAUDE.md を充実させる

以下の項目を CLAUDE.md に追記しましょう。

- プロジェクトで使っている技術スタック
- テストの実行方法
- コミット前に確認すべきこと
- 過去に起きたミスと、その防止ルール

### ステップ 4：動作確認

Claude Code を起動し、意図的に deny に設定したコマンドを試してみましょう。ブロックされることを確認できれば、ハーネスが正しく機能しています。

## まとめ
- ハーネス設計は「コンテキスト」「権限」「自動化」の 3 レイヤーで考える
- CLAUDE.md は「守ろうとするルール」、settings.json は「物理的に守らせるルール」
- プロジェクトの種類に応じて設定パターンを使い分ける
- ハーネスは段階的に強化していくもの。完璧を目指さず、改善を繰り返す

## 次に読む記事
- → [Hooks の仕組みと活用](03_hooks.md)
