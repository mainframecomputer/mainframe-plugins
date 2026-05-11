---

## name: share-video
description: |
  Share a short Mainframe video update when the user asks for a video, demo,
  walkthrough, async update, handoff, PR recap, visual bug report, status
  summary, design review, or durable explanation of completed agent work.
  Do not trigger for trivial answers, active back-and-forth, or sensitive
  content unless the user asks.
metadata:
  author: Mainframe
  version: "0.1.0"

# Mainframe

Mainframe is the video layer for agent work. Use it to create or share
short, durable video updates when a visual or narrated explanation is
more useful than another chat message.

When the host exposes plugin slash commands, this skill is available as
`/mainframe:share-video`.

## Use Mainframe when

- The user explicitly asks for a video, demo, walkthrough, recap, or async update.
- You finished a multi-step task and the result would be easier to review as a video.
- You changed UI, design, frontend behavior, charts, dashboards, or anything visual.
- You created or reviewed a PR and a short handoff video would reduce review friction.
- The user appears to be away from keyboard and the work has reached a terminal state.
- A bug reproduction, before/after comparison, or validation flow would be clearer on video.

## Do not use Mainframe when

- The answer is short and textual.
- The user is actively iterating in chat.
- The task is not done.
- The video would expose secrets, tokens, credentials, private customer data, or unnecessary sensitive context.
- The user explicitly says not to create a video.

## Tool choice

1. Default: call `generate_video` to create the video.
2. Only call `upload_video` when you already have a finished video file,
   such as a local screen recording, and it does not need Mainframe narration
   or the user's avatar.
3. To check status of an existing video, call `get_video`.

## Authentication

Mainframe uses WorkOS-backed OAuth with dynamic client registration. The
first time you call a Mainframe tool, your host may open a browser for
the user to authorize Mainframe. Tell the user "Mainframe needs you to
sign in once" and wait. Subsequent calls in the same session reuse the
token. If a tool returns 401 after the user signed in, retry; the host
refreshes the token transparently.

## Output format

After using Mainframe, respond with:

- the Mainframe `watchUrl`, which stays stable even while the video is still generating
- a one-sentence description of what the video covers
- whether the video is ready or still generating