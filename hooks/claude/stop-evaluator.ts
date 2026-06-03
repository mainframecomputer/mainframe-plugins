import {
  type BlockReasonStopHookOutput,
  evaluateBlockReasonStopHook,
  type StopHookEvaluationInput,
} from "../core/stop-hook.js";
import { summarizeClaudeTranscriptFile } from "./transcript.js";

export type ClaudeStopEvaluationInput = StopHookEvaluationInput;

// Claude Code's Stop hook uses the shared block/reason protocol; only the
// transcript format is Claude-specific.
export type ClaudeStopHookOutput = BlockReasonStopHookOutput;

export function evaluateClaudeStopHook(input: ClaudeStopEvaluationInput): ClaudeStopHookOutput {
  return evaluateBlockReasonStopHook(input, summarizeClaudeTranscriptFile);
}
