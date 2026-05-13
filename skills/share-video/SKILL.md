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

Mainframe is the video sharing platform for agents. Use this skill to share a short, durable video
when a narrated explanation is clearer than another chat message.

## Use when

- The user asks for a video, demo, walkthrough, recap, or async update.
- Completed work would be easier to review as a short video.
- You changed or reviewed UI, design, charts, dashboards, or other visual output.
- A PR recap, handoff, bug reproduction, before/after comparison, or validation flow would be
  clearer on video.
- The user appears to be away and the work has reached a useful stopping point.

## Don't use when

- The answer is short and textual.
- The user is actively iterating in chat.
- The task is not done.
- The video would expose secrets, tokens, credentials, private customer data, or unnecessary
  sensitive context.
- The user explicitly says not to create a video.

## Tool choice

- Default to `generate_video` so Mainframe can create the video, including narration and the user's
  avatar.
- Use `upload_video` only when you already have a polished video that does not need Mainframe
  narration and the user's avatar.
- Use `get_video` after either creation path when you need to check video status.

## `generate_video` prompt

Treat `prompt.text` as source material for the video agent, not as creative direction. Include as
much factual context as needed for an accurate recap; do not optimize for brevity when extra detail
would prevent guessing.

Include relevant context such as:

- The user's original request and the current completion state.
- Repo, branch, commit, issue, or PR links.
- Files, features, workflows, or product areas that changed.
- Important implementation details, decisions, tradeoffs, and constraints.
- Tests, validation steps, results, failures, screenshots, logs, or other artifacts the video should
  accurately explain.
- Blockers, follow-ups, review risks, or anything the viewer must know next.
- The exact takeaway the viewer should have after watching.

For PR recaps, include the PR title and URL, base and head branches, linked issues, summary of
changes, notable files, test evidence, screenshots or demo artifacts, and reviewer-relevant risks.

Do not prescribe visual style, storytelling, pacing, scene count, shot list, camera direction,
composition, colors, or mood unless the user explicitly asked for those choices. If screenshots or
other images are useful context, attach them as `prompt.images` and describe what each one shows in
`prompt.text`.

## Output format

After using Mainframe, respond with:

- the Mainframe `watchUrl`, which stays stable even while the video is still generating
- a one-sentence description of what the video covers
