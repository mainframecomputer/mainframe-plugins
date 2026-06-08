# Mainframe plugins

Mainframe is the video sharing platform for agents. This repository ships the `share-video` skill
and Mainframe plugins for Cursor, Codex, Claude Code, and Hermes.

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

### Hermes

Hermes installs Mainframe through its skill and config flows: install the `share-video` skill, then
add the Mainframe MCP server.

1. Install the `share-video` skill:

   ```sh
   hermes skills install mainframecomputer/mainframe-plugins/skills/share-video
   ```

2. Add the Mainframe MCP server to `~/.hermes/config.yaml`:

   ```yaml
   mcp_servers:
     mainframe:
       url: https://mcp.mainframe.app/mcp
       auth: oauth
   ```

   On first use, Hermes opens your browser (or prints an authorize URL) to authorize Mainframe.

This gives Hermes the same `share-video` skill and Mainframe tools as the other hosts.

## Included skill

- `share-video` — share a short video that explains what the agent did, useful for demos,
  walkthroughs, PR recaps, handoffs, and visual bug reports.

The skill lives at `skills/share-video/SKILL.md`.
