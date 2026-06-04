import { evaluateBlockReasonStopHook, } from "../core/stop-hook.js";
import { summarizeCodexTranscriptFile } from "./transcript.js";
// Codex adopted Claude Code's Stop hook contract, so the shared block/reason
// protocol applies unchanged; only the transcript format differs.
export function evaluateCodexStopHook(input) {
    return evaluateBlockReasonStopHook(input, summarizeCodexTranscriptFile);
}
