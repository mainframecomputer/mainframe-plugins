import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { evaluateCursorStopHook } from "./stop-evaluator.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const stopPath = join(fixtureDir, "fixtures", "stop.json");
const transcriptPath = join(fixtureDir, "fixtures", "transcript.jsonl");
const stopTimeMs = Date.parse("2026-05-08T15:30:00.000Z");

describe("Cursor stop hook", () => {
  it("uses the Cursor transcript path and followup output", () => {
    const output = evaluateCursorStopHook({
      stdin: stopInput({ transcript_path: transcriptPath }),
      nowMs: stopTimeMs,
    });
    const message = output.followup_message;

    expect(typeof message).toBe("string");
    expect(message).toContain("2.5 hours");
    expect(message).toContain("share-video");
    expect(message).not.toContain("SECRET_NEVER_LEAK");
  });

  it("does not fire before the fixed one-hour threshold", () => {
    expect(
      evaluateCursorStopHook({
        stdin: stopInput({ transcript_path: transcriptPath }),
        nowMs: Date.parse("2026-05-08T13:30:00.000Z"),
      }),
    ).toEqual({});
  });

  it("does not fire for aborted or errored stops", () => {
    for (const status of ["aborted", "error"]) {
      expect(
        evaluateCursorStopHook({
          stdin: stopInput({ status, transcript_path: transcriptPath }),
          nowMs: stopTimeMs,
        }),
      ).toEqual({});
    }
  });

  it("does not fire for non-stop hook events", () => {
    expect(
      evaluateCursorStopHook({
        stdin: stopInput({ hook_event_name: "pre-submit", transcript_path: transcriptPath }),
        nowMs: stopTimeMs,
      }),
    ).toEqual({});
  });

  it("does not fire after an automatic followup already looped", () => {
    expect(
      evaluateCursorStopHook({
        stdin: stopInput({ loop_count: 1, transcript_path: transcriptPath }),
        nowMs: stopTimeMs,
      }),
    ).toEqual({});
  });

  it("does not fire after a Mainframe watch URL appears in an unknown transcript row", () => {
    const directory = mkdtempSync(join(tmpdir(), "mainframe-stop-test-"));
    const path = join(directory, "transcript.jsonl");
    writeFileSync(
      path,
      [
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          event: "user_message",
          text: "please work on this",
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:05:00.000Z",
          event: "tool_call",
          name: "shell",
          args: { command: "echo done" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:30:00.000Z",
          event: "tool_result",
          content: [{ type: "text", text: "Shared: https://mainframe.app/watch/result" }],
        }),
      ].join("\n"),
    );

    expect(
      evaluateCursorStopHook({
        stdin: stopInput({ transcript_path: path }),
        nowMs: stopTimeMs,
      }),
    ).toEqual({});
  });

  it("does not fire after an unknown later user-like transcript row", () => {
    const directory = mkdtempSync(join(tmpdir(), "mainframe-stop-test-"));
    const path = join(directory, "transcript.jsonl");
    writeFileSync(
      path,
      [
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          event: "user_message",
          text: "please work on this",
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:05:00.000Z",
          event: "tool_call",
          name: "shell",
          args: { command: "echo done" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T15:25:00.000Z",
          event: "user_message_v2",
          content: "fresh user activity",
        }),
      ].join("\n"),
    );

    expect(
      evaluateCursorStopHook({
        stdin: stopInput({ transcript_path: path }),
        nowMs: stopTimeMs,
      }),
    ).toEqual({});
  });

  it("does not fire when loop count is missing or malformed", () => {
    for (const loop_count of [undefined, null, "0", Number.NaN, 0.5, -1]) {
      expect(
        evaluateCursorStopHook({
          stdin: stopInput({ loop_count, transcript_path: transcriptPath }),
          nowMs: stopTimeMs,
        }),
      ).toEqual({});
    }
  });

  it("does not fire when the transcript path is missing or empty", () => {
    for (const transcript_path of [undefined, null, ""]) {
      expect(
        evaluateCursorStopHook({
          stdin: stopInput({ transcript_path }),
          nowMs: stopTimeMs,
        }),
      ).toEqual({});
    }
  });
});

function stopInput(overrides: Record<string, unknown>): string {
  return JSON.stringify({
    ...JSON.parse(readFileSync(stopPath, "utf8")),
    ...overrides,
  });
}
