import {
  type BlockReasonStopHookOutput,
  evaluateBlockReasonStopHook,
  type StopHookEvaluationInput,
} from "../core/stop-hook.js";
import { summarizeCodexTranscriptFile } from "./transcript.js";

export type CodexStopEvaluationInput = StopHookEvaluationInput;

// Codex adopted Claude Code's Stop hook contract, so the shared block/reason
// protocol applies unchanged; only the transcript format differs.
export type CodexStopHookOutput = BlockReasonStopHookOutput;

export function evaluateCodexStopHook(input: CodexStopEvaluationInput): CodexStopHookOutput {
  return evaluateBlockReasonStopHook(input, summarizeCodexTranscriptFile);
}
