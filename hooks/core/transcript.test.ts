import { describe, expect, it } from "vitest";

import { summarizeTranscript, summarizeTranscriptFile } from "./transcript.js";

describe("summarizeTranscript", () => {
  it("summarizes Cursor tool work after the last user message", () => {
    const summary = summarizeTranscript(
      cursorTranscript([
        {
          timestamp: "2026-05-08T12:00:00.000Z",
          event: "user_message",
          text: "earlier request",
        },
        {
          timestamp: "2026-05-08T13:00:00.000Z",
          event: "user_message",
          text: "final request",
        },
        {
          timestamp: "2026-05-08T13:05:00.000Z",
          event: "tool_call",
          name: "shell",
          args: { command: "bun run build" },
        },
      ]),
    );

    expect(summary).toEqual({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
      alreadyShared: false,
    });
  });

  it("detects an existing Mainframe share from Cursor tool output", () => {
    const summary = summarizeTranscript(
      cursorTranscript([
        {
          timestamp: "2026-05-08T13:00:00.000Z",
          event: "user_message",
          text: "please work on this",
        },
        {
          timestamp: "2026-05-08T13:30:00.000Z",
          event: "tool_call",
          name: "generate_video",
          output: { watchUrl: "https://mainframe.app/watch/abc" },
        },
      ]),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      workHappened: true,
      alreadyShared: true,
    });
  });

  it("ignores Mainframe mentions without explicit Cursor tool output", () => {
    const summary = summarizeTranscript(
      cursorTranscript([
        {
          timestamp: "2026-05-08T13:00:00.000Z",
          event: "user_message",
          text: "please work on this",
        },
        {
          timestamp: "2026-05-08T13:05:00.000Z",
          event: "tool_call",
          name: "shell",
          args: { command: "echo done" },
        },
        {
          timestamp: "2026-05-08T13:30:00.000Z",
          event: "assistant_message",
          text: "Maybe use share-video later: https://mainframe.app/watch/not-real",
        },
      ]),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      workHappened: true,
      alreadyShared: false,
    });
  });

  it("summarizes full transcripts instead of only a byte tail", () => {
    const summary = summarizeTranscript(
      cursorTranscript([
        {
          timestamp: "2026-05-08T13:00:00.000Z",
          event: "user_message",
          text: "please work on this",
        },
        {
          timestamp: "2026-05-08T13:05:00.000Z",
          event: "tool_call",
          name: "shell",
          args: { command: "bun run build" },
        },
        {
          timestamp: "2026-05-08T13:30:00.000Z",
          event: "assistant_message",
          text: "x".repeat(70_000),
        },
      ]),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
    });
  });

  it("does not treat non-Cursor transcript shapes as user or work rows", () => {
    expect(
      summarizeTranscript(
        [
          JSON.stringify({
            timestamp: "2026-05-08T13:00:00.000Z",
            role: "user",
            content: "please work on this",
          }),
          JSON.stringify({
            timestamp: "2026-05-08T13:05:00.000Z",
            content: { type: "tool_use", name: "Bash" },
          }),
        ].join("\n"),
      ),
    ).toEqual({ kind: "no-user" });
  });

  it("uses a discriminated state when no real user is present", () => {
    expect(
      summarizeTranscript(JSON.stringify({ event: "assistant_message", text: "done" })),
    ).toEqual({
      kind: "no-user",
    });
  });

  it("uses a discriminated state when the transcript file cannot be read", () => {
    expect(summarizeTranscriptFile("/tmp/mainframe-missing-transcript.jsonl")).toEqual({
      kind: "unreadable",
    });
  });
});

function cursorTranscript(rows: Array<Record<string, unknown>>): string {
  return rows.map((row) => JSON.stringify(row)).join("\n");
}
