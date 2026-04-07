# CI/CD パイプラインへの統合

## この記事で学ぶこと
- Claude Code を CI/CD パイプラインに組み込むアーキテクチャ
- GitHub Actions との具体的な統合方法
- PR の自動レビュー・自動修正・自動マージの構築

## 前提知識
- Git と GitHub の基本操作
- CI/CD（継続的インテグレーション / 継続的デリバリー）の基本概念
- → [Hooks 上級](03_hooks_advanced.md)、[監査ログとコンプライアンス](08_audit_compliance.md)

---

## 本文

### CI/CD における Claude Code の役割

従来の CI/CD パイプラインは「ビルド → テスト → デプロイ」という決定論的なプロセスでした。ここに Claude Code を統合することで、以下のような知的なステップを追加できます。

```
従来の CI/CD:
  コード変更 → ビルド → テスト → デプロイ

Claude Code 統合後の CI/CD:
  コード変更 → ビルド → テスト → AI レビュー → AI 修正 → 再テスト → デプロイ
                                  ↑                ↑
                              Claude Code       Claude Code
```

### GitHub Actions との統合

Claude Code は GitHub Actions との連携を標準でサポートしています。`/install-github-app` コマンドで GitHub App をインストールし、PR に対する自動レビューや自動修正を有効化できます。

**基本的なワークフロー定義**

```yaml
# .github/workflows/claude-review.yml
name: Claude Code Review
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code

      - name: Run Claude Code Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude --permission-mode plan \
            --print \
            "この PR の変更をレビューして、問題点と改善提案をコメントしてください。
             セキュリティ、パフォーマンス、可読性の観点でチェックしてください。"
```

**PR コメントへの自動応答**

Claude Code の GitHub App を設定すると、PR コメントで `@claude` とメンションすることで、Claude Code に直接指示を出せます。

```
# PR コメント例
@claude このファイルのエラーハンドリングを改善してください
```

Claude Code はコメントを受け取り、コードを修正して新しいコミットをプッシュします。

### 非対話モード（`--print`）

CI/CD パイプラインでは、Claude Code を非対話モードで実行する必要があります。`--print` フラグを使うと、結果を標準出力に出力して終了します。

```bash
# 非対話モードでコードレビュー
claude --print "src/ ディレクトリの変更をレビューして"

# 非対話モードでテスト生成
claude --print "src/api/users.ts に対するテストを書いて"

# 非対話モードで修正
claude --permission-mode acceptEdits \
  --print "lint エラーをすべて修正して"
```

### パイプラインへの統合パターン

**パターン 1: PR 自動レビュー**

PR が作成されるたびに、Claude Code がコードレビューを実行し、コメントを追加します。

```yaml
- name: Review PR
  run: |
    REVIEW=$(claude --print \
      "git diff origin/main...HEAD の変更をレビューしてください。
       問題があれば具体的な修正案とともに報告してください。")
    gh pr comment ${{ github.event.pull_request.number }} \
      --body "$REVIEW"
```

**パターン 2: テスト失敗時の自動修正**

テストが失敗した場合に、Claude Code が自動的に修正を試みます。

```yaml
- name: Run Tests
  id: test
  run: npm test
  continue-on-error: true

- name: Auto-fix if tests fail
  if: steps.test.outcome == 'failure'
  run: |
    claude --permission-mode acceptEdits \
      --print "テストが失敗しました。エラーメッセージを確認し、コードを修正してください。"
    git add -A
    git commit -m "fix: Claude Code による自動修正"
    git push
```

**パターン 3: セキュリティスキャン**

```yaml
- name: Security Scan
  run: |
    RESULT=$(claude --print \
      "変更されたファイルにセキュリティ上の問題がないか確認してください。
       特に以下を重点的にチェックしてください:
       - ハードコードされた認証情報
       - SQL インジェクション
       - XSS 脆弱性
       - パストラバーサル")
    if echo "$RESULT" | grep -q "重大な問題"; then
      echo "::error::セキュリティ上の問題が検出されました"
      exit 1
    fi
```

**パターン 4: CI 状態の監視と自動マージ**

Claude Code の PR 監視機能を使うと、CI のステータスを自動で確認し、すべてのチェックが通ったら自動マージすることも可能です。

```
# Claude Code セッション内で
「この PR の CI が通ったら自動マージして」
```

### パーミッションとセキュリティの考慮事項

CI/CD 環境で Claude Code を実行する際は、以下のセキュリティ対策が必須です。

1. **API キーの保護**: `ANTHROPIC_API_KEY` は GitHub Secrets に保存し、ワークフローのログに出力されないようにする
2. **パーミッションモードの制限**: CI 環境では `plan` モード（レビュー時）または `acceptEdits`（修正時）に限定する。`bypassPermissions` は使用しない
3. **実行範囲の制限**: Claude Code が操作できるディレクトリとコマンドを settings.json で制限する
4. **レート制限**: 短時間に大量の PR が作成された場合に、Claude Code の実行回数が爆発しないよう制限を設ける
5. **承認フロー**: 自動修正や自動マージには、少なくとも 1 人の人間によるレビューを挟むことを推奨

```json
// CI環境用の .claude/settings.json
{
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Bash(npm test)",
      "Bash(npm run lint)"
    ],
    "deny": [
      "Bash(rm *)",
      "Bash(sudo *)",
      "Bash(curl *)",
      "Bash(git push origin main)"
    ]
  }
}
```

### コスト管理

CI/CD で Claude Code を実行すると、PR ごとにトークンが消費されます。コストを管理するために以下を実施してください。

- **対象ファイルの限定**: 変更されたファイルのみをレビュー対象にする（全ファイルスキャンを避ける）
- **実行条件の設定**: ドラフト PR やドキュメントのみの変更では実行しない
- **月次予算の設定**: API 利用料の月次上限を設定する

---

## やってみよう（ハンズオン）

### ステップ 1: GitHub App をインストールする

Claude Code のセッションで `/install-github-app` を実行し、対象リポジトリに GitHub App をインストールしてください。

### ステップ 2: レビューワークフローを作成する

`.github/workflows/claude-review.yml` を作成し、PR 作成時に Claude Code が自動レビューを実行するワークフローを構築してください。

### ステップ 3: テスト PR で動作確認する

テスト用のブランチを作成し、PR を出して自動レビューが動作することを確認してください。

---

## まとめ
- Claude Code は `--print` フラグで非対話モードに対応し、CI/CD パイプラインに統合可能
- GitHub Actions との連携で、PR の自動レビュー・自動修正・自動マージを実現できる
- CI 環境ではパーミッションモードの制限と API キーの保護が必須
- コスト管理のために、実行対象と実行条件を適切に設定する

## 次に読む記事
- → [大規模コードベースでの活用戦略](10_large_codebase.md)
