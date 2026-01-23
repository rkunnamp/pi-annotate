# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-01-22

### Added

- **Pi Extension** (`index.ts`)
  - `annotate` tool for LLM-invoked visual annotation
  - Unix socket communication with Chrome extension
  - Bidirectional chat via `turn_end` event forwarding
  - Configurable timeout (default: 5 minutes)

- **Chrome Extension**
  - Toolbar UI adapted from [Agentation](https://github.com/benjitaylor/agentation)
  - Single click, multi-select, text selection, area selection modes
  - Annotation popup for adding comments
  - ChatPanel for bidirectional conversation with Pi
  - Dark/light theme support
  - Draggable toolbar
  - Detail level settings (Compact, Standard, Detailed, Forensic)
  - localStorage persistence (7 days)
  - Keyboard shortcut: `Cmd+Shift+A` / `Ctrl+Shift+A`

- **Native Messaging Host** (`host.cjs`)
  - Bridge between Chrome extension and Pi via Unix socket
  - Automatic socket cleanup on exit
  - Logging to `/tmp/pi-annotate-host.log`

- **Developer Experience**
  - Root-level npm scripts: `setup`, `build`, `dev`
  - Single `npm run setup` for initial installation

### Technical Details

- Socket path: `/tmp/pi-annotate.sock`
- Native host name: `com.pi.annotate`
- Message protocol: Newline-delimited JSON over Unix socket
- Chrome messaging: Native messaging API + content script messaging

### Credits

- UI components from [Agentation](https://github.com/benjitaylor/agentation) by Benji Taylor, Dennis Jin, and Alex Vanderzon
- Native messaging patterns from [Surf CLI](https://github.com/nicobailon/surf-cli)

[Unreleased]: https://github.com/nicobailon/pi-annotate/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nicobailon/pi-annotate/releases/tag/v0.1.0
