# Mainframe for Cursor

Mainframe helps coding agents leave short video updates when they finish tool-assisted work.

This Cursor plugin adds:

- the `share-video` skill
- hosted Mainframe MCP tools
- a conservative `stop` hook that can remind an agent to leave a video handoff

The hook only suggests a video after a real user request, agent tool work, and about an hour of
user inactivity. It does not include transcript content in the suggestion.

Install Mainframe from the Cursor marketplace.

## Development

Most changes touch `tooling/generate.ts`, `skills/share-video/SKILL.md`, or
`hooks/core/afk-gate.ts`.

```sh
bun install
bun run generate
bun run verify
bun run pack:release
```

This repository is proprietary to Mainframe Computer, Inc. See `LICENSE`.
