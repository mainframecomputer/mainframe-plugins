import { describe, expect, it } from "vitest";

import { summarizeTranscript, summarizeTranscriptFile } from "./transcript.js";

describe("summarizeTranscript", () => {
  it("summarizes recent work after the last real user message", () => {
    const summary = summarizeTranscript(
      [
        JSON.stringify({
          timestamp: "2026-05-08T12:00:00.000Z",
          type: "user",
          message: { role: "user", content: "earlier request" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          type: "user",
          message: { role: "user", content: "final request" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:05:00.000Z",
          type: "assistant",
          content: [{ type: "tool_use", name: "bash" }],
        }),
      ].join("\n"),
    );

    expect(summary).toEqual({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
      alreadyShared: false,
    });
  });

  it("does not treat tool-result user records as the last external user", () => {
    const summary = summarizeTranscript(
      [
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          type: "user",
          message: { role: "user", content: "actual user" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:10:00.000Z",
          type: "user",
          toolUseResult: { content: "tool result" },
          message: { role: "user" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:15:00.000Z",
          tool_use_result: { name: "bash" },
        }),
      ].join("\n"),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
    });
    if (summary.kind !== "ready") {
      throw new Error("expected a ready transcript summary");
    }
    expect(summary.workHappened).toBe(true);
  });

  it("detects an existing Mainframe share after the user message", () => {
    const summary = summarizeTranscript(
      [
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          role: "user",
          content: "please work on this",
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:30:00.000Z",
          tool_call: {
            name: "generate_video",
            output: { watchUrl: "https://mainframe.app/watch/abc" },
          },
        }),
      ].join("\n"),
    );

    expect(summary).toMatchObject({ kind: "ready" });
    if (summary.kind !== "ready") {
      throw new Error("expected a ready transcript summary");
    }
    expect(summary.workHappened).toBe(true);
    expect(summary.alreadyShared).toBe(true);
  });

  it("detects Mainframe shares in tool_calls arrays", () => {
    const summary = summarizeTranscript(
      [
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          role: "user",
          content: "please work on this",
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:30:00.000Z",
          tool_calls: [
            {
              name: "generate_video",
              output: { watchUrl: "https://mainframe.app/watch/abc" },
            },
          ],
        }),
      ].join("\n"),
    );

    expect(summary).toMatchObject({ kind: "ready" });
    if (summary.kind !== "ready") {
      throw new Error("expected a ready transcript summary");
    }
    expect(summary.workHappened).toBe(true);
    expect(summary.alreadyShared).toBe(true);
  });

  it("bounds nested tool payload inspection", () => {
    let nested: Record<string, unknown> = { name: "generate_video" };
    for (let index = 0; index < 50; index += 1) {
      nested = { toolCall: nested };
    }

    const summary = summarizeTranscript(
      [
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          role: "user",
          content: "please work on this",
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:30:00.000Z",
          toolCall: nested,
        }),
      ].join("\n"),
    );

    expect(summary).toMatchObject({ kind: "ready" });
    if (summary.kind !== "ready") {
      throw new Error("expected a ready transcript summary");
    }
    expect(summary.workHappened).toBe(true);
    expect(summary.alreadyShared).toBe(false);
  });

  it("does not treat a share-video mention as an existing Mainframe share", () => {
    const summary = summarizeTranscript(
      [
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          role: "user",
          content: "please work on this",
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:05:00.000Z",
          tool_call: { name: "shell" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:30:00.000Z",
          role: "assistant",
          content: "Maybe use share-video later.",
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:31:00.000Z",
          type: "model",
          name: "generate_video",
        }),
      ].join("\n"),
    );

    expect(summary).toMatchObject({ kind: "ready" });
    if (summary.kind !== "ready") {
      throw new Error("expected a ready transcript summary");
    }
    expect(summary.workHappened).toBe(true);
    expect(summary.alreadyShared).toBe(false);
  });

  it("summarizes full transcripts instead of only a byte tail", () => {
    const summary = summarizeTranscript(
      [
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          role: "user",
          content: "please work on this",
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:05:00.000Z",
          tool_call: { name: "shell" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:30:00.000Z",
          role: "assistant",
          content: "x".repeat(70_000),
        }),
      ].join("\n"),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
    });
  });

  it("does not treat generic record names as tool work", () => {
    const summary = summarizeTranscript(
      [
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          role: "user",
          content: "please work on this",
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:05:00.000Z",
          name: "command-r-plus",
          type: "model",
        }),
      ].join("\n"),
    );

    expect(summary).toMatchObject({ kind: "ready" });
    if (summary.kind !== "ready") {
      throw new Error("expected a ready transcript summary");
    }
    expect(summary.workHappened).toBe(false);
  });

  it("treats camel-case toolCall records as work", () => {
    const summary = summarizeTranscript(
      [
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          role: "user",
          content: "please work on this",
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:05:00.000Z",
          toolCall: { name: "bash" },
        }),
      ].join("\n"),
    );

    expect(summary).toMatchObject({ kind: "ready" });
    if (summary.kind !== "ready") {
      throw new Error("expected a ready transcript summary");
    }
    expect(summary.workHappened).toBe(true);
  });

  it("uses a discriminated state when no real user is present", () => {
    expect(summarizeTranscript(JSON.stringify({ type: "assistant", content: "done" }))).toEqual({
      kind: "no-user",
    });
  });

  it("uses a discriminated state when the transcript file cannot be read", () => {
    expect(summarizeTranscriptFile("/tmp/mainframe-missing-transcript.jsonl")).toEqual({
      kind: "unreadable",
    });
  });
});
