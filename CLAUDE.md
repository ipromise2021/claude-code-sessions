# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Claude Code sessions monorepo - Effect-TS based session management library

## Project Structure

- `packages/core` - Core library (npm: `@claude-sessions/core`)
- `packages/web` - SvelteKit web UI (npm: `@claude-sessions/web`)
- `packages/mcp` - MCP server (npm: `claude-sessions-mcp`)
- `packages/vscode-extension` - VSCode extension (npm: `claude-sessions`)
- `packages/test-fixtures` - Shared test fixture data (sample JSONL sessions)

## Important: Open Source Project

This is an **English-only open source project**:

- All code comments, variable names, commit messages in English
- Documentation in English
- Include `-s` flag when committing (sign-off)

## Commands

```bash
# Build
pnpm build                 # All packages
pnpm build:core            # core only
pnpm build:web             # web only
pnpm build:mcp             # mcp only

# Test (vitest)
pnpm test                  # All packages (--workspace-concurrency=1)
pnpm test:core             # core only
pnpm test:web              # web unit tests only
pnpm test:mcp              # mcp only
pnpm test:e2e              # Playwright E2E tests
pnpm test:vsx              # VSCode extension tests

# Lint & typecheck
pnpm lint                  # ESLint all packages
pnpm typecheck             # tsc --noEmit all packages

# Dev servers
pnpm dev                   # Web UI (Vite dev server)
pnpm dev:mcp               # MCP server (watch mode)
pnpm storybook             # Storybook dev server (port 6006)
```

### Running a single test

```bash
# In any package directory:
cd packages/core
pnpm vitest run src/__tests__/list.test.ts          # specific file
pnpm vitest run -t "should handle empty sessions"    # specific test name
```

## Architecture

### Effect-TS: The Core Pattern

All operations in `@claude-sessions/core` are built with Effect-TS. Every function that performs I/O returns an `Effect` — it does **not** execute until run:

```typescript
// Functions return Effects (lazy, composable)
const result = Effect.gen(function* () {
  const messages = yield* readJsonlFile(filePath)
  return processMessages(messages)
})

// Consumers call runPromise to execute
const data = await Effect.runPromise(result)
```

Key Effect imports used throughout: `Effect.gen`, `Effect.tryPromise`, `Effect.runPromise`, `pipe`, `Option`, `Array`.

### Dual Entry Points

`@claude-sessions/core` has **two entry points** to separate browser-safe from Node-only code:

| Entry  | Import path                    | Contains                                                                     |
| ------ | ------------------------------ | ---------------------------------------------------------------------------- |
| Main   | `@claude-sessions/core`        | Types, path utils, all session operations (browser-safe, uses `fs/promises`) |
| Server | `@claude-sessions/core/server` | `resumeSession`, `startClaude` (Node-only, uses `child_process`)             |

Never import `@claude-sessions/core/server` in browser/Vite code — it will break the build.

### Session Data Flow

```
~/.claude/projects/{project-folder}/
  ├── {session-id}.jsonl          # One JSONL line per message
  ├── agent-{agent-id}.jsonl       # Sub-agent session files
  ├── .tree-cache.json             # Cached SessionTreeData (mtime-invalidated)
  └── sessions-index.json          # Official Claude Code extension index
```

1. JSONL files are parsed line-by-line (each line is a JSON message object)
2. Messages are validated against Effect Schema types (see `schemas/message.ts`)
3. Session metadata is extracted and cached in `.tree-cache.json`
4. The official extension maintains `sessions-index.json` for fast lookups

### Cache Architecture (`.tree-cache.json`)

The tree cache avoids re-parsing all JSONL files on every request:

- **Phase 1**: Scan all session files to build a global UUID map and collect all summary records (needed for cross-session `leafUuid` resolution)
- **Phase 2**: Parse only changed/new session files, reuse cached data for unchanged ones
- **Invalidation**: File mtime comparison with 1ms tolerance (cross-platform precision)
- **Atomic writes**: Write to `.tmp` then rename to avoid corruption

### Streaming vs Full Parse

Two metadata extraction paths exist:

- **`crud-streaming.ts` (fast)**: Uses regex to extract only the `type` field from each line, avoiding full `JSON.parse`. Used for lightweight session listings.
- **`crud.ts` (full)**: Full `JSON.parse` on every line. Used when complete message data is needed (reading a session, analysis, validation).

### Validation & Chain Repair

Messages in a JSONL file form a linked list via `uuid`/`parentUuid`. The validation system (`session/validation.ts`) checks:

1. **Chain integrity**: Each message's `parentUuid` must point to the previous message's `uuid`
2. **Tool use/result pairing**: Every `tool_use` must have a matching `tool_result`
3. **Progress messages**: Detects stray progress/notification messages

Auto-repair can fix broken chains by re-linking messages based on timestamp order or by removing orphan messages.

## Session Summary Architecture

**CRITICAL**: Understanding how summaries work is essential for matching official extension behavior.

- Summary records have `leafUuid` but **no timestamp**
- `leafUuid` points to a message in **another session** (cross-session reference)
- The timestamp for sorting/display must be derived from the **target message's timestamp**
- Official extension calculates relative time based on `leafUuid`'s target message timestamp

```
Session A (contains summary):
  { type: "summary", summary: "...", leafUuid: "abc123" }  // no timestamp!

Session B (contains target message):
  { uuid: "abc123", timestamp: "2025-12-26T12:57:25.141Z" }  // this is the timestamp to use
```

When matching official extension's session list order and relative time display, use `leafUuid` resolution to get the correct timestamp.

## Title Message Architecture

`custom-title` and `agent-name` JSONL records have **no `uuid` field**:

```
{"type":"custom-title","customTitle":"My Title","sessionId":"abc123"}
{"type":"agent-name","agentName":"Agent Task","sessionId":"abc123"}
```

- Standard uuid-based APIs (`deleteMessage`, `updateCustomTitle`) **cannot target these messages**
- Use **line-index-based** operations: `deleteTitleMessageByIndex`, `updateTitleMessageByIndex`
- The web API accepts `lineIndex` query parameter for `DELETE` and `PATCH /api/message`
- **Rename Session** modifies both `custom-title` and `agent-name` records simultaneously

## Tech Stack

- **Core**: TypeScript, Effect-TS (`effect` v3)
- **Web**: SvelteKit 5, Svelte 5, TailwindCSS 4, adapter-node, Commander.js (CLI)
- **MCP Server**: `@modelcontextprotocol/sdk`
- **Build**: tsup (core/mcp/vscode), Vite (web)
- **Test**: Vitest (unit), Playwright (E2E)
- **Package Manager**: pnpm workspace (`pnpm@9.15.9`)

## Development Workflow

### Permanent Records & Public Actions Policy

**CRITICAL**: GitHub comments, PR/Issue modifications, and Git pushes leave permanent traces that cannot be fully erased (e.g., "comment deleted" logs).
ALWAYS use `notify_user` (or `AskUserQuestion`) to get explicit confirmation BEFORE:

- **GitHub API Actions**: Posting or editing comments, labels, milestones, or issue states.
- **Git Push**: Amending commits, force pushing, or pushing corrections for previous mistakes.
- **VSIX/NPM Publishing**: Any action that results in a new public artifact version.
- **Workflow Changes**: Modifying CI/CD pipelines or branch protection rules.

### Version Management

Always use `npm version` command for version bumps:

```bash
pnpm version patch   # 0.1.5 -> 0.1.6
pnpm version minor   # 0.1.5 -> 0.2.0
pnpm version 0.2.0   # Specific version
```

### Web UI Testing

After modifying web features, always test with Playwright:

1. Start dev server: `pnpm dev`
2. Test functionality with Playwright
3. **Keep browser open** for user verification (don't close)

### VSCode Extension Workflow

**IMPORTANT**: After modifying any files in `packages/core/` or `packages/vscode-extension/`, use `/vsix` slash command to rebuild and reinstall.

This applies to:

- `packages/core/src/*.ts` - Core library source
- `packages/vscode-extension/src/*.ts` - Extension source
- `packages/vscode-extension/package.json` - Extension manifest

**Note**: A PostToolUse hook marks rebuild needed, but explicit "vsix rebuild" request should trigger immediate rebuild.

## Refactoring

When refactoring, use the `refactor-comparison` agent to analyze pure functions vs Effect-based implementations.
