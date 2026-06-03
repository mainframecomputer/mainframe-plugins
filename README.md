# Mainframe plugins

Mainframe is the video sharing platform for agents. This repository ships the `share-video` skill
and Mainframe plugins for Cursor and Codex.

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

Install the Mainframe plugin from the Cursor marketplace. The plugin bundles the `share-video`
skill, Mainframe MCP wiring, and a stop hook that suggests a short video update after meaningful
agent work when the user has been away.

### Codex

Add this repository as a Codex plugin marketplace, then install Mainframe from the `/plugins`
browser in the Codex CLI:

```sh
codex plugin marketplace add mainframecomputer/mainframe-plugins
```

The Codex plugin bundles the same `share-video` skill, Mainframe MCP wiring, and stop hook as the
Cursor plugin. Codex asks you to review and trust the bundled hook before it runs.

## Included skill

- `share-video` — share a short video that explains what the agent did, useful for demos,
  walkthroughs, PR recaps, handoffs, and visual bug reports.

The skill lives at `skills/share-video/SKILL.md`.
