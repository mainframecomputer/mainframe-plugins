import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { evaluateCodexStopHook } from "./stop-evaluator.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const stopPath = join(fixtureDir, "fixtures", "stop.json");
const transcriptPath = join(fixtureDir, "fixtures", "transcript.jsonl");
const stopTimeMs = Date.parse("2026-05-08T15:30:00.000Z");

describe("Codex stop hook", () => {
  it("continues with a share-video prompt after the user is away", () => {
    const output = evaluateCodexStopHook({
      stdin: stopInput({ transcript_path: transcriptPath }),
      nowMs: stopTimeMs,
    });

    expect(output.decision).toBe("block");
    expect(output.reason).toContain("2.5 hours");
    expect(output.reason).toContain("share-video");
    expect(output.reason).not.toContain("SECRET_NEVER_LEAK");
  });

  it("does not fire before the fixed one-hour threshold", () => {
    expect(
      evaluateCodexStopHook({
        stdin: stopInput({ transcript_path: transcriptPath }),
        nowMs: Date.parse("2026-05-08T13:30:00.000Z"),
      }),
    ).toEqual({});
  });

  it("does not fire for non-stop hook events", () => {
    for (const hook_event_name of ["SessionStart", "stop", "UserPromptSubmit"]) {
      expect(
        evaluateCodexStopHook({
          stdin: stopInput({ hook_event_name, transcript_path: transcriptPath }),
          nowMs: stopTimeMs,
        }),
      ).toEqual({});
    }
  });

  it("does not fire after a continuation already looped", () => {
    expect(
      evaluateCodexStopHook({
        stdin: stopInput({ stop_hook_active: true, transcript_path: transcriptPath }),
        nowMs: stopTimeMs,
      }),
    ).toEqual({});
  });

  it("does not fire when the transcript path is missing or empty", () => {
    for (const transcript_path of [undefined, null, ""]) {
      expect(
        evaluateCodexStopHook({
          stdin: stopInput({ transcript_path }),
          nowMs: stopTimeMs,
        }),
      ).toEqual({});
    }
  });

  it("does not fire when no work happened since the last user message", () => {
    const directory = mkdtempSync(join(tmpdir(), "mainframe-codex-stop-test-"));
    const path = join(directory, "rollout.jsonl");
    writeFileSync(
      path,
      [
        JSON.stringify({
          timestamp: "2026-05-08T12:55:00.000Z",
          type: "session_meta",
          payload: { id: "session-1", cwd: "/workspace" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          type: "event_msg",
          payload: { type: "user_message", message: "please work on this", kind: "plain" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:30:00.000Z",
          type: "event_msg",
          payload: { type: "agent_message", message: "Here is my answer." },
        }),
      ].join("\n"),
    );

    expect(
      evaluateCodexStopHook({
        stdin: stopInput({ transcript_path: path }),
        nowMs: stopTimeMs,
      }),
    ).toEqual({});
  });

  it("does not fire after a Mainframe video URL appears in tool output", () => {
    const directory = mkdtempSync(join(tmpdir(), "mainframe-codex-stop-test-"));
    const path = join(directory, "rollout.jsonl");
    writeFileSync(
      path,
      [
        JSON.stringify({
          timestamp: "2026-05-08T12:55:00.000Z",
          type: "session_meta",
          payload: { id: "session-1", cwd: "/workspace" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          type: "event_msg",
          payload: { type: "user_message", message: "please work on this", kind: "plain" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:05:00.000Z",
          type: "response_item",
          payload: { type: "function_call", name: "shell", arguments: "{}", call_id: "call_1" },
        }),
        JSON.stringify({
          timestamp: "2026-05-08T13:30:00.000Z",
          type: "response_item",
          payload: {
            type: "function_call_output",
            call_id: "call_1",
            output: "Shared: https://mainframe.app/v/37507089004e8f3700deb918a48b2556",
          },
        }),
      ].join("\n"),
    );

    expect(
      evaluateCodexStopHook({
        stdin: stopInput({ transcript_path: path }),
        nowMs: stopTimeMs,
      }),
    ).toEqual({});
  });
});

function stopInput(overrides: Record<string, unknown>): string {
  return JSON.stringify({
    ...JSON.parse(readFileSync(stopPath, "utf8")),
    ...overrides,
  });
}
