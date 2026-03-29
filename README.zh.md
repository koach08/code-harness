[English](README.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt.md)

# Code Harness

**AI代码编辑器的控制中心。**

在一个桌面应用中管理 Claude Code、Codex、Aider 和终端。即时切换 AI 工具，可视化配置 AI harness，提升编码效率。

![Code Harness](build/icon.png)

## 为什么选择 Code Harness？

Claude Code、Codex 和 Aider 等 AI 编码工具功能强大——但在它们之间切换很麻烦。Code Harness 解决了这个问题：

- **一个应用，所有 AI 工具** — Claude Code、Codex、Aider、终端以标签页形式管理
- **Harness Engineering UI** — 可视化编辑 CLAUDE.md、配置 Hooks、浏览 Memory
- **项目切换** — 注册项目，即时切换上下文
- **13 种语言** — 英语、日语、中文、韩语、德语、法语、西班牙语、葡萄牙语、俄语、印地语、土耳其语、越南语、印尼语

## 功能

### 多 AI 终端
- 一键切换 Claude Code、Codex、Aider 和终端
- 在标签页中同时运行多个会话
- 拖放文件夹以在任意 AI 工具中打开

### Harness Engineering 面板
- **CLAUDE.md 编辑器** — 在 GUI 中为 Claude Code 创建和编辑项目指令
- **Hooks 配置** — 可视化添加 PreToolUse/PostToolUse 钩子（自动 lint、自动测试等）
- **Memory 浏览器** — 一览所有 Claude Code 记忆文件
- **项目管理器** — 注册常用项目以实现即时切换

### App Builder
- 扫描项目以检测框架、语言和部署配置
- 48+ 脚手架模板（SaaS、着陆页、电商、移动端、WordPress 等）
- 适用于不同技能水平的 Auto/Collaborate 模式

### 核心功能
- Simple / Advanced / Builder / Harness UI 模式
- 会话持久化与崩溃恢复
- 工具审批快捷按钮（Yes/No/Stop）
- 实时活动检测（读取中、写入中、需要审批...）
- 跨会话的提示词追踪工作日志

## 下载

从 [Releases](https://github.com/koach08/code-harness/releases) 下载适用于您平台的最新版本。

| 平台 | 格式 | 架构 |
|----------|--------|-------------|
| **macOS** | `.dmg` | Apple Silicon (M1-M4) / Intel |
| **Windows** | `.exe` | x64 |
| **Linux** | `.AppImage` / `.deb` | x64 |

## 前提条件

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)
- **Anthropic 账户**（Pro 计划或 API 密钥）

可选：
- **Codex** (`npm install -g @openai/codex`) 用于 Codex 模式
- **Aider** (`pip install aider-chat`) 用于 Aider 模式

> 应用启动时会检查 Claude Code CLI，如未安装会引导您完成安装。

## 从源码构建

```bash
git clone https://github.com/koach08/code-harness.git
cd code-harness
npm install
npm start
```

为您的平台构建：

```bash
npm run build:mac    # macOS (.dmg)
npm run build:win    # Windows (.exe)
npm run build:linux  # Linux (.AppImage, .deb)
```

## 键盘快捷键

| 快捷键 | 操作 |
|----------|--------|
| `Cmd+Enter` | 发送提示词 |
| `Cmd+T` | 新建标签页 |
| `Cmd+W` | 关闭标签页 |
| `Cmd+S` | 保存会话 |
| `Cmd+1-9` | 切换标签页 |
| `Cmd+,` | 设置 |
| `Alt+Up/Down` | 输入历史 |

## 什么是 Harness Engineering？

Harness Engineering 是一种优化 AI 编码工具配置层以提升输出质量的实践：

- **CLAUDE.md** — Claude Code 自动读取的项目特定指令
- **Hooks** — 在事件触发时运行的 Shell 命令（例如：文件编辑后自动 lint）
- **Memory** — 跨对话持久化的知识

Code Harness 为您提供可视化界面来管理所有这些——无需手动编辑文件。

## 架构

每个用户使用**自己的账户和 API 密钥**运行 AI 工具。Code Harness 只是 UI 层——不存储或共享任何密钥。

## 相关项目

本项目从 [claude-code-desktop](https://github.com/koach08/claude-code-desktop) 演变而来。

## 许可证

MIT

## 作者

[Language x AI Lab](https://www.language-smartlearning.com/)
