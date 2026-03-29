[English](README.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt.md)

# Code Harness

**Das Kontrollzentrum fuer AI-Code-Editoren.**

Verwalten Sie Claude Code, Codex, Aider und Terminal in einer Desktop-App. Wechseln Sie sofort zwischen AI-Tools, konfigurieren Sie Ihr AI-Harness visuell und steigern Sie Ihre Coding-Produktivitaet.

![Code Harness](build/icon.png)

## Warum Code Harness?

AI-Coding-Tools wie Claude Code, Codex und Aider sind leistungsstark -- aber der Wechsel zwischen ihnen ist muehsam. Code Harness loest dieses Problem:

- **Eine App, alle AI-Tools** -- Claude Code, Codex, Aider, Terminal in Tabs
- **Harness Engineering UI** -- CLAUDE.md bearbeiten, Hooks konfigurieren, Memory visuell durchsuchen
- **Projektwechsel** -- Projekte registrieren, Kontext sofort wechseln
- **13 Sprachen** -- Englisch, Japanisch, Chinesisch, Koreanisch, Deutsch, Franzoesisch, Spanisch, Portugiesisch, Russisch, Hindi, Tuerkisch, Vietnamesisch, Indonesisch

## Funktionen

### Multi-AI-Terminal
- Wechseln Sie mit einem Klick zwischen Claude Code, Codex, Aider und Terminal
- Fuehren Sie mehrere Sitzungen gleichzeitig in Tabs aus
- Ordner per Drag & Drop in jedem AI-Tool oeffnen

### Harness Engineering Panel
- **CLAUDE.md Editor** -- Projektanweisungen fuer Claude Code direkt in der GUI erstellen und bearbeiten
- **Hooks-Konfiguration** -- PreToolUse/PostToolUse-Hooks visuell hinzufuegen (Auto-Lint, Auto-Test usw.)
- **Memory Browser** -- Alle Claude Code Memory-Dateien auf einen Blick anzeigen
- **Projektmanager** -- Haeufig verwendete Projekte registrieren fuer sofortigen Wechsel

### App Builder
- Projekte scannen, um Framework, Sprache und Deployment-Konfiguration zu erkennen
- 48+ Scaffolding-Vorlagen (SaaS, Landing Page, E-Commerce, Mobile, WordPress usw.)
- Auto/Collaborate-Modi fuer verschiedene Erfahrungsstufen

### Kernfunktionen
- Simple / Advanced / Builder / Harness UI-Modi
- Sitzungspersistenz & Crash-Recovery
- Schnellaktions-Buttons (Yes/No/Stop) fuer Tool-Genehmigungen
- Echtzeit-Aktivitaetserkennung (Lesen, Schreiben, Genehmigung erforderlich...)
- Arbeitsprotokoll zur Verfolgung aller Prompts ueber Sitzungen hinweg

## Download

Laden Sie die neueste Version fuer Ihre Plattform von [Releases](https://github.com/koach08/code-harness/releases) herunter.

| Plattform | Format | Architektur |
|----------|--------|-------------|
| **macOS** | `.dmg` | Apple Silicon (M1-M4) / Intel |
| **Windows** | `.exe` | x64 |
| **Linux** | `.AppImage` / `.deb` | x64 |

## Voraussetzungen

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)
- **Anthropic-Konto** (Pro-Plan oder API-Schluessel)

Optional:
- **Codex** (`npm install -g @openai/codex`) fuer den Codex-Modus
- **Aider** (`pip install aider-chat`) fuer den Aider-Modus

> Die App prueft beim Start, ob die Claude Code CLI installiert ist, und leitet bei Bedarf die Installation an.

## Aus dem Quellcode bauen

```bash
git clone https://github.com/koach08/code-harness.git
cd code-harness
npm install
npm start
```

Fuer Ihre Plattform bauen:

```bash
npm run build:mac    # macOS (.dmg)
npm run build:win    # Windows (.exe)
npm run build:linux  # Linux (.AppImage, .deb)
```

## Tastenkuerzel

| Tastenkuerzel | Aktion |
|----------|--------|
| `Cmd+Enter` | Prompt senden |
| `Cmd+T` | Neuer Tab |
| `Cmd+W` | Tab schliessen |
| `Cmd+S` | Sitzung speichern |
| `Cmd+1-9` | Tabs wechseln |
| `Cmd+,` | Einstellungen |
| `Alt+Up/Down` | Eingabeverlauf |

## Was ist Harness Engineering?

Harness Engineering ist die Praxis der Optimierung der Konfigurationsschicht rund um AI-Coding-Tools zur Verbesserung der Ausgabequalitaet:

- **CLAUDE.md** -- Projektspezifische Anweisungen, die Claude Code automatisch liest
- **Hooks** -- Shell-Befehle, die bei Ereignissen ausgefuehrt werden (z.B. Auto-Lint nach Dateibearbeitungen)
- **Memory** -- Persistentes Wissen, das ueber Konversationen hinweg erhalten bleibt

Code Harness bietet Ihnen eine visuelle Oberflaeche zur Verwaltung all dieser Aspekte -- kein manuelles Bearbeiten von Dateien erforderlich.

## Architektur

Jeder Benutzer fuehrt AI-Tools mit **eigenen Konten und API-Schluesseln** aus. Code Harness ist eine UI-Schicht -- es werden keine Schluessel gespeichert oder geteilt.

## Verwandte Projekte

Dieses Projekt ist aus [claude-code-desktop](https://github.com/koach08/claude-code-desktop) hervorgegangen.

## Lizenz

MIT

## Autor

[Language x AI Lab](https://www.language-smartlearning.com/)
