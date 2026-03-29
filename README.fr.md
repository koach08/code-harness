[English](README.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt.md)

# Code Harness

**Le centre de controle pour les editeurs de code IA.**

Gerez Claude Code, Codex, Aider et Terminal depuis une seule application de bureau. Basculez instantanement entre les outils IA, configurez votre harness visuellement et boostez votre productivite de codage.

![Code Harness](build/icon.png)

## Pourquoi Code Harness ?

Les outils de codage IA comme Claude Code, Codex et Aider sont puissants, mais passer de l'un a l'autre est penible. Code Harness resout ce probleme :

- **Une app, tous les outils IA** -- Claude Code, Codex, Aider, Terminal en onglets
- **Harness Engineering UI** -- Editez CLAUDE.md, configurez les Hooks, parcourez la Memory visuellement
- **Changement de projet** -- Enregistrez vos projets, changez de contexte instantanement
- **13 langues** -- Anglais, japonais, chinois, coreen, allemand, francais, espagnol, portugais, russe, hindi, turc, vietnamien, indonesien

## Fonctionnalites

### Terminal Multi-IA
- Basculez entre Claude Code, Codex, Aider et Terminal en un clic
- Executez plusieurs sessions simultanement dans des onglets
- Glissez-deposez des dossiers pour les ouvrir dans n'importe quel outil IA

### Panneau Harness Engineering
- **Editeur CLAUDE.md** -- Creez et editez les instructions de projet pour Claude Code directement dans l'interface graphique
- **Configuration des Hooks** -- Ajoutez visuellement des hooks PreToolUse/PostToolUse (auto-lint, auto-test, etc.)
- **Navigateur Memory** -- Visualisez tous vos fichiers de memoire Claude Code en un coup d'oeil
- **Gestionnaire de projets** -- Enregistrez les projets frequemment utilises pour un changement instantane

### App Builder
- Scannez les projets pour detecter le framework, le langage et la configuration de deploiement
- 48+ modeles de scaffolding (SaaS, Landing Page, E-Commerce, Mobile, WordPress, etc.)
- Modes Auto/Collaborate pour differents niveaux de competence

### Fonctionnalites principales
- Modes d'interface Simple / Advanced / Builder / Harness
- Persistance de session et recuperation apres crash
- Boutons d'action rapide (Yes/No/Stop) pour les approbations d'outils
- Detection d'activite en temps reel (lecture, ecriture, approbation requise...)
- Journal de travail pour le suivi de tous les prompts a travers les sessions

## Telechargement

Telechargez la derniere version pour votre plateforme depuis [Releases](https://github.com/koach08/code-harness/releases).

| Plateforme | Format | Architecture |
|----------|--------|-------------|
| **macOS** | `.dmg` | Apple Silicon (M1-M4) / Intel |
| **Windows** | `.exe` | x64 |
| **Linux** | `.AppImage` / `.deb` | x64 |

## Prerequis

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)
- **Compte Anthropic** (plan Pro ou cle API)

Optionnel :
- **Codex** (`npm install -g @openai/codex`) pour le mode Codex
- **Aider** (`pip install aider-chat`) pour le mode Aider

> L'application verifie la presence de Claude Code CLI au demarrage et guide l'installation si necessaire.

## Compiler depuis les sources

```bash
git clone https://github.com/koach08/code-harness.git
cd code-harness
npm install
npm start
```

Compiler pour votre plateforme :

```bash
npm run build:mac    # macOS (.dmg)
npm run build:win    # Windows (.exe)
npm run build:linux  # Linux (.AppImage, .deb)
```

## Raccourcis clavier

| Raccourci | Action |
|----------|--------|
| `Cmd+Enter` | Envoyer le prompt |
| `Cmd+T` | Nouvel onglet |
| `Cmd+W` | Fermer l'onglet |
| `Cmd+S` | Sauvegarder la session |
| `Cmd+1-9` | Changer d'onglet |
| `Cmd+,` | Parametres |
| `Alt+Up/Down` | Historique de saisie |

## Qu'est-ce que le Harness Engineering ?

Le Harness Engineering est la pratique d'optimisation de la couche de configuration autour des outils de codage IA pour ameliorer la qualite de leur sortie :

- **CLAUDE.md** -- Instructions specifiques au projet que Claude Code lit automatiquement
- **Hooks** -- Commandes shell executees lors d'evenements (par ex. auto-lint apres l'edition de fichiers)
- **Memory** -- Connaissances persistantes qui se transmettent d'une conversation a l'autre

Code Harness vous offre une interface visuelle pour gerer tout cela -- aucune edition manuelle de fichiers requise.

## Architecture

Chaque utilisateur execute les outils IA avec **ses propres comptes et cles API**. Code Harness est une couche d'interface -- aucune cle n'est stockee ou partagee.

## Projets lies

Ce projet a evolue a partir de [claude-code-desktop](https://github.com/koach08/claude-code-desktop).

## Licence

MIT

## Auteur

[Language x AI Lab](https://www.language-smartlearning.com/)
