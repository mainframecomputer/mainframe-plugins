import { evaluateAfkGate } from "./afk-gate.js";
import { summarizeTranscriptFile } from "./transcript.js";
export function evaluateStopPolicy(input) {
    const summary = summarizeTranscriptFile(input.transcriptPath);
    if (summary.kind !== "ready") {
        return { kind: "skip" };
    }
    const gate = evaluateAfkGate({
        stopTimeMs: input.stopTimeMs,
        lastUserTimeMs: summary.lastUserTimeMs,
        workHappened: summary.workHappened,
        alreadyShared: summary.alreadyShared,
    });
    if (!gate.fire) {
        return { kind: "skip" };
    }
    return { kind: "suggest", message: gate.reason };
}
