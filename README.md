# Mainframe Plugins

Mainframe plugin packaging for coding-agent hosts. This repo ships a shared
`share-video` skill, hosted MCP wiring, and optional AFK stop hooks that can
suggest a short Mainframe video after meaningful agent work when the user has
been away.

## What Ships

- Cursor, Claude Code, Codex, and OpenClaw plugin manifests
- Cursor, Claude-compatible, Codex, Devin Terminal, and OpenClaw hook adapters
- Canonical `share-video` skill at `skills/share-video/SKILL.md`
- Canonical slash command `/mainframe:share-video` where slash commands are
  supported
- Mainframe MCP configuration at `.mcp.json`
- Marketplace metadata for Cursor, Claude Code, and Codex-style plugin discovery

## Host Files

| Host           | Manifest                           | Hooks                                |
| -------------- | ---------------------------------- | ------------------------------------ |
| Cursor         | `.cursor-plugin/plugin.json`       | `hooks/cursor/hooks.json`            |
| Claude Code    | `.claude-plugin/plugin.json`       | `hooks/claude/hooks.json`            |
| Codex          | `.codex-plugin/plugin.json`        | `hooks/codex/hooks.json`             |
| Devin Terminal | `.agents/plugins/marketplace.json` | `hooks/devin-terminal/hooks.v1.json` |
| OpenClaw       | `openclaw.plugin.json`             | `hooks/openclaw/register.ts`         |

## Repository Layout

| Path              | Purpose                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `skills/`         | Canonical Mainframe skill content.                                     |
| `.agents/`        | Codex marketplace metadata and Devin-compatible skill link.            |
| `.cursor-plugin/` | Cursor manifest and marketplace metadata.                              |
| `.claude-plugin/` | Claude Code manifest and marketplace metadata.                         |
| `.codex-plugin/`  | Codex plugin manifest.                                                 |
| `hooks/`          | Shared AFK gate plus per-host hook adapters and fixtures.              |
| `tooling/`        | Repo maintenance scripts for generation, checks, and release archives. |
| `assets/`         | Marketplace icon, logo, and screenshots.                               |
| `release/`        | Ignored output directory for generated release archives.               |

## Install

| Host               | Install                                                                                                   | Surfaces wired                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Claude Code        | `/plugin marketplace add mainframecomputer/mainframe-plugins`, then `/plugin install mainframe@mainframe` | Skill, MCP server, and Claude-compatible `Stop` hook.                                           |
| Codex              | `codex plugin marketplace add mainframecomputer/mainframe-plugins`, then install from the directory       | Skill, MCP server, and Codex `Stop` hook without hook-specific output.                          |
| Cursor             | Add from the Cursor marketplace listing                                                                   | Skill, MCP server, screenshots, and lowercase `stop` hook with `loop_limit: 1`.                 |
| OpenClaw           | `openclaw plugins install clawhub:mainframe` or `git:github.com/mainframecomputer/mainframe-plugins`      | Skill and AFK hook. Add MCP and conversation-hook access in `openclaw.json` as shown below.     |
| Devin cloud        | `npx skills add mainframecomputer/mainframe-plugins`                                                      | Skill. Add Mainframe MCP from Devin MCP settings or with the custom MCP URL.                    |
| Devin for Terminal | `npx skills add mainframecomputer/mainframe-plugins`                                                      | Skill. Run `devin mcp add mainframe https://mcp.mainframe.app/mcp` and copy the hook JSON file. |

OpenClaw users also need this config because native OpenClaw plugins cannot
register MCP servers for the user and conversation hooks require explicit
access:

```json
{
  "mcp": {
    "servers": {
      "mainframe": {
        "type": "http",
        "url": "https://mcp.mainframe.app/mcp"
      }
    }
  },
  "plugins": {
    "entries": {
      "mainframe": {
        "hooks": {
          "allowConversationAccess": true
        }
      }
    }
  }
}
```

For Devin for Terminal, copy `hooks/devin-terminal/hooks.v1.json` into the
project's `.devin/hooks.v1.json` after adding the skill and MCP server.

## Hook Behavior

The stop hooks are intentionally conservative. They only suggest a video when:

- a real user message is present in the recent transcript
- at least one tool or command-like work event happened after that message
- the user has been away longer than the configured threshold
- no Mainframe video appears to have already been generated or shared

The suggestion text includes elapsed hours only. It does not include transcript
content.

Set `MAINFRAME_HOOK=0` to disable stop-hook suggestions. Set
`MAINFRAME_HOOK_AFK_HOURS` to change the default one-hour threshold.

## Development

Most changes touch one of three sources of truth:

- `tooling/generate.ts` for plugin and marketplace metadata
- `skills/share-video/SKILL.md` for the skill
- `hooks/core/afk-gate.ts` for shared AFK behavior

```sh
bun install
bun run generate
bun run verify
bun run pack:release
```

Useful scripts:

| Script                 | Purpose                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `bun run generate`     | Regenerate host manifests, marketplace files, and package metadata.           |
| `bun run verify`       | Local full check: generated drift, typecheck, build, lint, format, and tests. |
| `bun run verify:ci`    | CI variant that runs `generate` and fails on generated diffs.                 |
| `bun run build`        | Build runtime hook JavaScript into `dist/`.                                   |
| `bun run pack:release` | Verify, build, and write `release/mainframe-plugins-<version>.tgz`.           |

`bun run pack:release` builds `dist/` and writes a release archive under
`release/`. The archive follows the `.agents/skills/share-video` symlink so
Devin-compatible skill discovery receives a real copy of the canonical skill.

This repository is proprietary to Mainframe Computer, Inc. See `LICENSE`.
