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

[Hermes](https://hermes-agent.nousresearch.com) is config-driven rather than manifest-based, so
Mainframe for Hermes is the shared `share-video` skill plus the Mainframe MCP server. Both install
through Hermes' own native flows — there is no plugin manifest to generate.

1. Install the `share-video` skill straight from this repository:

   ```sh
   hermes skills install mainframecomputer/mainframe-plugins/skills/share-video
   ```

   For local development you can instead point `skills.external_dirs` in `~/.hermes/config.yaml` at
   this repository's `skills` directory.

2. Add the Mainframe MCP server to `~/.hermes/config.yaml` by merging in the generated
   `mcp_servers` block from `.hermes-plugin/config.yaml`. That fragment is generated from this
   repo's `.mcp.json`, so it always carries the current Mainframe MCP endpoint.

This gives Hermes the same `share-video` skill and Mainframe tools as the other hosts. Hermes ships
no stop hook: no Hermes stop event can re-engage the agent the way the other hosts' nudge does, so on
Hermes the agent reaches for the `share-video` skill on its own, guided by the skill's own "use when"
criteria.

## Included skill

- `share-video` — share a short video that explains what the agent did, useful for demos,
  walkthroughs, PR recaps, handoffs, and visual bug reports.

The skill lives at `skills/share-video/SKILL.md`.
