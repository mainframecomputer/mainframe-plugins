import { parseJsonRecord } from "./json.js";
import { decideStop } from "./stop-policy.js";
export function evaluateBlockReasonStopHook(input, summarizeTranscriptFile) {
    const hookInput = parseStopHookInput(input.stdin);
    if (hookInput === null || hookInput.stopHookActive) {
        return {};
    }
    const summary = summarizeTranscriptFile(hookInput.transcriptPath);
    const decision = decideStop(summary, input.nowMs ?? Date.now());
    if (decision.kind === "skip") {
        return {};
    }
    return { decision: "block", reason: decision.message };
}
function parseStopHookInput(stdin) {
    const input = parseJsonRecord(stdin);
    if (input === null || input.hook_event_name !== "Stop") {
        return null;
    }
    const transcriptPath = input.transcript_path;
    if (typeof transcriptPath !== "string" || transcriptPath.trim() === "") {
        return null;
    }
    return { transcriptPath, stopHookActive: input.stop_hook_active === true };
}
