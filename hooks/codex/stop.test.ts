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

describe("Codex Stop hook", () => {
  it("returns the Codex block decision without hook-specific output", () => {
    const output = evaluateStopHook("codex", { stdin: fixtureInput({}), env: {} });

    expect(output).toEqual({
      decision: "block",
      reason:
        "The user has been away for about 2.5 hours while you worked. Consider using the share-video skill to leave a short Mainframe video summarizing what you did, then stop. If sensitive content makes a video unwise, ignore this hint and stop normally.",
    });
    expect(output).not.toHaveProperty("hookSpecificOutput");
  });

  it("respects the stopHookActive loop guard spelling", () => {
    expect(
      evaluateStopHook("codex", { stdin: fixtureInput({ stopHookActive: true }), env: {} }),
    ).toEqual({});
  });
});
