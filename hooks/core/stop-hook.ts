import { parseJsonRecord } from "./json.js";
import { decideStop } from "./stop-policy.js";
import type { TranscriptSummary } from "./transcript.js";

export type StopHookEvaluationInput = {
  stdin: string;
  nowMs?: number;
};

// Claude Code and Codex share one Stop hook contract: read `transcript_path`
// and `stop_hook_active` from the host payload, and continue a stopped turn by
// returning `{ decision: "block", reason }`. An empty object lets the turn stop
// normally. `stop_hook_active` is true once a prior block already re-prompted
// the agent, so we must not block again or the turn would never end.
export type BlockReasonStopHookOutput = { decision?: "block"; reason?: string };

export function evaluateBlockReasonStopHook(
  input: StopHookEvaluationInput,
  summarizeTranscriptFile: (transcriptPath: string) => TranscriptSummary,
): BlockReasonStopHookOutput {
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

function parseStopHookInput(
  stdin: string,
): { transcriptPath: string; stopHookActive: boolean } | null {
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
