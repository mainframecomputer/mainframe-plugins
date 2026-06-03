# Mainframe skills

Mainframe helps coding agents leave short video updates when they finish tool-assisted work. This
repository ships the `share-video` skill and a Cursor plugin.

## Install

Install the skill directly for any agent that supports skills:

```sh
npx skills add mainframecomputer/mainframe-plugins
```

To preview the available skills without installing:

```sh
npx skills add mainframecomputer/mainframe-plugins --list
```

If you use Cursor, you can install the Mainframe plugin from the Cursor marketplace instead. The
plugin includes the `share-video` skill, hosted Mainframe MCP tools, and a conservative `stop` hook
that can remind an agent to leave a video handoff.

The hook only suggests a video after a real user request, agent tool work, and about an hour of
user inactivity. It does not include transcript content in the suggestion.

## Included skill

- `share-video` — share a short video that explains what the agent did, useful for demos,
  walkthroughs, PR recaps, handoffs, and visual bug reports.

The skill lives at `skills/share-video/SKILL.md`.

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
