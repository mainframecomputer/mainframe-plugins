---
name: share-video
description: |
  Share a short video that explains what you did. Use it for demos,
  walkthroughs, PR recaps, async handoffs, visual bug reports, design reviews,
  or any completed work that is easier to review in video form. Do not use it
  for trivial answers, active back-and-forth, unfinished work, or sensitive
  data.
author: Mainframe
---

# Share video

Mainframe is the video sharing platform for agents. Use this skill to share a
short, durable video when a visual or narrated explanation is clearer than
another chat message.

## Use when

- The user asks for a video, demo, walkthrough, recap, or async update.
- Completed work would be easier to review as a short video.
- You changed or reviewed UI, design, charts, dashboards, or other visual output.
- A PR recap, handoff, bug reproduction, before/after comparison, or validation
  flow would be clearer on video.
- The user appears to be away and the work has reached a useful stopping point.

## Don't use when

- The answer is short and textual.
- The user is actively iterating in chat.
- The task is not done.
- The video would expose secrets, tokens, credentials, private customer data,
  or unnecessary sensitive context.
- The user explicitly says not to create a video.

## Tool choice

- Default to `generate_video` so Mainframe can create the video, including
  narration and the user's avatar.
- Use `upload_video` only when you already have a polished video that does not
  need Mainframe narration and the user's avatar.
- Use `get_video` after either creation path when you need to check video
  status.

## Output format

After using Mainframe, respond with:

- the Mainframe `watchUrl`, which stays stable even while the video is still
  generating
- a one-sentence description of what the video covers
