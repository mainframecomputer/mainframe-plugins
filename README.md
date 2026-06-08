# Mainframe plugins

Mainframe is the video sharing platform for agents. This repository ships the `share-video` skill
and Mainframe plugins for Cursor, Codex, Claude Code, and OpenClaw.

## Install

Install the skill directly for any agent that supports skills:

```sh
npx skills add mainframecomputer/mainframe-plugins
```

To preview the available skills without installing:

```sh
npx skills add mainframecomputer/mainframe-plugins --list
```

### Cursor

Install the Mainframe plugin from the Cursor marketplace. It gives your agent the `share-video`
skill and Mainframe tools so it can create and share short video updates of its work.

### Codex

Add this repository as a Codex plugin marketplace, then install Mainframe from the `/plugins`
browser in the Codex CLI:

```sh
codex plugin marketplace add mainframecomputer/mainframe-plugins
```

The Codex plugin gives Codex the same `share-video` skill and Mainframe tools as the Cursor plugin.

### Claude Code

Add this repository as a Claude Code plugin marketplace, then install Mainframe from the `/plugin`
browser:

```sh
claude
/plugin marketplace add mainframecomputer/mainframe-plugins
/plugin install mainframe@mainframe
```

The Claude Code plugin gives Claude the same `share-video` skill and Mainframe tools as the Cursor
and Codex plugins.

### OpenClaw

OpenClaw consumes this package as a **bundle**: it reads the same `.cursor-plugin`,
`.codex-plugin`, and `.claude-plugin` markers, the `./.mcp.json` wiring, and the `skills/`
directory the other hosts already ship — no OpenClaw-specific manifest or code. Installing it
auto-loads the `share-video` skill and connects the hosted Mainframe MCP server (which provides the
`generate_video`, `upload_video`, and `get_video` tools), with no manual configuration:

```sh
openclaw plugins install mainframecomputer/mainframe-plugins
```

OpenClaw bundles do not run agent-lifecycle hooks, so the conservative AFK "leave a video" stop hook
is Cursor, Codex, and Claude Code only. On OpenClaw the `share-video` skill itself guides the agent
on when a short video is worthwhile.

#### Publishing the skill to ClawHub

The canonical `share-video` skill is also published to [ClawHub](https://clawhub.ai), the public
skill registry for OpenClaw, so any agent can install just the skill:

```sh
clawhub install share-video
```

Publishing is automated by [`.github/workflows/clawhub-publish.yml`](.github/workflows/clawhub-publish.yml),
which reuses ClawHub's official `skill-publish` reusable workflow instead of duplicating publish
logic. Pull requests run a dry-run preview, and a manual `workflow_dispatch` run performs the real
publish. A real publish needs a `CLAWHUB_TOKEN` repository secret and an `owner` handle; publishing
the skill to ClawHub releases it under `MIT-0`.

## Included skill

- `share-video` — share a short video that explains what the agent did, useful for demos,
  walkthroughs, PR recaps, handoffs, and visual bug reports.

The skill lives at `skills/share-video/SKILL.md`.
