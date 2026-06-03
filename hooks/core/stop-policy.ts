import { evaluateAfkGate } from "./afk-gate.js";
import type { TranscriptSummary } from "./transcript.js";

export type StopDecision = { kind: "skip" } | { kind: "suggest"; message: string };

export function decideStop(summary: TranscriptSummary, stopTimeMs: number): StopDecision {
  if (summary.kind !== "ready") {
    return { kind: "skip" };
  }

  const gate = evaluateAfkGate({
    stopTimeMs,
    lastUserTimeMs: summary.lastUserTimeMs,
    workHappened: summary.workHappened,
    alreadyShared: summary.alreadyShared,
  });

  if (!gate.fire) {
    return { kind: "skip" };
  }

  return { kind: "suggest", message: gate.reason };
}
