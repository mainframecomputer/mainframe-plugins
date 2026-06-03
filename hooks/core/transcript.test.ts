import { describe, expect, it } from "vitest";

import type { JsonRecord } from "./json.js";
import { accumulateClassifiedRows, type ClassifiedRowKind } from "./transcript.js";

// A synthetic classifier so these tests cover the shared accumulation invariants
// independently of any host's wire format: rows carry their own kind.
function classify(record: JsonRecord): ClassifiedRowKind {
  if (record.kind === "user" || record.kind === "work") {
    return record.kind;
  }
  return "ignore";
}

function row(kind: ClassifiedRowKind, extra: Record<string, unknown> = {}): JsonRecord {
  return { kind, ...extra };
}

function accumulate(records: JsonRecord[]) {
  return accumulateClassifiedRows(records, classify);
}

describe("accumulateClassifiedRows", () => {
  it("accumulates work after the last user turn", () => {
    expect(
      accumulate([
        row("user", { timestamp: "2026-05-08T12:00:00.000Z" }),
        row("user", { timestamp: "2026-05-08T13:00:00.000Z" }),
        row("work", { timestamp: "2026-05-08T13:05:00.000Z" }),
      ]),
    ).toEqual({
      sawUser: true,
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
      alreadyShared: false,
    });
  });

  it("resets work and share state on each user turn", () => {
    expect(
      accumulate([
        row("user", { timestamp: "2026-05-08T13:00:00.000Z" }),
        row("work", { timestamp: "2026-05-08T13:05:00.000Z" }),
        row("user", { timestamp: "2026-05-08T14:00:00.000Z" }),
      ]),
    ).toEqual({
      sawUser: true,
      lastUserTimeMs: Date.parse("2026-05-08T14:00:00.000Z"),
      workHappened: false,
      alreadyShared: false,
    });
  });

  it("fails closed when user timestamps move backwards", () => {
    expect(
      accumulate([
        row("user", { timestamp: "2026-05-08T15:00:00.000Z" }),
        row("user", { timestamp: "2026-05-08T13:00:00.000Z" }),
      ]),
    ).toBe("unreadable");
  });

  it("does not count work or shares that precede the first user turn", () => {
    expect(
      accumulate([
        row("work", { timestamp: "2026-05-08T12:00:00.000Z" }),
        row("ignore", { note: "https://mainframe.app/v/37507089004e8f3700deb918a48b2556" }),
        row("user", { timestamp: "2026-05-08T13:00:00.000Z" }),
      ]),
    ).toEqual({
      sawUser: true,
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: false,
      alreadyShared: false,
    });
  });

  it("detects a Mainframe video URL in any post-user row", () => {
    expect(
      accumulate([
        row("user", { timestamp: "2026-05-08T13:00:00.000Z" }),
        row("work", { timestamp: "2026-05-08T13:05:00.000Z" }),
        row("ignore", {
          note: "Shared: https://mainframe.app/v/37507089004e8f3700deb918a48b2556",
        }),
      ]),
    ).toMatchObject({ workHappened: true, alreadyShared: true });
  });

  it("does not treat a video URL in the user turn itself as an existing share", () => {
    expect(
      accumulate([
        row("user", {
          timestamp: "2026-05-08T13:00:00.000Z",
          note: "https://mainframe.app/v/37507089004e8f3700deb918a48b2556",
        }),
        row("work", { timestamp: "2026-05-08T13:05:00.000Z" }),
      ]),
    ).toMatchObject({ workHappened: true, alreadyShared: false });
  });

  it("reports no user when no user turn is present", () => {
    expect(accumulate([row("work", { timestamp: "2026-05-08T13:00:00.000Z" })])).toEqual({
      sawUser: false,
      lastUserTimeMs: null,
      workHappened: false,
      alreadyShared: false,
    });
  });

  it("keeps lastUserTimeMs null when the latest user timestamp is malformed", () => {
    expect(accumulate([row("user", { timestamp: "not-a-timestamp" })])).toEqual({
      sawUser: true,
      lastUserTimeMs: null,
      workHappened: false,
      alreadyShared: false,
    });
  });
});
