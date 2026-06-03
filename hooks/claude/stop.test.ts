import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { evaluateClaudeStopHook } from "./stop-evaluator.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const stopPath = join(fixtureDir, "fixtures", "stop.json");
const transcriptPath = join(fixtureDir, "fixtures", "transcript.jsonl");
const stopTimeMs = Date.parse("2026-05-08T15:30:00.000Z");

describe("Claude stop hook", () => {
  it("blocks with a share-video prompt after the user is away", () => {
    const output = evaluateClaudeStopHook({
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
      evaluateClaudeStopHook({
        stdin: stopInput({ transcript_path: transcriptPath }),
        nowMs: Date.parse("2026-05-08T13:30:00.000Z"),
      }),
    ).toEqual({});
  });

  it("does not fire for non-stop hook events", () => {
    for (const hook_event_name of ["SessionStart", "stop", "UserPromptSubmit", "SubagentStop"]) {
      expect(
        evaluateClaudeStopHook({
          stdin: stopInput({ hook_event_name, transcript_path: transcriptPath }),
          nowMs: stopTimeMs,
        }),
      ).toEqual({});
    }
  });

  it("does not fire after a continuation already looped", () => {
    expect(
      evaluateClaudeStopHook({
        stdin: stopInput({ stop_hook_active: true, transcript_path: transcriptPath }),
        nowMs: stopTimeMs,
      }),
    ).toEqual({});
  });

  it("does not fire when the transcript path is missing or empty", () => {
    for (const transcript_path of [undefined, null, ""]) {
      expect(
        evaluateClaudeStopHook({
          stdin: stopInput({ transcript_path }),
          nowMs: stopTimeMs,
        }),
      ).toEqual({});
    }
  });

  it("does not fire when no work happened since the last user message", () => {
    const directory = mkdtempSync(join(tmpdir(), "mainframe-claude-stop-test-"));
    const path = join(directory, "transcript.jsonl");
    writeFileSync(
      path,
      [
        JSON.stringify({
          type: "user",
          timestamp: "2026-05-08T13:00:00.000Z",
          sessionId: "session-1",
          uuid: "u1",
          parentUuid: null,
          message: { role: "user", content: "please answer" },
        }),
        JSON.stringify({
          type: "assistant",
          timestamp: "2026-05-08T13:30:00.000Z",
          sessionId: "session-1",
          uuid: "a1",
          parentUuid: "u1",
          message: { role: "assistant", content: [{ type: "text", text: "Here is my answer." }] },
        }),
      ].join("\n"),
    );

    expect(
      evaluateClaudeStopHook({
        stdin: stopInput({ transcript_path: path }),
        nowMs: stopTimeMs,
      }),
    ).toEqual({});
  });

  it("does not fire after a Mainframe video URL appears in tool output", () => {
    const directory = mkdtempSync(join(tmpdir(), "mainframe-claude-stop-test-"));
    const path = join(directory, "transcript.jsonl");
    writeFileSync(
      path,
      [
        JSON.stringify({
          type: "user",
          timestamp: "2026-05-08T13:00:00.000Z",
          sessionId: "session-1",
          uuid: "u1",
          parentUuid: null,
          message: { role: "user", content: "please work on this" },
        }),
        JSON.stringify({
          type: "assistant",
          timestamp: "2026-05-08T13:05:00.000Z",
          sessionId: "session-1",
          uuid: "a1",
          parentUuid: "u1",
          message: {
            role: "assistant",
            content: [
              { type: "tool_use", id: "toolu_1", name: "mcp__mainframe__create_video", input: {} },
            ],
          },
        }),
        JSON.stringify({
          type: "user",
          timestamp: "2026-05-08T13:30:00.000Z",
          sessionId: "session-1",
          uuid: "u2",
          parentUuid: "a1",
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "toolu_1",
                content: "Shared: https://mainframe.app/v/37507089004e8f3700deb918a48b2556",
              },
            ],
          },
        }),
      ].join("\n"),
    );

    expect(
      evaluateClaudeStopHook({
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
