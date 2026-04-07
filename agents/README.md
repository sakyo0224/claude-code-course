# マルチエージェント記事制作チーム

## チーム構成

```
Orchestrator（指揮官）
├── 01_researcher.md   　調査・ファクト収集
├── 02_structurer.md   　構成・アウトライン設計
├── 03_writer.md         本文執筆
├── 04_fact_checker.md 　事実確認
└── 05_editor.md         文体・表現の仕上げ
```

## 使い方

Orchestratorに以下のように頼むだけ：

```
agents/orchestrator.md の指示に従って、
「ClaudeCodeセミナー告知記事」を制作してください。
対象読者：ビジネスパーソン、文字数：800字、トーン：親しみやすく
```

## ワークフロー

```
[指示]
  ↓
Orchestrator（全体管理）
  ↓ 並列実行
  ├─→ Researcher（調査）────────┐
  └─→ Structurer（構成案）──────┤
                                  ↓
                              Writer（執筆）
                                  ↓
                          Fact Checker（検証）
                                  ↓
                            Editor（仕上げ）
                                  ↓
                            [完成記事]
```
