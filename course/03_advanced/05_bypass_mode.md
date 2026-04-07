# Bypass モードとサンドボックス環境

## この記事で学ぶこと
- Bypass モードの仕組みとリスク
- サンドボックス環境（コンテナ・VM）での安全な利用方法
- Auto モードとの使い分け

## 前提知識
- Auto モードの仕組み（→ [Auto モード — 安全な自走モードの使い方](04_auto_mode.md)）
- Docker の基本概念（あると望ましい）

## 本文

### Bypass モードとは

Bypass モード（`bypassPermissions`）は、Claude Code のすべてのパーミッションチェックを**完全に省略**するモードです。Auto モードのような安全分類器も動作しません。すべての操作が、確認なしに即座に実行されます。

CLI では `--dangerously-skip-permissions` フラグで起動します。

```bash
claude --dangerously-skip-permissions
```

デスクトップアプリでは、設定画面で「Bypass permissions」を有効化した上で、モードセレクターから選択します。

### なぜ「dangerously（危険）」と名付けられているのか

この名前は意図的に警告的にされています。Bypass モードでは以下のリスクがあります。

- **ファイルの大量削除**：`rm -rf` のような破壊的コマンドが無確認で実行される
- **機密データの流出**：環境変数や秘密鍵が外部に送信される可能性
- **システムの破壊**：`sudo` コマンドによるシステムレベルの変更
- **プロンプトインジェクション**：外部データに含まれる悪意ある指示が無防備に実行される

**通常のローカル開発環境では、Bypass モードの使用は推奨されません。**

### 適切な利用シーン：サンドボックス環境

Bypass モードが安全に使える唯一のシーンは、**隔離されたサンドボックス環境**です。サンドボックスとは、外部から切り離された安全な実行環境のことです。

具体的には以下のような環境です。

| 環境 | 説明 |
|------|------|
| **Docker コンテナ** | 隔離されたコンテナ内で実行。ホストマシンに影響しない |
| **仮想マシン（VM）** | 独立した OS 環境で実行。壊れても再構築可能 |
| **CI/CD パイプライン** | GitHub Actions など。使い捨ての実行環境 |
| **クラウドサンドボックス** | AWS CodeBuild、Google Cloud Build など |

### Docker でのサンドボックス構築

実際に Docker コンテナ内で Bypass モードを使う設定例を見てみましょう。

**Dockerfile の例：**

```dockerfile
FROM node:20-slim

# Claude Code のインストール
RUN npm install -g @anthropic-ai/claude-code

# 作業ディレクトリの作成
WORKDIR /workspace

# プロジェクトファイルのコピー
COPY . /workspace

# 非 root ユーザーでの実行（セキュリティ対策）
RUN useradd -m claude && chown -R claude:claude /workspace
USER claude
```

**実行方法：**

```bash
# コンテナをビルド
docker build -t claude-sandbox .

# コンテナ内で Bypass モードで実行
docker run --rm -it \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  claude-sandbox \
  claude --dangerously-skip-permissions -p "テストを全て実行して修正して"
```

**安全性のポイント：**
- `--rm` でコンテナは実行後に自動削除される
- ホストマシンのファイルシステムにはアクセスできない
- ネットワークを制限する場合は `--network none` を追加

### CI/CD パイプラインでの利用

GitHub Actions で Bypass モードを使う例です。

```yaml
# .github/workflows/claude-fix.yml
name: Claude Auto Fix
on:
  issue_comment:
    types: [created]

jobs:
  fix:
    if: contains(github.event.comment.body, '@claude fix')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code
      
      - name: Run Claude
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude --dangerously-skip-permissions \
            -p "このPRの問題を修正してください"
      
      - name: Commit and Push
        run: |
          git add .
          git commit -m "fix: Claude による自動修正" || true
          git push
```

この例では、PR にコメントで `@claude fix` と書くと、Claude が自動で問題を修正してコミットします。GitHub Actions の実行環境は使い捨てのため、Bypass モードでも安全です。

### Auto モードとの使い分け

| 観点 | Auto モード | Bypass モード |
|------|------------|--------------|
| **安全分類器** | あり（2 段階チェック） | なし |
| **利用環境** | ローカル開発でも安全 | サンドボックス環境限定 |
| **対応プラン** | Team / Enterprise / API | すべてのプラン |
| **適したタスク** | 日常の開発作業 | CI/CD、自動テスト、バッチ処理 |
| **リスクレベル** | 低〜中 | 高（環境に依存） |

**判断基準：**
- ローカル環境で作業する → **Auto モードまたは acceptEdits モード**を使う
- 隔離された環境で完全自動化したい → **Bypass モード**を使う
- どちらか迷ったら → **Auto モード**を選ぶ（安全側に倒す）

### dontAsk モードという選択肢

Auto モードと Bypass モードの間に、`dontAsk` モードがあります。これは事前に `permissions.allow` で許可したツールのみを自動実行し、それ以外はブロックするモードです。

```json
{
  "permissions": {
    "allow": [
      "Read", "Edit", "Write", "Glob", "Grep",
      "Bash(npm test)", "Bash(npm run build)"
    ]
  }
}
```

この設定で `dontAsk` モードを使えば、許可されたツールだけが自動実行され、それ以外は実行されません。CI/CD で特定の操作だけを自動化したい場合に有効です。

## やってみよう（ハンズオン）

### ステップ 1：Docker コンテナでサンドボックスを作成する

Docker がインストールされている方は、以下を試してみましょう。

```bash
# テスト用のディレクトリを作成
mkdir -p /tmp/claude-sandbox-test
cd /tmp/claude-sandbox-test

# 簡単な Dockerfile を作成
cat > Dockerfile << 'EOF'
FROM node:20-slim
RUN npm install -g @anthropic-ai/claude-code
WORKDIR /workspace
RUN echo '{"name":"test","version":"1.0.0"}' > package.json
RUN echo 'console.log("Hello, World!")' > index.js
EOF

# ビルド
docker build -t claude-sandbox-test .
```

### ステップ 2：コンテナ内で Claude を実行する

```bash
docker run --rm -it \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  claude-sandbox-test \
  claude --dangerously-skip-permissions -p "index.jsにエラーハンドリングを追加して"
```

### ステップ 3：ホストマシンへの影響がないことを確認する

コンテナ内での変更が、ホストマシンのファイルに影響していないことを確認します。

```bash
# ホストマシンのファイルは変更されていないことを確認
ls /tmp/claude-sandbox-test/
```

## まとめ
- Bypass モードはすべてのパーミッションチェックを省略する最も自由度の高いモード
- **通常のローカル環境では使用しないこと**。サンドボックス（Docker、VM、CI/CD）限定
- Docker コンテナや GitHub Actions で完全自動化する際に威力を発揮する
- 迷ったら Auto モードを選び、Bypass モードはサンドボックスが確保できる場合にのみ使う
- dontAsk モードは、許可リストベースの中間的な選択肢

## 次に読む記事
- → [Git / GitHub 連携の基本](06_git_basics.md)
