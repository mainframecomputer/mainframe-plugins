import { readFileSync } from "node:fs";
import { evaluateAfkGate, thresholdMsFromEnv } from "./afk-gate.js";
import { isJsonObject, parseJsonObject } from "./json.js";
import { parseTimestampMs, summarizeTranscriptFile } from "./transcript.js";
export function evaluateStopHook(input) {
    return outputForHost(evaluateStopHookDecision(input));
}
function evaluateStopHookDecision(input) {
    const env = input.env ?? process.env;
    if (env.MAINFRAME_HOOK === "0") {
        return { kind: "skip" };
    }
    const hookInput = parseJsonObject(input.stdin);
    if (hookInput === null || hookInput.status !== "completed" || readLoopCount(hookInput) > 0) {
        return { kind: "skip" };
    }
    const transcriptPath = readTranscriptPath(hookInput) ?? readStringEnv(env, "CURSOR_TRANSCRIPT_PATH");
    if (transcriptPath === null) {
        return { kind: "skip" };
    }
    const summary = summarizeTranscriptFile(transcriptPath);
    if (summary.kind !== "ready") {
        return { kind: "skip" };
    }
    const gate = evaluateAfkGate({
        stopTimeMs: readStopTimeMs(hookInput, input.nowMs ?? Date.now()),
        lastUserTimeMs: summary.lastUserTimeMs,
        thresholdMs: thresholdMsFromEnv(env.MAINFRAME_HOOK_AFK_HOURS),
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
function readStopTimeMs(input, nowMs) {
    const directKeys = ["stop_time_ms", "stopTimeMs", "timestamp", "time", "created_at", "createdAt"];
    for (const key of directKeys) {
        const parsed = parseTimestampMs(input[key]);
        if (parsed !== null) {
            return parsed;
        }
    }
    const event = input.event;
    if (isJsonObject(event)) {
        return readStopTimeMs(event, nowMs);
    }
    return nowMs;
}
function readStringEnv(env, key) {
    const value = env[key];
    return value === undefined || value.trim() === "" ? null : value;
}
//# sourceMappingURL=subprocess.js.map