[English](README.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt.md)

# Code Harness

**O centro de controle para editores de codigo IA.**

Gerencie Claude Code, Codex, Aider e Terminal em um unico aplicativo desktop. Alterne entre ferramentas de IA instantaneamente, configure seu harness visualmente e aumente sua produtividade de programacao.

![Code Harness](build/icon.png)

## Por que Code Harness?

Ferramentas de codificacao IA como Claude Code, Codex e Aider sao poderosas -- mas alternar entre elas e trabalhoso. Code Harness resolve isso:

- **Um app, todas as ferramentas IA** -- Claude Code, Codex, Aider, Terminal em abas
- **Harness Engineering UI** -- Edite CLAUDE.md, configure Hooks, navegue pela Memory visualmente
- **Troca de projeto** -- Registre projetos, troque de contexto instantaneamente
- **13 idiomas** -- Ingles, japones, chines, coreano, alemao, frances, espanhol, portugues, russo, hindi, turco, vietnamita, indonesio

## Funcionalidades

### Terminal Multi-IA
- Alterne entre Claude Code, Codex, Aider e Terminal com um clique
- Execute multiplas sessoes em abas simultaneamente
- Arraste e solte pastas para abrir em qualquer ferramenta IA

### Painel Harness Engineering
- **Editor CLAUDE.md** -- Crie e edite instrucoes de projeto para Claude Code diretamente na interface grafica
- **Configuracao de Hooks** -- Adicione hooks PreToolUse/PostToolUse visualmente (auto-lint, auto-test, etc.)
- **Navegador de Memory** -- Visualize todos os seus arquivos de memoria do Claude Code de uma so vez
- **Gerenciador de projetos** -- Registre projetos de uso frequente para troca instantanea

### App Builder
- Escaneie projetos para detectar framework, linguagem e configuracao de deploy
- 48+ templates de scaffolding (SaaS, Landing Page, E-Commerce, Mobile, WordPress, etc.)
- Modos Auto/Collaborate para diferentes niveis de habilidade

### Funcionalidades principais
- Modos de interface Simple / Advanced / Builder / Harness
- Persistencia de sessao e recuperacao de falhas
- Botoes de acao rapida (Yes/No/Stop) para aprovacoes de ferramentas
- Deteccao de atividade em tempo real (lendo, escrevendo, aprovacao necessaria...)
- Log de trabalho para rastreamento de todos os prompts entre sessoes

## Download

Baixe a versao mais recente para sua plataforma em [Releases](https://github.com/koach08/code-harness/releases).

| Plataforma | Formato | Arquitetura |
|----------|--------|-------------|
| **macOS** | `.dmg` | Apple Silicon (M1-M4) / Intel |
| **Windows** | `.exe` | x64 |
| **Linux** | `.AppImage` / `.deb` | x64 |

## Pre-requisitos

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)
- **Conta Anthropic** (plano Pro ou chave API)

Opcional:
- **Codex** (`npm install -g @openai/codex`) para o modo Codex
- **Aider** (`pip install aider-chat`) para o modo Aider

> O aplicativo verifica a presenca do Claude Code CLI na inicializacao e orienta a instalacao se necessario.

## Compilar a partir do codigo-fonte

```bash
git clone https://github.com/koach08/code-harness.git
cd code-harness
npm install
npm start
```

Compilar para sua plataforma:

```bash
npm run build:mac    # macOS (.dmg)
npm run build:win    # Windows (.exe)
npm run build:linux  # Linux (.AppImage, .deb)
```

## Atalhos de teclado

| Atalho | Acao |
|----------|--------|
| `Cmd+Enter` | Enviar prompt |
| `Cmd+T` | Nova aba |
| `Cmd+W` | Fechar aba |
| `Cmd+S` | Salvar sessao |
| `Cmd+1-9` | Alternar abas |
| `Cmd+,` | Configuracoes |
| `Alt+Up/Down` | Historico de entrada |

## O que e Harness Engineering?

Harness Engineering e a pratica de otimizar a camada de configuracao em torno das ferramentas de codificacao IA para melhorar a qualidade da saida:

- **CLAUDE.md** -- Instrucoes especificas do projeto que o Claude Code le automaticamente
- **Hooks** -- Comandos shell executados em eventos (por ex. auto-lint apos edicao de arquivos)
- **Memory** -- Conhecimento persistente que se mantem entre conversas

Code Harness oferece uma interface visual para gerenciar tudo isso -- sem necessidade de edicao manual de arquivos.

## Arquitetura

Cada usuario executa as ferramentas IA com **suas proprias contas e chaves API**. Code Harness e uma camada de interface -- nenhuma chave e armazenada ou compartilhada.

## Projetos relacionados

Este projeto evoluiu a partir do [claude-code-desktop](https://github.com/koach08/claude-code-desktop).

## Licenca

MIT

## Autor

[Language x AI Lab](https://www.language-smartlearning.com/)
