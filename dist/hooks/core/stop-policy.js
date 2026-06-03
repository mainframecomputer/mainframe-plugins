import { evaluateAfkGate } from "./afk-gate.js";
export function decideStop(summary, stopTimeMs) {
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
