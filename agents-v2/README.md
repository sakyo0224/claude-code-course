# マルチエージェント発表資料制作チーム

## 成果物（2段階）

```
第1段階 → Notion/Obsidian 用の資料（.md）  読む・共有する・後から参照する
第2段階 → スライド構成（.md）              発表で映す・話す
```

## チーム構成

```
Orchestrator（指揮官）
├── 01_researcher.md        調査・ファクト収集
├── 02_architect.md         全体設計（時間配分・スライド枚数・構成）
├── 03_doc_writer.md        Notion/Obsidian 資料の作成 ← 第1段階の成果物
├── 04_demo_planner.md      演習・デモ手順の設計
├── 05_fact_checker.md      事実確認
├── 06_slide_designer.md    スライド構成への変換 ← 第2段階の成果物
└── 07_speaker_notes.md     トーク台本の作成
```

## 使い方

Orchestrator に以下のように頼むだけ：

```
agents-v2/orchestrator.md の指示に従って、
「Claude Code はじめてガイド」の発表資料を制作してください。
対象読者：AI初心者のビジネスパーソン、発表時間：65分
```

## ワークフロー

```
[指示]
  ↓
Orchestrator（全体管理）
  ↓ 並列実行
  ├─→ Researcher（調査）─────────┐
  └─→ Architect（全体設計）──────┤
                                  ↓
                          Doc Writer（資料作成）
                                  ↓ 並列実行
                          ├─→ Demo Planner（演習設計）
                          └─→ Fact Checker（検証）
                                  ↓
                      ★ 第1段階の成果物（Notion/Obsidian 資料）
                                  ↓
                        Slide Designer（スライド変換）
                                  ↓
                        Speaker Notes（トーク台本）
                                  ↓
                      ★ 第2段階の成果物（スライド＋台本）
```
