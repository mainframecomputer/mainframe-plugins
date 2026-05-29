import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { evaluateStopHook } from "../core/subprocess.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const stopPath = join(fixtureDir, "fixtures", "stop.json");
const transcriptPath = join(fixtureDir, "fixtures", "transcript.jsonl");

describe("Cursor stop hook", () => {
  it("uses the Cursor transcript environment path and followup output", () => {
    const output = evaluateStopHook({
      stdin: readFileSync(stopPath, "utf8"),
      env: { CURSOR_TRANSCRIPT_PATH: transcriptPath },
    });

    expect(output).toMatchObject({ followup_message: expect.stringContaining("2.5 hours") });
    expect(output.followup_message).toContain("share-video");
    expect(output.followup_message).not.toContain("SECRET_NEVER_LEAK");
  });

  it("does not fire before the configured threshold", () => {
    const input = JSON.stringify({ event: "stop", timestamp: "2026-05-08T13:30:00.000Z" });
    expect(
      evaluateStopHook({
        stdin: input,
        env: { CURSOR_TRANSCRIPT_PATH: transcriptPath },
      }),
    ).toEqual({});
  });
});
