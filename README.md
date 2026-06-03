# Mainframe skills

Mainframe is the video sharing platform for agents. This repository ships the `share-video` skill
and a Cursor plugin.

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
plugin includes the `share-video` skill and Mainframe tools.

## Included skill

- `share-video` — share a short video that explains what the agent did, useful for demos,
  walkthroughs, PR recaps, handoffs, and visual bug reports.

The skill lives at `skills/share-video/SKILL.md`.
