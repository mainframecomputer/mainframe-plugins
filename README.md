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

[Hermes](https://hermes-agent.nousresearch.com) is config-driven rather than manifest-based, so the
Mainframe plugin for Hermes is wired through `~/.hermes/config.yaml` plus the shared skill. The
generated fragment to merge in lives at `.hermes-plugin/config.yaml`.

1. Build this repository so the stop-hook runtime is available, and expose its `mainframe-hook-hermes`
   command on your `PATH`:

   ```sh
   bun install && bun run build && bun link
   ```

   You can instead point the hook at the built script directly with
   `node /absolute/path/to/dist/hooks/hermes/stop.js`.

2. Merge the MCP server and the stop hook into `~/.hermes/config.yaml`:

   ```yaml
   mcp_servers:
     mainframe:
       url: https://mcp.mainframe.app/mcp
   hooks:
     pre_llm_call:
       - command: mainframe-hook-hermes
         timeout: 30
   ```

   Hermes asks for consent the first time it runs a shell hook (or set `hooks_auto_accept: true`).

3. Load the `share-video` skill by pointing Hermes at this repository's `skills` directory:

   ```yaml
   skills:
     external_dirs:
       - /absolute/path/to/mainframe-plugins/skills
   ```

The Hermes stop hook runs on `pre_llm_call`, the one hook event whose output Hermes feeds back to
the agent. Hermes hook payloads carry no timestamps, so there is no "away for N hours" timer like
the other hosts; instead the hook nudges the agent toward the `share-video` skill at the start of a
turn when the previous turn did real work and no Mainframe video has been shared yet.

## Included skill

- `share-video` — share a short video that explains what the agent did, useful for demos,
  walkthroughs, PR recaps, handoffs, and visual bug reports.

The skill lives at `skills/share-video/SKILL.md`.
