# Hooks 上級 — 品質ゲートと自動検証の構築

## この記事で学ぶこと
- Hooks のライフサイクルイベントを網羅的に理解する
- 品質ゲート（自動テスト・リント・セキュリティチェック）の構築方法
- 複数の Hook を組み合わせた自動検証パイプラインの設計

## 前提知識
- → [Hooks の基本概念（ツール実行前後にスクリプトを実行する仕組み）](../03_advanced/03_hooks.md)
- → [CLAUDE.md マスタークラス](02_claude_md_mastery.md)

---

## 本文

### Hooks とは — 改めて整理する

Hooks は、Claude Code がツールを実行するライフサイクルの各ポイントで、あなたが定義したスクリプトを自動実行する仕組みです。CLAUDE.md の指示が「お願い」であるのに対し、Hooks は「強制的に実行される処理」です。

### ライフサイクルイベント一覧

```
ユーザーの指示
    │
    ▼
┌─────────────────┐
│  PreToolUse      │  ← ツール実行の直前
│  （入力を検証）   │
└────────┬────────┘
         │
    ▼ ツール実行
         │
┌────────┴────────┐
│  PostToolUse     │  ← ツール実行の直後
│  （出力を検証）   │
└────────┬────────┘
         │
    ▼ Claude の応答
         │
┌────────┴────────┐
│  Notification    │  ← 通知イベント
│  （外部連携）     │
└─────────────────┘
```

各イベントの詳細は以下のとおりです。

| イベント | 発火タイミング | 主な用途 |
|---------|--------------|---------|
| `PreToolUse` | ツール実行の直前 | 入力パラメータの検証、危険な操作のブロック |
| `PostToolUse` | ツール実行の直後 | 出力の検証、リントの自動実行、ログ記録 |
| `Notification` | Claude がユーザーの注意を引きたいとき | Slack 通知、メール通知 |
| `Stop` | Claude がタスク完了と判断したとき | 最終チェック、レポート生成 |

### settings.json での Hook 定義

Hooks は `.claude/settings.json`（プロジェクト単位）または `~/.claude/settings.json`（ユーザー全体）に定義します。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "/path/to/scripts/pre-bash-check.sh $TOOL_INPUT"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit",
        "command": "/path/to/scripts/post-edit-lint.sh $FILE_PATH"
      },
      {
        "matcher": "Write",
        "command": "/path/to/scripts/post-edit-lint.sh $FILE_PATH"
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "command": "/path/to/scripts/final-check.sh"
      }
    ]
  }
}
```

`matcher` はツール名にマッチする文字列です。空文字列 `""` はすべてのツールにマッチします。

### 品質ゲートの構築例

**例 1: ファイル編集後の自動リント**

ファイルが編集されるたびに ESLint を自動実行し、エラーがあれば Claude に通知するスクリプトです。

```bash
#!/bin/bash
# scripts/post-edit-lint.sh
FILE="$1"

# TypeScript/JavaScript ファイルのみ対象
if [[ "$FILE" == *.ts || "$FILE" == *.tsx || "$FILE" == *.js || "$FILE" == *.jsx ]]; then
  RESULT=$(npx eslint "$FILE" 2>&1)
  if [ $? -ne 0 ]; then
    echo "LINT_ERROR: $RESULT"
    exit 1  # exit 1 で Claude にエラーを伝える
  fi
fi
exit 0
```

Hook スクリプトが `exit 1` で終了すると、その結果が Claude にフィードバックされ、Claude は自動的に修正を試みます。

**例 2: 危険なコマンドのブロック**

`rm -rf` や `sudo` など、危険なコマンドの実行を事前にブロックします。

```bash
#!/bin/bash
# scripts/pre-bash-check.sh
INPUT="$1"

# 危険なパターンをチェック
DANGEROUS_PATTERNS=(
  "rm -rf /"
  "sudo "
  "DROP TABLE"
  "DELETE FROM"
  "> /dev/"
  "mkfs"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$INPUT" | grep -q "$pattern"; then
    echo "BLOCKED: 危険な操作が検出されました: $pattern"
    exit 1
  fi
done
exit 0
```

**例 3: セキュリティスキャン**

ファイル編集後に機密情報の漏洩をチェックします。

```bash
#!/bin/bash
# scripts/secret-scan.sh
FILE="$1"

# API キーやパスワードのパターンをチェック
PATTERNS=(
  "AKIA[0-9A-Z]{16}"          # AWS Access Key
  "sk-[a-zA-Z0-9]{48}"        # OpenAI API Key
  "password\s*=\s*['\"].*['\"]" # ハードコードされたパスワード
)

for pattern in "${PATTERNS[@]}"; do
  if grep -qE "$pattern" "$FILE"; then
    echo "SECRET_DETECTED: 機密情報が含まれている可能性があります"
    exit 1
  fi
done
exit 0
```

### 自動検証パイプラインの設計

複数の Hook を組み合わせて、段階的な品質チェックを構築できます。

```
ファイル編集
    │
    ▼ PostToolUse (Edit/Write)
    ├── 1. リント（ESLint / Prettier）
    ├── 2. 型チェック（tsc --noEmit）
    ├── 3. 機密情報スキャン
    │
    ▼ PostToolUse (Bash: git commit)
    ├── 4. ユニットテスト実行
    ├── 5. カバレッジチェック
    │
    ▼ Stop
    └── 6. 変更サマリーの生成
```

この構成を settings.json で表現すると以下のようになります。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "command": "bash -c 'scripts/lint.sh \"$FILE_PATH\" && scripts/typecheck.sh && scripts/secret-scan.sh \"$FILE_PATH\"'"
      },
      {
        "matcher": "Bash",
        "command": "scripts/post-bash-verify.sh"
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "command": "scripts/generate-summary.sh"
      }
    ]
  }
}
```

### Hook のデバッグ

Hook が期待どおりに動かない場合は、以下の手順でデバッグします。

1. **`/hooks` コマンドで登録状況を確認**: 定義した Hook が正しく読み込まれているかを確認します
2. **スクリプトを単独実行**: Hook スクリプトをターミナルで直接実行し、エラーがないかを確認します
3. **ログ出力を追加**: スクリプト内で `echo` や `>> /tmp/hook-debug.log` を使い、実行状況を記録します
4. **`exit 0` と `exit 1` の使い分け**: `exit 0` は成功（Claude に影響なし）、`exit 1` は失敗（Claude にフィードバック）です

---

## やってみよう（ハンズオン）

### ステップ 1: リント用の Hook を作成する

プロジェクトに `scripts/post-edit-lint.sh` を作成し、実行権限を付与してください。

```bash
chmod +x scripts/post-edit-lint.sh
```

### ステップ 2: settings.json に Hook を登録する

`.claude/settings.json` に PostToolUse の Hook を追加してください。

### ステップ 3: 動作確認

Claude Code にファイル編集を依頼し、編集後にリントが自動実行されることを確認してください。意図的にリントエラーが出るコードを書かせ、Claude が自動修正するかも確認しましょう。

---

## まとめ
- Hooks は CLAUDE.md の「お願い」と異なり、強制的に実行される品質ゲート
- `PreToolUse` で危険な操作をブロックし、`PostToolUse` で出力を検証する
- 複数の Hook を組み合わせることで、リント → 型チェック → セキュリティスキャンの自動パイプラインを構築できる
- Hook スクリプトの `exit 1` は Claude へのフィードバックとなり、自動修正を促す

## 次に読む記事
- → [Agent Teams — 複数エージェントの協調動作](04_agent_teams.md)
