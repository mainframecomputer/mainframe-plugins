# Mainframe plugins

Mainframe is the video sharing platform for agents. This repo packages the
`share-video` skill, hosted MCP wiring, and optional AFK stop hook for Cursor.

## What ships

- Cursor plugin manifest and marketplace metadata
- Cursor `stop` hook adapter
- Canonical `share-video` skill at `skills/share-video/SKILL.md`
- Mainframe MCP configuration at `.mcp.json`

## Host files

| Host   | Manifest                     | Hooks                     |
| ------ | ---------------------------- | ------------------------- |
| Cursor | `.cursor-plugin/plugin.json` | `hooks/cursor/hooks.json` |

## Repository layout

| Path              | Purpose                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `skills/`         | Canonical Mainframe skill content.                                     |
| `.cursor-plugin/` | Cursor manifest and marketplace metadata.                              |
| `hooks/`          | Shared AFK gate plus the Cursor hook adapter and fixtures.             |
| `tooling/`        | Repo maintenance scripts for generation, checks, and release archives. |
| `assets/`         | Marketplace logo.                                                      |
| `release/`        | Ignored output directory for generated release archives.               |

## Install

Add Mainframe from the Cursor marketplace listing. The Cursor package wires the
skill, hosted MCP server, and lowercase `stop` hook with `loop_limit: 1`.

## Hook behavior

The Cursor stop hook is intentionally conservative. It only suggests a video
when:

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
| `bun run generate`     | Regenerate Cursor manifests, marketplace files, and package metadata.         |
| `bun run verify`       | Local full check: generated drift, typecheck, build, lint, format, and tests. |
| `bun run verify:ci`    | CI variant that runs `generate` and fails on generated diffs.                 |
| `bun run build`        | Build runtime hook JavaScript into `dist/`.                                   |
| `bun run pack:release` | Verify, build, and write `release/mainframe-plugins-<version>.tgz`.           |

`bun run pack:release` builds `dist/` and writes a release archive under
`release/`.

This repository is proprietary to Mainframe Computer, Inc. See `LICENSE`.
