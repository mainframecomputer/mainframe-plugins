import { evaluateBlockReasonStopHook, } from "../core/stop-hook.js";
import { summarizeCodexTranscriptFile } from "./transcript.js";
export function evaluateCodexStopHook(input) {
    return evaluateBlockReasonStopHook(input, summarizeCodexTranscriptFile);
}
