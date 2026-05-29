import { readFileSync } from "node:fs";
import { evaluateAfkGate } from "./afk-gate.js";
import { parseJsonObject } from "./json.js";
import { summarizeTranscriptFile } from "./transcript.js";
export function evaluateStopHook(input) {
    return outputForHost(evaluateStopHookDecision(input));
}
function evaluateStopHookDecision(input) {
    const hookInput = parseJsonObject(input.stdin);
    if (hookInput === null || hookInput.status !== "completed" || readLoopCount(hookInput) > 0) {
        return { kind: "skip" };
    }
    const transcriptPath = readTranscriptPath(hookInput);
    if (transcriptPath === null) {
        return { kind: "skip" };
    }
    const summary = summarizeTranscriptFile(transcriptPath);
    if (summary.kind !== "ready") {
        return { kind: "skip" };
    }
    const gate = evaluateAfkGate({
        stopTimeMs: input.nowMs ?? Date.now(),
        lastUserTimeMs: summary.lastUserTimeMs,
        workHappened: summary.workHappened,
        alreadyShared: summary.alreadyShared,
    });
    if (!gate.fire) {
        return { kind: "skip" };
    }
    return { kind: "suggest", reason: gate.reason };
}
export function runStopHookCli() {
    const stdin = readFileSync(0, "utf8");
    const output = evaluateStopHook({ stdin });
    process.stdout.write(`${JSON.stringify(output)}\n`);
}
function outputForHost(decision) {
    if (decision.kind === "skip") {
        return {};
    }
    return { followup_message: decision.reason };
}
function readTranscriptPath(input) {
    const value = input.transcript_path;
    if (typeof value === "string") {
        return value;
    }
    return null;
}
function readLoopCount(input) {
    const value = input.loop_count;
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
//# sourceMappingURL=subprocess.js.map