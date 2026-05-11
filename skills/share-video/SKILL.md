---
name: share-video
description: |
  Share a short video that explains what you did. Use it for demos,
  walkthroughs, async updates, handoffs, PR recaps, visual bug reports, status
  summaries, design reviews, or whenever completed work is easier to review as
  video. Do not use it for trivial answers, active back-and-forth, unfinished
  work, or content that would expose secrets or sensitive data.
author: Mainframe
---

# Mainframe

Mainframe is the video layer for agent work. Use it to create or share
short, durable video updates when a visual or narrated explanation is
more useful than another chat message.

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

Use exactly one creation tool:

1. Call `generate_video` when Mainframe should create the video, including
   narration or the user's avatar.
2. Call `upload_video` instead when you already have a finished video file,
   such as a local screen recording, that does not need Mainframe narration
   or the user's avatar.
3. Call `get_video` only to check the status of an existing video.

## Output format

After using Mainframe, respond with:

- the Mainframe `watchUrl`, which stays stable even while the video is still generating
- a one-sentence description of what the video covers
- whether the video is ready or still generating