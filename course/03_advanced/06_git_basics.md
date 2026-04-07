# Git / GitHub 連携の基本

## この記事で学ぶこと
- Claude Code と Git の統合がもたらすメリット
- 日常的な Git 操作を Claude Code で効率化する方法
- ブランチ戦略と安全な運用パターン

## 前提知識
- Git の基本概念（commit、branch、push、pull の意味がわかること）
- GitHub アカウントを持っていること
- Claude Code の基本操作

## 本文

### Claude Code と Git の関係

Claude Code は Git と深く統合されています。単にコマンドを代行するだけでなく、リポジトリの変更履歴を理解し、文脈に応じた Git 操作を行えます。

主な統合ポイントは以下の通りです。

- **自動的なブランチ管理**：作業内容に応じたブランチ名を提案
- **コミットメッセージの生成**：変更内容を分析して適切なメッセージを作成
- **差分の理解**：`git diff` の結果を解釈して、変更の意図を把握
- **コンフリクトの解決**：マージコンフリクトの内容を理解して解決を提案
- **PR の作成とレビュー**：変更のサマリーを作成して PR を自動作成

### 基本的な Git 操作の自動化

Claude Code に自然言語で Git 操作を指示できます。

**コミットの作成：**
```
この変更をコミットして。メッセージは変更内容に合わせて作成して
```

Claude は `git diff` の内容を分析し、適切なコミットメッセージを生成してコミットします。

**ブランチの作成と切り替え：**
```
ユーザー認証機能を追加する作業ブランチを作って
```

`feature/add-user-authentication` のような適切なブランチ名を自動で決定します。

**変更の確認：**
```
最近の変更内容を要約して
```

`git log` と `git diff` を組み合わせて、わかりやすい要約を作成します。

### settings.json での Git パーミッション設定

安全に Git 操作を自動化するための推奨設定です。

```json
{
  "permissions": {
    "allow": [
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git branch *)",
      "Bash(git checkout *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git push origin HEAD)",
      "Bash(git pull *)",
      "Bash(git stash *)",
      "Bash(git fetch *)"
    ],
    "deny": [
      "Bash(git push --force *)",
      "Bash(git push origin main)",
      "Bash(git push origin master)",
      "Bash(git reset --hard *)",
      "Bash(git clean -f *)",
      "Bash(git branch -D *)"
    ]
  }
}
```

**allow のポイント：**
- `git push origin HEAD` は現在のブランチへのプッシュのみ許可しています
- 読み取り系のコマンド（status、diff、log）は自由に許可して問題ありません

**deny のポイント：**
- `--force` プッシュは履歴を破壊するため拒否
- `main`/`master` への直接プッシュは拒否（PR 経由を強制）
- `--hard` リセットやブランチの強制削除も拒否

### ブランチ戦略と Claude Code

Claude Code と組み合わせて効果的なブランチ戦略を紹介します。

**推奨フロー：**

```
main（保護されたブランチ）
  └── feature/xxx（作業ブランチ）← Claude Code はここで作業
        └── PR → コードレビュー → main にマージ
```

**作業の始め方：**
```
mainブランチから新しいブランチを切って、ログイン画面のバグ修正を始めて
```

Claude Code は以下を自動で行います。
1. `git checkout main && git pull` で最新を取得
2. `git checkout -b fix/login-screen-bug` でブランチ作成
3. 作業開始

### マージコンフリクトの解決

Claude Code はコンフリクトの内容を理解して解決を提案できます。

```
マージコンフリクトを解決して。両方の変更を残す方向でお願い
```

Claude は以下の手順で解決します。
1. コンフリクトが発生しているファイルを特定
2. 両方の変更内容を理解
3. 適切にマージして、コンフリクトマーカー（`<<<<<<<` など）を除去
4. 解決結果をコミット

### GitHub 認証の設定

Claude Code で GitHub 操作（PR 作成など）を行うには、`gh` CLI（GitHub CLI）の認証が必要です。

```bash
# GitHub CLI のインストール（まだの場合）
# macOS
brew install gh

# Windows
winget install --id GitHub.cli

# GitHub にログイン
gh auth login
```

認証が完了すると、Claude Code から `gh` コマンドを使った GitHub 操作が可能になります。

### Git 操作のベストプラクティス

1. **こまめにコミットする**：Claude Code に「区切りのいいところでコミットして」と指示しておくと、作業の途中経過が保存されます
2. **作業ブランチを必ず使う**：main への直接コミットは deny で禁止しましょう
3. **コミットメッセージは Claude に任せる**：変更内容を最もよく理解しているのは、変更を行った Claude 自身です
4. **`git diff` で確認する習慣**：コミット前に `/diff` コマンドで変更内容を確認しましょう

## やってみよう（ハンズオン）

### ステップ 1：Git パーミッションを設定する

上記の settings.json の設定を `.claude/settings.json` に追加してください。

### ステップ 2：Claude Code でブランチを作成してコミットする

```
テスト用のブランチを作成して、READMEにプロジェクトの説明を追加してコミットして
```

### ステップ 3：変更履歴を確認する

```
今日の変更履歴を要約して
```

Claude が `git log` を使って変更履歴をわかりやすく要約してくれることを確認してください。

## まとめ
- Claude Code は Git と深く統合されており、自然言語で Git 操作を指示できる
- settings.json で安全な Git 操作のみを許可し、危険な操作をブロックする
- main への直接プッシュや force push は deny で禁止するのが基本
- 作業ブランチ + PR のフローが最も安全で効果的
- コミットメッセージの生成やコンフリクトの解決も Claude Code に任せられる

## 次に読む記事
- → [PR 作成とコードレビュー自動化](07_github_pr.md)
