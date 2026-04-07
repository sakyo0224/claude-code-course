# Hooks の仕組みと活用

## この記事で学ぶこと
- Hooks の仕組みと、どのタイミングで実行されるか
- 実践的な Hooks 設定の書き方
- セキュリティチェックや品質管理を自動化する方法

## 前提知識
- ハーネス設計の基本（→ [ハーネス設計の実践](02_harness_practice.md)）
- settings.json の配置場所と基本構造

## 本文

### Hooks とは

Hooks（フック）とは、Claude Code がツールを実行する前後に、自動でカスタムスクリプトを実行する仕組みです。「ファイルを編集したら自動でリントを実行する」「コマンドを実行する前にセキュリティチェックを入れる」といった自動化が可能になります。

Hooks は settings.json に記述し、**決定論的に動作**します。CLAUDE.md のルールは AI が「守ろうとする」ものですが、Hooks は確実に実行されるため、品質管理やセキュリティ対策として非常に強力です。

### Hooks のライフサイクルイベント

Hooks が実行されるタイミング（ライフサイクルイベント）は以下の通りです。

| イベント | タイミング | 主な用途 |
|---------|----------|---------|
| `PreToolUse` | ツール実行の直前 | 入力の検証、危険な操作のブロック |
| `PostToolUse` | ツール実行の直後 | リント実行、フォーマット、ログ記録 |
| `Notification` | Claude がユーザーに通知を送るとき | カスタム通知（Slack 通知など） |
| `Stop` | Claude がレスポンスを完了したとき | サマリー生成、後処理 |
| `SubagentStop` | サブエージェントがタスクを完了したとき | サブエージェントの出力検証 |

### Hooks の基本構造

Hooks は settings.json の `hooks` キーに記述します。

```json
{
  "hooks": {
    "イベント名": [
      {
        "matcher": "対象ツール名のパターン",
        "hooks": [
          {
            "type": "command",
            "command": "実行するコマンド"
          }
        ]
      }
    ]
  }
}
```

**matcher** はどのツールに対して Hooks を発火させるかを指定します。正規表現が使えるため、`Edit|Write` のように複数のツールを指定できます。matcher を省略すると、すべてのツール実行に対して発火します。

### 環境変数

Hooks のコマンド内では、以下の環境変数が利用できます。

| 環境変数 | 内容 |
|---------|------|
| `$CLAUDE_TOOL_NAME` | 実行されたツール名（例：`Edit`、`Bash`） |
| `$CLAUDE_TOOL_INPUT` | ツールに渡された入力（JSON 形式） |
| `$CLAUDE_FILE_PATH` | 操作対象のファイルパス（ファイル操作時） |
| `$CLAUDE_SESSION_ID` | 現在のセッション ID |

### 実践的な Hooks 設定例

#### 例 1：ファイル編集後に自動リント

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx eslint --fix \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

ファイルを編集・作成するたびに ESLint が自動実行され、コードスタイルが統一されます。

#### 例 2：危険なコマンドの事前チェック

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo $CLAUDE_TOOL_INPUT | python3 -c \"import sys,json; cmd=json.load(sys.stdin)['command']; exit(1) if any(w in cmd for w in ['rm -rf /','DROP TABLE','DELETE FROM']) else exit(0)\""
          }
        ]
      }
    ]
  }
}
```

Bash コマンドの実行前に、危険なキーワードが含まれていないかチェックします。Hook が終了コード 1 を返すと、そのツール実行はブロックされます。

#### 例 3：コミット前にテスト実行

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo $CLAUDE_TOOL_INPUT | python3 -c \"import sys,json; cmd=json.load(sys.stdin)['command']; exit(0) if 'git commit' not in cmd else exit(0)\" && if echo $CLAUDE_TOOL_INPUT | grep -q 'git commit'; then npm test; fi"
          }
        ]
      }
    ]
  }
}
```

#### 例 4：操作ログの記録

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$(date '+%Y-%m-%d %H:%M:%S') | $CLAUDE_TOOL_NAME | $CLAUDE_FILE_PATH\" >> ~/.claude/audit.log"
          }
        ]
      }
    ]
  }
}
```

すべてのツール実行を日時とともにログファイルに記録します。何が行われたかを後から確認できるため、監査やデバッグに役立ちます。

#### 例 5：機密ファイルの保護

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo $CLAUDE_TOOL_INPUT | python3 -c \"import sys,json; fp=json.load(sys.stdin).get('file_path',''); exit(1) if any(p in fp for p in ['.env','credentials','secret','private_key']) else exit(0)\""
          }
        ]
      }
    ]
  }
}
```

`.env` や `credentials` などの機密ファイルへの書き込みを自動的にブロックします。

### Hooks の確認方法

設定した Hooks は、Claude Code 上で `/hooks` コマンドを実行すると一覧を確認できます。

```
/hooks
```

### Hooks 設計のベストプラクティス

1. **失敗を許容する設計にする**：Hooks のコマンドがエラーで落ちても、メインの作業が止まらないよう `|| true` を付けることを検討してください（ブロック目的の場合を除く）
2. **軽量に保つ**：Hooks は毎回実行されるため、重い処理は避けましょう
3. **ログを活用する**：問題が起きたとき、ログがあると原因特定が早くなります
4. **段階的に追加する**：最初から完璧な Hooks を目指さず、問題が発生するたびに追加していきましょう

## やってみよう（ハンズオン）

### ステップ 1：操作ログの Hooks を設定する

まずは簡単なログ記録の Hooks から始めましょう。`.claude/settings.json` に以下を追加してください。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$(date '+%Y-%m-%d %H:%M:%S') | $CLAUDE_TOOL_NAME\" >> ~/.claude/audit.log"
          }
        ]
      }
    ]
  }
}
```

### ステップ 2：Claude Code で作業を行い、ログを確認する

通常通り Claude Code で作業した後、ログファイルを確認します。

```bash
cat ~/.claude/audit.log
```

### ステップ 3：リント自動実行の Hooks を追加する

プロジェクトにリンターが設定されている場合は、ファイル編集後の自動リントを追加してみましょう。

## まとめ
- Hooks はツール実行の前後に自動でスクリプトを実行する仕組み
- PreToolUse で事前チェック、PostToolUse で事後処理を行える
- 終了コード 1 を返すとツール実行をブロックできる
- 環境変数（`$CLAUDE_TOOL_NAME` 等）で実行内容を参照できる
- 軽量に保ち、段階的に追加していくのがベストプラクティス

## 次に読む記事
- → [Auto モード — 安全な自走モードの使い方](04_auto_mode.md)
