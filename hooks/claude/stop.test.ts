import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { jsonObjectSchema } from "../core/json.js";
import { evaluateStopHook } from "../core/subprocess.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const stopPath = join(fixtureDir, "fixtures", "stop.json");
const transcriptPath = join(fixtureDir, "fixtures", "transcript.jsonl");

function fixtureInput(overrides: Record<string, unknown>): string {
  const input = jsonObjectSchema.parse(JSON.parse(readFileSync(stopPath, "utf8")));
  input.transcript_path = transcriptPath;
  return JSON.stringify({ ...input, ...overrides });
}

describe("Claude Stop hook", () => {
  it("blocks with a transcript-free Mainframe suggestion", () => {
    const output = evaluateStopHook("claude", { stdin: fixtureInput({}), env: {} });

    expect(output).toMatchObject({ decision: "block" });
    expect(output.reason).toContain("2.5 hours");
    expect(output.reason).toContain("share-video");
    expect(output.reason).not.toContain("SECRET_NEVER_LEAK");
  });

  it("does not run when disabled or already inside a stop hook", () => {
    expect(
      evaluateStopHook("claude", { stdin: fixtureInput({}), env: { MAINFRAME_HOOK: "0" } }),
    ).toEqual({});
    expect(
      evaluateStopHook("claude", { stdin: fixtureInput({ stop_hook_active: true }), env: {} }),
    ).toEqual({});
  });

  it("does not recursively search unrelated nested transcript paths", () => {
    expect(
      evaluateStopHook("claude", {
        stdin: JSON.stringify({
          timestamp: "2026-05-08T15:30:00.000Z",
          nested: { transcript_path: transcriptPath },
        }),
        env: {},
      }),
    ).toEqual({});
  });
});
