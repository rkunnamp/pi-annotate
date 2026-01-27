# Changelog

All notable changes to Pi Annotate.

## [0.1.2] - 2026-01-27

### Security
- **Auth token** — Native host generates per-run token at `/tmp/pi-annotate.token`; Pi must authenticate before messages are forwarded
- **Socket permissions** — Socket file created with 0600 permissions, token file with 0600
- **Message validation** — Schema guardrails in index.ts drop malformed messages

### Added
- **Request correlation** — End-to-end requestId tracking for proper multi-request handling
- **Buffer limits** — Max 8MB for socket/native messaging buffers, 15MB for screenshots
- **Log redaction** — Screenshots/dataUrls redacted from native host logs
- **Log rotation** — Host log rotates at 5MB
- **Stale selection pruning** — Auto-removes elements deleted from DOM before submit

### Fixed
- **Connection lost handling** — Pending tool calls resolve with `connection_lost` on socket close
- **Navigation timeout** — Now sends CANCEL with `navigation_timeout` reason to Pi
- **Canvas context guard** — Falls back to full screenshot if 2D context unavailable
- **escapeHtml robustness** — Handles null/undefined/non-string inputs safely

### Changed
- **Pending requests** — Changed from single `pendingResolve` to Map keyed by requestId
- **Async file writes** — Screenshots written asynchronously with `fs.promises.writeFile`
- **Tab routing** — Background script routes messages to correct tab via requestId mapping

## [0.1.1] - 2026-01-27

### Fixed
- **XSS vulnerability** — Escape HTML when rendering element IDs/classes in tooltips and chips
- **Screenshot map index shift on click-deselect** — Clicking to deselect now properly shifts screenshot toggle states
- **DOM validity check** — Verify elements still exist in DOM before cropping screenshots
- **Null viewport access** — Guard against undefined viewport in result formatting
- **Event listener cleanup** — Match wheel event removal options with addition options
- **Navigation listener leak** — Add 30s timeout to prevent orphaned listeners
- **Style injection fallback** — Use `document.documentElement` if `document.head` is unavailable

## [0.1.0] - 2026-01-27 (Complete Rewrite)

### Added
- **Per-element screenshots** — Each selected element gets its own cropped screenshot
- **📷 toggle button** — Enable/disable screenshot per element on chips
- **Parent/Child navigation** — Modify selected elements with ▲/▼ buttons
- **+/− buttons** — Expand to parent or contract to child on each chip
- **`/annotate` command** — Works on current tab without requiring URL
- **`/ann` alias** — Quick shortcut for annotation command
- **Full page option** — Toggle to capture entire viewport instead
- **ESC to close** — Keyboard shortcut to dismiss UI
- **× close button** — Visual close button in header

### Changed
- **Vanilla JS** — Complete rewrite from React (~800 lines vs 2000+)
- **Native messaging** — Replaced HTTP polling with native messaging for reliability
- **Text capture** — Increased from 100 to 500 characters
- **Screenshot paths** — Saved to temp files with paths returned for LLM reading
- **UI layout** — Reorganized with "Hover Preview" and "Modify Selection" sections

### Fixed
- Socket data buffering for large screenshot payloads
- Click events being blocked by panel overlay
- Cancel button working without active connection
- Content script injection on pages loaded before extension

### Architecture
```
Pi Extension ← Unix Socket → Native Host ← Native Messaging → Chrome Extension
```

## Architecture

| Aspect | This Version |
|--------|--------------|
| UI Framework | Vanilla JS |
| Lines of code | ~800 |
| Screenshots | Per-element crops |
| Communication | Native messaging |
| Chat | One-way submit |
| Build step | None |
