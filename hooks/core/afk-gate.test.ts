import { describe, expect, it } from "vitest";

import {
  DEFAULT_AFK_THRESHOLD_MS,
  evaluateAfkGate,
  MS_PER_HOUR,
  thresholdMsFromEnv,
} from "./afk-gate.js";

describe("evaluateAfkGate", () => {
  it("fires after the threshold when work happened and no video was shared", () => {
    const result = evaluateAfkGate({
      stopTimeMs: Date.parse("2026-05-08T15:30:00.000Z"),
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      thresholdMs: MS_PER_HOUR,
      workHappened: true,
      alreadyShared: false,
    });

    expect(result).toEqual({
      fire: true,
      reason:
        "The user has been away for about 2.5 hours while you worked. Consider using the share-video skill to leave a short Mainframe video summarizing what you did, then stop. If sensitive content makes a video unwise, ignore this hint and stop normally.",
    });
  });

  it("does not fire when there was no agent work", () => {
    expect(
      evaluateAfkGate({
        stopTimeMs: Date.parse("2026-05-08T15:30:00.000Z"),
        lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
        thresholdMs: MS_PER_HOUR,
        workHappened: false,
        alreadyShared: false,
      }),
    ).toEqual({ fire: false });
  });

  it("uses one hour as the default threshold", () => {
    expect(thresholdMsFromEnv(undefined)).toBe(DEFAULT_AFK_THRESHOLD_MS);
    expect(thresholdMsFromEnv("")).toBe(DEFAULT_AFK_THRESHOLD_MS);
    expect(thresholdMsFromEnv("2.5")).toBe(2.5 * MS_PER_HOUR);
  });

  it("rejects invalid configured thresholds instead of hiding them", () => {
    expect(() => thresholdMsFromEnv("nope")).toThrow();
    expect(() => thresholdMsFromEnv("-1")).toThrow();
  });
});
