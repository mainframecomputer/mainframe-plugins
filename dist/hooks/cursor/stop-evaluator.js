import { readFileSync } from "node:fs";
import { evaluateStopPolicy } from "../core/stop-policy.js";
import { parseJsonRecord } from "../core/json.js";
export function evaluateCursorStopHook(input) {
    const hookInput = parseCursorStopInput(input.stdin);
    if (hookInput === null || hookInput.loopCount > 0) {
        return {};
    }
    const decision = evaluateStopPolicy({
        transcriptPath: hookInput.transcriptPath,
        stopTimeMs: input.nowMs ?? Date.now(),
    });
    if (decision.kind === "skip") {
        return {};
    }
    return { followup_message: decision.message };
}
export function runCursorStopHookCli() {
    const stdin = readFileSync(0, "utf8");
    const output = evaluateCursorStopHook({ stdin });
    process.stdout.write(`${JSON.stringify(output)}\n`);
}
function parseCursorStopInput(stdin) {
    const input = parseJsonRecord(stdin);
    if (input === null || input.status !== "completed") {
        return null;
    }
    const transcriptPath = input.transcript_path;
    if (typeof transcriptPath !== "string" || transcriptPath.trim() === "") {
        return null;
    }
    const loopCount = input.loop_count;
    if (typeof loopCount !== "number" ||
        !Number.isFinite(loopCount) ||
        !Number.isInteger(loopCount) ||
        loopCount < 0) {
        return null;
    }
    return { transcriptPath, loopCount };
}
