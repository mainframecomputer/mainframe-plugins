import { describe, expect, it } from "vitest";

import { DEFAULT_AFK_THRESHOLD_MS, evaluateAfkGate, MS_PER_HOUR } from "./afk-gate.js";

describe("evaluateAfkGate", () => {
  it("fires after the threshold when work happened and no video was shared", () => {
    const result = evaluateAfkGate({
      stopTimeMs: Date.parse("2026-05-08T15:30:00.000Z"),
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
      alreadyShared: false,
    });

    expect(result).toEqual({
      fire: true,
      reason:
        "The user has been away for about 2.5 hours while you worked. Consider using the share-video skill to leave a short Mainframe video summarizing what you did, then stop.",
    });
  });

  it("does not fire when there was no agent work", () => {
    expect(
      evaluateAfkGate({
        stopTimeMs: Date.parse("2026-05-08T15:30:00.000Z"),
        lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
        workHappened: false,
        alreadyShared: false,
      }),
    ).toEqual({ fire: false });
  });

  it("uses one hour as the default threshold", () => {
    expect(DEFAULT_AFK_THRESHOLD_MS).toBe(MS_PER_HOUR);

    expect(
      evaluateAfkGate({
        stopTimeMs: Date.parse("2026-05-08T13:59:59.000Z"),
        lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
        workHappened: true,
        alreadyShared: false,
      }),
    ).toEqual({ fire: false });
  });
});
