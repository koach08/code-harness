[English](README.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt.md)

# Code Harness

**AIコードエディタのコントロールセンター。**

Claude Code、Codex、Aider、ターミナルを1つのデスクトップアプリで管理。AIツールを瞬時に切り替え、ハーネス設定をビジュアルに行い、コーディングの生産性を高めましょう。

![Code Harness](build/icon.png)

## なぜ Code Harness？

Claude Code、Codex、Aider などのAIコーディングツールは強力ですが、ツール間の切り替えが面倒です。Code Harness がこの問題を解決します：

- **1つのアプリで全AIツール** — Claude Code、Codex、Aider、ターミナルをタブで管理
- **Harness Engineering UI** — CLAUDE.md の編集、Hooks の設定、Memory の閲覧をビジュアルに
- **プロジェクト切り替え** — プロジェクトを登録して、コンテキストを瞬時に切り替え
- **13言語対応** — 英語、日本語、中国語、韓国語、ドイツ語、フランス語、スペイン語、ポルトガル語、ロシア語、ヒンディー語、トルコ語、ベトナム語、インドネシア語

## 機能

### マルチAIターミナル
- Claude Code、Codex、Aider、ターミナルをワンクリックで切り替え
- 複数セッションをタブで同時に実行
- フォルダをドラッグ＆ドロップして任意のAIツールで開く

### Harness Engineering パネル
- **CLAUDE.md エディタ** — Claude Code 用のプロジェクト指示をGUIで作成・編集
- **Hooks 設定** — PreToolUse/PostToolUse フックをビジュアルに追加（自動lint、自動テストなど）
- **Memory ブラウザ** — Claude Code のメモリファイルを一覧表示
- **プロジェクトマネージャー** — よく使うプロジェクトを登録して瞬時に切り替え

### App Builder
- プロジェクトをスキャンしてフレームワーク、言語、デプロイ設定を検出
- 48以上のスキャフォールディングテンプレート（SaaS、ランディングページ、EC、モバイル、WordPressなど）
- スキルレベルに応じたAuto/Collaborateモード

### コア機能
- Simple / Advanced / Builder / Harness UIモード
- セッション永続化＆クラッシュリカバリ
- ツール承認用のクイックアクションボタン（Yes/No/Stop）
- リアルタイムアクティビティ検出（読み取り中、書き込み中、承認待ち...）
- セッション横断のプロンプト追跡ワークログ

## ダウンロード

お使いのプラットフォーム向けの最新リリースを [Releases](https://github.com/koach08/code-harness/releases) からダウンロードしてください。

| プラットフォーム | フォーマット | アーキテクチャ |
|----------|--------|-------------|
| **macOS** | `.dmg` | Apple Silicon (M1-M4) / Intel |
| **Windows** | `.exe` | x64 |
| **Linux** | `.AppImage` / `.deb` | x64 |

## 前提条件

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)
- **Anthropic アカウント** (Pro プランまたはAPIキー)

オプション：
- **Codex** (`npm install -g @openai/codex`) Codex モード用
- **Aider** (`pip install aider-chat`) Aider モード用

> アプリ起動時に Claude Code CLI の存在を確認し、未インストールの場合はインストールをガイドします。

## ソースからビルド

```bash
git clone https://github.com/koach08/code-harness.git
cd code-harness
npm install
npm start
```

プラットフォーム別ビルド：

```bash
npm run build:mac    # macOS (.dmg)
npm run build:win    # Windows (.exe)
npm run build:linux  # Linux (.AppImage, .deb)
```

## キーボードショートカット

| ショートカット | アクション |
|----------|--------|
| `Cmd+Enter` | プロンプト送信 |
| `Cmd+T` | 新しいタブ |
| `Cmd+W` | タブを閉じる |
| `Cmd+S` | セッション保存 |
| `Cmd+1-9` | タブ切り替え |
| `Cmd+,` | 設定 |
| `Alt+Up/Down` | 入力履歴 |

## Harness Engineering とは？

Harness Engineering とは、AIコーディングツールの設定レイヤーを最適化し、出力品質を向上させるプラクティスです：

- **CLAUDE.md** — Claude Code が自動的に読み込むプロジェクト固有の指示
- **Hooks** — イベント発生時に実行されるシェルコマンド（例：ファイル編集後の自動lint）
- **Memory** — 会話をまたいで持続するナレッジ

Code Harness は、これらすべてをビジュアルに管理できるインターフェースを提供します。手動でのファイル編集は不要です。

## 無料版 vs Pro

| 機能 | 無料 | Pro |
|------|------|-----|
| Claude Code / Codex / Terminal | o | o |
| Simple / Advanced UI | o | o |
| セッション永続化 | o | o |
| マルチタブ | 3タブまで | 無制限 |
| Aider モード | - | o |
| Builder テンプレート | 基本5種 | 全40+種 |
| Hooks 編集 | 閲覧のみ | 追加・削除 |
| Memory 編集 | 閲覧のみ | 編集・削除 |
| Projects | 3件まで | 無制限 |

Pro ライセンスは [こちら](https://www.language-smartlearning.com/) から。

## アーキテクチャ

各ユーザーは**自分のアカウントとAPIキー**でAIツールを実行します。Code Harness はUIレイヤーであり、キーの保存や共有は行いません。

## 関連

このプロジェクトは [claude-code-desktop](https://github.com/koach08/claude-code-desktop) から発展しました。

## ライセンス

MIT

## 作者

[Language x AI Lab](https://www.language-smartlearning.com/)
