import {
  type BlockReasonStopHookOutput,
  evaluateBlockReasonStopHook,
  type StopHookEvaluationInput,
} from "../core/stop-hook.js";
import { summarizeClaudeTranscriptFile } from "./transcript.js";

// Claude Code's Stop hook uses the shared block/reason protocol; only the
// transcript format is Claude-specific.
export function evaluateClaudeStopHook(input: StopHookEvaluationInput): BlockReasonStopHookOutput {
  return evaluateBlockReasonStopHook(input, summarizeClaudeTranscriptFile);
}
