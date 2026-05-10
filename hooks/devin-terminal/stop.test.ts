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

describe("Devin Terminal Stop hook", () => {
  it("uses the Claude-compatible block decision", () => {
    const output = evaluateStopHook("devin-terminal", { stdin: fixtureInput({}), env: {} });

    expect(output).toMatchObject({ decision: "block" });
    expect(output.reason).toContain("2.5 hours");
    expect(output.reason).not.toContain("SECRET_NEVER_LEAK");
  });

  it("does not run when already inside a stop hook", () => {
    expect(
      evaluateStopHook("devin-terminal", {
        stdin: fixtureInput({ stop_hook_active: true }),
        env: {},
      }),
    ).toEqual({});
  });
});
