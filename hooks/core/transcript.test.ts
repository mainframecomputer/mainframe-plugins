import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

  it("detects an existing Mainframe share from MCP-style text output", () => {
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
          output: {
            content: [
              {
                type: "text",
                text: "Created Mainframe video: https://mainframe.app/watch/abc",
              },
            ],
          },
        },
      ]),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      workHappened: true,
      alreadyShared: true,
    });
  });

  it("detects a Mainframe watch URL without relying on the tool name", () => {
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
          name: "shell",
          output: "https://mainframe.app/watch/not-from-mainframe",
        },
      ]),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      workHappened: true,
      alreadyShared: true,
    });
  });

  it("detects Mainframe watch URLs in assistant messages after work", () => {
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
      alreadyShared: true,
    });
  });

  it("detects Mainframe watch URLs in tool result rows", () => {
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
          event: "tool_result",
          content: [{ type: "text", text: "Shared: https://mainframe.app/watch/result" }],
        },
      ]),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      workHappened: true,
      alreadyShared: true,
    });
  });

  it("does not treat a watch URL in the latest user message as an existing share", () => {
    const summary = summarizeTranscript(
      cursorTranscript([
        {
          timestamp: "2026-05-08T13:00:00.000Z",
          event: "user_message",
          text: "please look at https://mainframe.app/watch/input",
        },
        {
          timestamp: "2026-05-08T13:05:00.000Z",
          event: "tool_call",
          name: "shell",
          args: { command: "echo done" },
        },
      ]),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      workHappened: true,
      alreadyShared: false,
    });
  });

  it("accepts numeric epoch seconds and milliseconds", () => {
    const secondsSummary = summarizeTranscript(
      cursorTranscript([
        {
          timestamp: 1_746_710_400,
          event: "user_message",
          text: "please work on this",
        },
      ]),
    );
    const millisecondsSummary = summarizeTranscript(
      cursorTranscript([
        {
          timestamp: 1_746_710_400_000,
          event: "user_message",
          text: "please work on this",
        },
      ]),
    );

    expect(secondsSummary).toMatchObject({
      kind: "ready",
      lastUserTimeMs: 1_746_710_400_000,
    });
    expect(millisecondsSummary).toMatchObject({
      kind: "ready",
      lastUserTimeMs: 1_746_710_400_000,
    });
  });

  it("rejects ambiguous timestamp strings", () => {
    for (const timestamp of ["2026", "05/08/2026", "2026-05-08"]) {
      expect(
        summarizeTranscript(
          cursorTranscript([
            {
              timestamp,
              event: "user_message",
              text: "please work on this",
            },
            {
              timestamp: "2026-05-08T13:05:00.000Z",
              event: "tool_call",
              name: "shell",
              args: { command: "bun run build" },
            },
          ]),
        ),
      ).toEqual({ kind: "missing-user-time" });
    }
  });

  it("treats out-of-order user timestamps as unreadable", () => {
    expect(
      summarizeTranscript(
        cursorTranscript([
          {
            timestamp: "2026-05-08T15:00:00.000Z",
            event: "user_message",
            text: "latest request",
          },
          {
            timestamp: "2026-05-08T13:00:00.000Z",
            event: "user_message",
            text: "older request emitted later",
          },
          {
            timestamp: "2026-05-08T13:05:00.000Z",
            event: "tool_call",
            name: "shell",
            args: { command: "echo done" },
          },
        ]),
      ),
    ).toEqual({ kind: "unreadable" });
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

  it("treats non-Cursor transcript shapes as unreadable", () => {
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
    ).toEqual({ kind: "unreadable" });
  });

  it("treats user message rows without text as unreadable", () => {
    expect(
      summarizeTranscript(
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          event: "user_message",
        }),
      ),
    ).toEqual({ kind: "unreadable" });
  });

  it("treats unknown non-empty rows as unreadable", () => {
    expect(
      summarizeTranscript(
        cursorTranscript([
          {
            timestamp: "2026-05-08T13:00:00.000Z",
            event: "user_message",
            text: "please work on this",
          },
          {
            timestamp: "2026-05-08T13:05:00.000Z",
            event: "user_message_v2",
            content: "newer user request",
          },
        ]),
      ),
    ).toEqual({ kind: "unreadable" });
  });

  it("treats corrupt non-empty JSONL as unreadable", () => {
    expect(
      summarizeTranscript(
        [
          JSON.stringify({
            timestamp: "2026-05-08T13:00:00.000Z",
            event: "user_message",
            text: "please work on this",
          }),
          "{not-json",
        ].join("\n"),
      ),
    ).toEqual({ kind: "unreadable" });
  });

  it("treats non-object JSONL rows as unreadable", () => {
    expect(summarizeTranscript(JSON.stringify(["not", "a", "cursor", "row"]))).toEqual({
      kind: "unreadable",
    });
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

  it("treats oversized transcript files as unreadable", () => {
    const directory = mkdtempSync(join(tmpdir(), "mainframe-transcript-test-"));
    const path = join(directory, "oversized.jsonl");
    writeFileSync(path, "x".repeat(5 * 1024 * 1024 + 1));

    expect(summarizeTranscriptFile(path)).toEqual({ kind: "unreadable" });
  });

  it("treats symlink transcript paths as unreadable", () => {
    const directory = mkdtempSync(join(tmpdir(), "mainframe-transcript-test-"));
    const sourcePath = join(directory, "source.jsonl");
    const symlinkPath = join(directory, "linked.jsonl");
    writeFileSync(
      sourcePath,
      cursorTranscript([
        {
          timestamp: "2026-05-08T13:00:00.000Z",
          event: "user_message",
          text: "please work on this",
        },
      ]),
    );
    symlinkSync(sourcePath, symlinkPath);

    expect(summarizeTranscriptFile(symlinkPath)).toEqual({ kind: "unreadable" });
  });
});

function cursorTranscript(rows: Array<Record<string, unknown>>): string {
  return rows.map((row) => JSON.stringify(row)).join("\n");
}
