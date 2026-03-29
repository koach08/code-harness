[English](README.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt.md)

# Code Harness

**El centro de control para editores de codigo IA.**

Gestiona Claude Code, Codex, Aider y Terminal desde una sola aplicacion de escritorio. Cambia entre herramientas de IA al instante, configura tu harness visualmente y aumenta tu productividad de programacion.

![Code Harness](build/icon.png)

## Por que Code Harness?

Las herramientas de codificacion IA como Claude Code, Codex y Aider son potentes, pero cambiar entre ellas es tedioso. Code Harness resuelve esto:

- **Una app, todas las herramientas IA** -- Claude Code, Codex, Aider, Terminal en pestanas
- **Harness Engineering UI** -- Edita CLAUDE.md, configura Hooks, explora Memory visualmente
- **Cambio de proyecto** -- Registra proyectos, cambia de contexto al instante
- **13 idiomas** -- Ingles, japones, chino, coreano, aleman, frances, espanol, portugues, ruso, hindi, turco, vietnamita, indonesio

## Caracteristicas

### Terminal Multi-IA
- Cambia entre Claude Code, Codex, Aider y Terminal con un clic
- Ejecuta multiples sesiones en pestanas simultaneamente
- Arrastra y suelta carpetas para abrirlas en cualquier herramienta IA

### Panel de Harness Engineering
- **Editor CLAUDE.md** -- Crea y edita instrucciones de proyecto para Claude Code directamente en la interfaz grafica
- **Configuracion de Hooks** -- Anade hooks PreToolUse/PostToolUse visualmente (auto-lint, auto-test, etc.)
- **Explorador de Memory** -- Visualiza todos tus archivos de memoria de Claude Code de un vistazo
- **Gestor de proyectos** -- Registra proyectos de uso frecuente para cambio instantaneo

### App Builder
- Escanea proyectos para detectar framework, lenguaje y configuracion de despliegue
- 48+ plantillas de scaffolding (SaaS, Landing Page, E-Commerce, Movil, WordPress, etc.)
- Modos Auto/Collaborate para diferentes niveles de habilidad

### Funcionalidades principales
- Modos de interfaz Simple / Advanced / Builder / Harness
- Persistencia de sesion y recuperacion ante fallos
- Botones de accion rapida (Yes/No/Stop) para aprobaciones de herramientas
- Deteccion de actividad en tiempo real (leyendo, escribiendo, aprobacion necesaria...)
- Registro de trabajo para seguimiento de todos los prompts entre sesiones

## Descarga

Descarga la ultima version para tu plataforma desde [Releases](https://github.com/koach08/code-harness/releases).

| Plataforma | Formato | Arquitectura |
|----------|--------|-------------|
| **macOS** | `.dmg` | Apple Silicon (M1-M4) / Intel |
| **Windows** | `.exe` | x64 |
| **Linux** | `.AppImage` / `.deb` | x64 |

## Requisitos previos

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)
- **Cuenta Anthropic** (plan Pro o clave API)

Opcional:
- **Codex** (`npm install -g @openai/codex`) para el modo Codex
- **Aider** (`pip install aider-chat`) para el modo Aider

> La aplicacion verifica la presencia de Claude Code CLI al iniciar y guia la instalacion si es necesario.

## Compilar desde el codigo fuente

```bash
git clone https://github.com/koach08/code-harness.git
cd code-harness
npm install
npm start
```

Compilar para tu plataforma:

```bash
npm run build:mac    # macOS (.dmg)
npm run build:win    # Windows (.exe)
npm run build:linux  # Linux (.AppImage, .deb)
```

## Atajos de teclado

| Atajo | Accion |
|----------|--------|
| `Cmd+Enter` | Enviar prompt |
| `Cmd+T` | Nueva pestana |
| `Cmd+W` | Cerrar pestana |
| `Cmd+S` | Guardar sesion |
| `Cmd+1-9` | Cambiar pestanas |
| `Cmd+,` | Configuracion |
| `Alt+Up/Down` | Historial de entrada |

## Que es Harness Engineering?

Harness Engineering es la practica de optimizar la capa de configuracion alrededor de las herramientas de codificacion IA para mejorar la calidad de su salida:

- **CLAUDE.md** -- Instrucciones especificas del proyecto que Claude Code lee automaticamente
- **Hooks** -- Comandos shell que se ejecutan en eventos (por ej. auto-lint despues de editar archivos)
- **Memory** -- Conocimiento persistente que se mantiene entre conversaciones

Code Harness te ofrece una interfaz visual para gestionar todo esto -- sin necesidad de editar archivos manualmente.

## Arquitectura

Cada usuario ejecuta las herramientas IA con **sus propias cuentas y claves API**. Code Harness es una capa de interfaz -- no se almacenan ni comparten claves.

## Proyectos relacionados

Este proyecto evoluciono a partir de [claude-code-desktop](https://github.com/koach08/claude-code-desktop).

## Licencia

MIT

## Autor

[Language x AI Lab](https://www.language-smartlearning.com/)
