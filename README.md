[English](README.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt.md)

# Code Harness

**The control center for AI code editors.**

Manage Claude Code, Codex, Aider, and Terminal from one desktop app. Switch between AI tools instantly, configure your AI harness visually, and boost your coding productivity.

![Code Harness](build/icon.png)

## Why Code Harness?

AI coding tools like Claude Code, Codex, and Aider are powerful — but switching between them is painful. Code Harness solves this:

- **One app, all AI tools** — Claude Code, Codex, Aider, Terminal in tabs
- **Harness Engineering UI** — Edit CLAUDE.md, configure Hooks, browse Memory visually
- **Project switching** — Register projects, switch context instantly
- **13 languages** — English, Japanese, Chinese, Korean, German, French, Spanish, Portuguese, Russian, Hindi, Turkish, Vietnamese, Indonesian

## Features

### Multi-AI Terminal
- Switch between Claude Code, Codex, Aider, and Terminal with one click
- Run multiple sessions in tabs simultaneously
- Drag & drop folders to open in any AI tool

### Harness Engineering Panel
- **CLAUDE.md Editor** — Create and edit project instructions for Claude Code right in the GUI
- **Hooks Config** — Add PreToolUse/PostToolUse hooks visually (auto-lint, auto-test, etc.)
- **Memory Browser** — View all your Claude Code memory files at a glance
- **Project Manager** — Register frequently-used projects for instant switching

### App Builder
- Scan projects to detect framework, language, and deployment config
- 48+ scaffolding templates (SaaS, Landing Page, E-Commerce, Mobile, WordPress, etc.)
- Auto/Collaborate modes for different skill levels

### Core
- Simple / Advanced / Builder / Harness UI modes
- Session persistence & crash recovery
- Quick action buttons (Yes/No/Stop) for tool approvals
- Real-time activity detection (reading, writing, approval needed...)
- Work log for tracking all prompts across sessions

## Download

Download the latest release for your platform from [Releases](https://github.com/koach08/code-harness/releases).

| Platform | Format | Architecture |
|----------|--------|-------------|
| **macOS** | `.dmg` | Apple Silicon (M1-M4) / Intel |
| **Windows** | `.exe` | x64 |
| **Linux** | `.AppImage` / `.deb` | x64 |

## Prerequisites

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)
- **Anthropic account** (Pro plan or API key)

Optional:
- **Codex** (`npm install -g @openai/codex`) for Codex mode
- **Aider** (`pip install aider-chat`) for Aider mode

> The app checks for Claude Code CLI on startup and guides installation if missing.

## Build from Source

```bash
git clone https://github.com/koach08/code-harness.git
cd code-harness
npm install
npm start
```

Build for your platform:

```bash
npm run build:mac    # macOS (.dmg)
npm run build:win    # Windows (.exe)
npm run build:linux  # Linux (.AppImage, .deb)
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Enter` | Send prompt |
| `Cmd+T` | New tab |
| `Cmd+W` | Close tab |
| `Cmd+S` | Save session |
| `Cmd+1-9` | Switch tabs |
| `Cmd+,` | Settings |
| `Alt+Up/Down` | Input history |

## What is Harness Engineering?

Harness Engineering is the practice of optimizing the configuration layer around AI coding tools to improve their output quality:

- **CLAUDE.md** — Project-specific instructions that Claude Code reads automatically
- **Hooks** — Shell commands that run on events (e.g., auto-lint after file edits)
- **Memory** — Persistent knowledge that carries across conversations

Code Harness gives you a visual interface to manage all of these — no manual file editing required.

## Architecture

Each user runs AI tools with **their own accounts and API keys**. Code Harness is a UI layer — no keys are stored or shared.

## Related

This project evolved from [claude-code-desktop](https://github.com/koach08/claude-code-desktop).

## License

MIT

## Author

[Language x AI Lab](https://www.language-smartlearning.com/)
