import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { evaluateStopHook } from "../core/subprocess.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const stopPath = join(fixtureDir, "fixtures", "stop.json");
const transcriptPath = join(fixtureDir, "fixtures", "transcript.jsonl");
const stopTimeMs = Date.parse("2026-05-08T15:30:00.000Z");

describe("Cursor stop hook", () => {
  it("uses the Cursor transcript path and followup output", () => {
    const output = evaluateStopHook({
      stdin: stopInput({ transcript_path: transcriptPath }),
      nowMs: stopTimeMs,
    });

    expect(output).toMatchObject({ followup_message: expect.stringContaining("2.5 hours") });
    expect(output.followup_message).toContain("share-video");
    expect(output.followup_message).not.toContain("SECRET_NEVER_LEAK");
  });

  it("does not fire before the configured threshold", () => {
    expect(
      evaluateStopHook({
        stdin: stopInput({ transcript_path: transcriptPath }),
        nowMs: Date.parse("2026-05-08T13:30:00.000Z"),
      }),
    ).toEqual({});
  });

  it("does not fire for aborted or errored stops", () => {
    for (const status of ["aborted", "error"]) {
      expect(
        evaluateStopHook({
          stdin: stopInput({ status, transcript_path: transcriptPath }),
          nowMs: stopTimeMs,
        }),
      ).toEqual({});
    }
  });

  it("does not fire after an automatic followup already looped", () => {
    expect(
      evaluateStopHook({
        stdin: stopInput({ loop_count: 1, transcript_path: transcriptPath }),
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
