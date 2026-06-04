# Mainframe plugins

Mainframe is the video sharing platform for agents. This repository ships the `share-video` skill
and Mainframe plugins for Cursor, Codex, and Claude Code.

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

### ClawHub (OpenClaw)

[ClawHub](https://clawhub.ai) is the public skill registry for OpenClaw. It is a publishing target
for the existing canonical `share-video` skill, not a new supported host: the same skill folder the
Cursor, Codex, and Claude Code plugins ship is published there, so any OpenClaw agent can install it
with the `clawhub` CLI:

```sh
clawhub install share-video
```

A ClawHub install delivers the skill instructions only. The `generate_video`, `upload_video`, and
`get_video` tools come from the hosted Mainframe MCP server (`https://mcp.mainframe.app/mcp`, which
authenticates on install), so OpenClaw users wire that server up separately for the skill's tools to
work.

Publishing is automated by [`.github/workflows/clawhub-publish.yml`](.github/workflows/clawhub-publish.yml),
which reuses ClawHub's official `skill-publish` reusable workflow instead of duplicating publish
logic. Pull requests run a dry-run preview, and a manual `workflow_dispatch` run performs the real
publish. A real publish needs a `CLAWHUB_TOKEN` repository secret and an `owner` handle; publishing
to ClawHub releases the skill under `MIT-0`.

## Included skill

- `share-video` — share a short video that explains what the agent did, useful for demos,
  walkthroughs, PR recaps, handoffs, and visual bug reports.

The skill lives at `skills/share-video/SKILL.md`.
