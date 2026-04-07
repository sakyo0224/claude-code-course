# GitHub Actions 連携

## この記事で学ぶこと
- GitHub Actions から Claude Code を呼び出す方法
- PR コメントに応答する CI 統合の構築
- 自動コードレビューや自動修正のワークフロー設定

## 前提知識
- PR 作成とコードレビュー自動化（→ [PR 作成とコードレビュー自動化](07_github_pr.md)）
- GitHub Actions の基本概念（ワークフロー、ジョブ、ステップ）

## 本文

### GitHub Actions × Claude Code の可能性

GitHub Actions と Claude Code を組み合わせると、以下のような自動化が実現できます。

- **PR が作成されたら自動でコードレビュー**
- **PR コメントで `@claude` と書くと修正を実行**
- **CI が失敗したら自動で原因分析と修正提案**
- **定期的なコード品質チェック**

これらはすべて、GitHub Actions の使い捨て実行環境で動作するため、Bypass モードを安全に使用できます。

### セットアップ方法

Claude Code には、GitHub Actions の設定を簡単に行うコマンドが用意されています。

```
/install-github-app
```

このコマンドを実行すると、以下が自動で設定されます。

1. GitHub App のインストール
2. リポジトリへのアクセス権の設定
3. ワークフローファイルの生成
4. シークレット（API キー）の設定

### 手動でのワークフロー設定

自動セットアップを使わない場合は、以下の手順で手動設定できます。

**ステップ 1：API キーをシークレットに登録**

GitHub リポジトリの Settings → Secrets and variables → Actions で、`ANTHROPIC_API_KEY` を登録します。

**ステップ 2：ワークフローファイルの作成**

#### パターン A：PR コメント応答型

PR にコメントで指示すると Claude Code が自動で作業するワークフローです。

```yaml
# .github/workflows/claude-pr-assistant.yml
name: Claude PR Assistant
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  respond:
    if: |
      (github.event.issue.pull_request || github.event.pull_request) &&
      contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref || github.head_ref }}
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code
      
      - name: Extract comment
        id: comment
        run: echo "body=${{ github.event.comment.body }}" >> $GITHUB_OUTPUT
      
      - name: Run Claude
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude --dangerously-skip-permissions \
            -p "${{ steps.comment.outputs.body }}"
      
      - name: Commit and push changes
        run: |
          git config user.name "claude-bot"
          git config user.email "claude-bot@users.noreply.github.com"
          git add -A
          git commit -m "fix: Claude による自動修正" || echo "変更なし"
          git push || echo "プッシュ不要"
```

#### パターン B：PR 作成時の自動レビュー

PR が作成されると自動でコードレビューを実行するワークフローです。

```yaml
# .github/workflows/claude-review.yml
name: Claude Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code
      
      - name: Get diff
        id: diff
        run: |
          DIFF=$(git diff origin/main...HEAD)
          echo "diff<<EOF" >> $GITHUB_OUTPUT
          echo "$DIFF" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT
      
      - name: Run Claude Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude --dangerously-skip-permissions \
            -p "以下のdiffをレビューしてください。バグ、セキュリティ問題、パフォーマンス問題を指摘してください。" \
            --output-format json > review.json
      
      - name: Post review comment
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          REVIEW=$(cat review.json | jq -r '.result // .message // "レビュー完了"')
          gh pr comment ${{ github.event.pull_request.number }} --body "$REVIEW"
```

#### パターン C：CI 失敗時の自動修正

```yaml
# .github/workflows/claude-auto-fix.yml
name: Claude Auto Fix
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

jobs:
  fix:
    if: github.event.workflow_run.conclusion == 'failure'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_branch }}
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code
      
      - name: Get CI logs
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh run view ${{ github.event.workflow_run.id }} --log-failed > ci-logs.txt
      
      - name: Run Claude Fix
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude --dangerously-skip-permissions \
            -p "CI が失敗しました。ci-logs.txt のログを確認して問題を修正してください"
      
      - name: Commit and push
        run: |
          git config user.name "claude-bot"
          git config user.email "claude-bot@users.noreply.github.com"
          git add -A
          git commit -m "fix: CI失敗の自動修正 by Claude" || echo "変更なし"
          git push || echo "プッシュ不要"
```

### コスト管理の注意点

GitHub Actions で Claude Code を使う場合、API の使用量に注意が必要です。

- **トリガーの制限**：すべての PR コメントではなく、`@claude` を含むコメントのみをトリガーにする
- **実行時間の制限**：ワークフローにタイムアウトを設定する
- **ブランチの制限**：`main` ブランチへの PR のみを対象にするなど、スコープを絞る

```yaml
jobs:
  review:
    timeout-minutes: 10  # 10分でタイムアウト
```

### セキュリティ上の考慮事項

- `ANTHROPIC_API_KEY` は必ず GitHub Secrets で管理し、ワークフローファイルに直接記述しない
- フォークからの PR に対しては Claude Code を実行しない（シークレットが漏洩するリスク）
- 実行結果をコメントとして投稿する場合、機密情報が含まれていないか確認する

## やってみよう（ハンズオン）

### ステップ 1：GitHub App をインストールする

```
/install-github-app
```

### ステップ 2：ワークフローファイルを作成する

上記のパターン A（PR コメント応答型）のワークフローファイルを `.github/workflows/` に作成してください。

### ステップ 3：テスト PR を作成して動作確認する

1. テスト用のブランチで変更を加える
2. PR を作成する
3. PR にコメントで `@claude このコードにテストを追加して` と書く
4. GitHub Actions が起動し、Claude Code が自動で作業することを確認

## まとめ
- GitHub Actions × Claude Code で、PR のライフサイクルを自動化できる
- `/install-github-app` で簡単にセットアップ可能
- PR コメント応答、自動レビュー、CI 失敗の自動修正など、用途に応じたパターンがある
- コスト管理とセキュリティに注意し、トリガー条件を適切に設定する
- GitHub Actions は使い捨て環境のため、Bypass モードを安全に使用できる

## 次に読む記事
- → [MCP サーバー連携 入門](09_mcp_intro.md)
