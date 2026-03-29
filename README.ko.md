[English](README.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt.md)

# Code Harness

**AI 코드 에디터의 컨트롤 센터.**

하나의 데스크톱 앱에서 Claude Code, Codex, Aider, 터미널을 관리하세요. AI 도구를 즉시 전환하고, AI harness를 시각적으로 구성하며, 코딩 생산성을 높이세요.

![Code Harness](build/icon.png)

## 왜 Code Harness인가?

Claude Code, Codex, Aider 같은 AI 코딩 도구는 강력하지만, 도구 간 전환이 번거롭습니다. Code Harness가 이 문제를 해결합니다:

- **하나의 앱으로 모든 AI 도구** — Claude Code, Codex, Aider, 터미널을 탭으로 관리
- **Harness Engineering UI** — CLAUDE.md 편집, Hooks 구성, Memory 탐색을 시각적으로
- **프로젝트 전환** — 프로젝트를 등록하고 컨텍스트를 즉시 전환
- **13개 언어** — 영어, 일본어, 중국어, 한국어, 독일어, 프랑스어, 스페인어, 포르투갈어, 러시아어, 힌디어, 터키어, 베트남어, 인도네시아어

## 기능

### 멀티 AI 터미널
- Claude Code, Codex, Aider, 터미널을 원클릭으로 전환
- 여러 세션을 탭에서 동시 실행
- 폴더를 드래그 앤 드롭하여 원하는 AI 도구에서 열기

### Harness Engineering 패널
- **CLAUDE.md 에디터** — GUI에서 Claude Code용 프로젝트 지시사항 생성 및 편집
- **Hooks 구성** — PreToolUse/PostToolUse 훅을 시각적으로 추가 (자동 lint, 자동 테스트 등)
- **Memory 브라우저** — 모든 Claude Code 메모리 파일을 한눈에 확인
- **프로젝트 매니저** — 자주 사용하는 프로젝트를 등록하여 즉시 전환

### App Builder
- 프로젝트를 스캔하여 프레임워크, 언어, 배포 설정 감지
- 48개 이상의 스캐폴딩 템플릿 (SaaS, 랜딩 페이지, 이커머스, 모바일, WordPress 등)
- 다양한 스킬 레벨에 맞는 Auto/Collaborate 모드

### 핵심 기능
- Simple / Advanced / Builder / Harness UI 모드
- 세션 영속성 및 크래시 복구
- 도구 승인용 퀵 액션 버튼 (Yes/No/Stop)
- 실시간 활동 감지 (읽기 중, 쓰기 중, 승인 필요...)
- 세션 전반의 프롬프트 추적 작업 로그

## 다운로드

[Releases](https://github.com/koach08/code-harness/releases)에서 플랫폼에 맞는 최신 릴리스를 다운로드하세요.

| 플랫폼 | 포맷 | 아키텍처 |
|----------|--------|-------------|
| **macOS** | `.dmg` | Apple Silicon (M1-M4) / Intel |
| **Windows** | `.exe` | x64 |
| **Linux** | `.AppImage` / `.deb` | x64 |

## 사전 요구사항

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)
- **Anthropic 계정** (Pro 플랜 또는 API 키)

선택사항:
- **Codex** (`npm install -g @openai/codex`) Codex 모드용
- **Aider** (`pip install aider-chat`) Aider 모드용

> 앱 시작 시 Claude Code CLI를 확인하며, 설치되지 않은 경우 설치를 안내합니다.

## 소스에서 빌드

```bash
git clone https://github.com/koach08/code-harness.git
cd code-harness
npm install
npm start
```

플랫폼별 빌드:

```bash
npm run build:mac    # macOS (.dmg)
npm run build:win    # Windows (.exe)
npm run build:linux  # Linux (.AppImage, .deb)
```

## 키보드 단축키

| 단축키 | 동작 |
|----------|--------|
| `Cmd+Enter` | 프롬프트 전송 |
| `Cmd+T` | 새 탭 |
| `Cmd+W` | 탭 닫기 |
| `Cmd+S` | 세션 저장 |
| `Cmd+1-9` | 탭 전환 |
| `Cmd+,` | 설정 |
| `Alt+Up/Down` | 입력 기록 |

## Harness Engineering이란?

Harness Engineering은 AI 코딩 도구의 구성 레이어를 최적화하여 출력 품질을 향상시키는 실천 방법입니다:

- **CLAUDE.md** — Claude Code가 자동으로 읽는 프로젝트별 지시사항
- **Hooks** — 이벤트 발생 시 실행되는 셸 명령 (예: 파일 편집 후 자동 lint)
- **Memory** — 대화 간에 유지되는 지속적 지식

Code Harness는 이 모든 것을 시각적으로 관리할 수 있는 인터페이스를 제공합니다. 수동 파일 편집이 필요 없습니다.

## 아키텍처

각 사용자는 **자신의 계정과 API 키**로 AI 도구를 실행합니다. Code Harness는 UI 레이어일 뿐이며, 키를 저장하거나 공유하지 않습니다.

## 관련 프로젝트

이 프로젝트는 [claude-code-desktop](https://github.com/koach08/claude-code-desktop)에서 발전했습니다.

## 라이선스

MIT

## 저자

[Language x AI Lab](https://www.language-smartlearning.com/)
