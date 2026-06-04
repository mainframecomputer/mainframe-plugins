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

Install the Mainframe plugin from [ClawHub](https://clawhub.ai), the public skill and plugin
registry for OpenClaw, with the OpenClaw plugin manager:

```sh
openclaw plugins install clawhub:mainframe
```

The plugin gives OpenClaw the `share-video` skill and a native `before_agent_finalize` hook that
suggests a short video after a long, unattended run — the same conservative AFK behavior as the
other hosts' stop hooks, reusing the shared `hooks/core` runtime. Native OpenClaw plugins cannot
register an MCP server for you, and conversation hooks need explicit access, so add the hosted
Mainframe MCP server and hook access to your `openclaw.json`:

```json
{
  "mcp": {
    "servers": {
      "mainframe": { "type": "http", "url": "https://mcp.mainframe.app/mcp" }
    }
  },
  "plugins": {
    "entries": {
      "mainframe": { "hooks": { "allowConversationAccess": true } }
    }
  }
}
```

#### Publishing to ClawHub

The canonical `share-video` skill is also published to ClawHub on its own, so any agent can install
just the skill (its `generate_video`, `upload_video`, and `get_video` tools come from the hosted
Mainframe MCP server, wired up separately):

```sh
clawhub install share-video
```

Publishing is automated by [`.github/workflows/clawhub-publish.yml`](.github/workflows/clawhub-publish.yml),
which reuses ClawHub's official `skill-publish` and `package-publish` reusable workflows instead of
duplicating publish logic. Pull requests run dry-run previews, and a manual `workflow_dispatch` run
publishes both the skill and the plugin package. A real publish needs a `CLAWHUB_TOKEN` repository
secret and an `owner` handle (the package scope `@mainframe` must match that owner); publishing the
skill to ClawHub releases it under `MIT-0`.

## Included skill

- `share-video` — share a short video that explains what the agent did, useful for demos,
  walkthroughs, PR recaps, handoffs, and visual bug reports.

The skill lives at `skills/share-video/SKILL.md`.
