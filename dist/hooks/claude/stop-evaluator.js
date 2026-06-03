import { evaluateBlockReasonStopHook, } from "../core/stop-hook.js";
import { summarizeClaudeTranscriptFile } from "./transcript.js";
export function evaluateClaudeStopHook(input) {
    return evaluateBlockReasonStopHook(input, summarizeClaudeTranscriptFile);
}
