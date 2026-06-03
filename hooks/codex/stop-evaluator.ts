import { readFileSync } from "node:fs";

import { decideStop } from "../core/stop-policy.js";
import { parseJsonRecord } from "../core/json.js";
import { summarizeCodexTranscriptFile } from "./transcript.js";

export type CodexStopEvaluationInput = {
  stdin: string;
  nowMs?: number;
};

// Codex continues a stopped turn when a `Stop` hook returns
// `{ decision: "block", reason }`, using `reason` as a fresh prompt. An empty
// object lets the turn stop normally.
export type CodexStopHookOutput = { decision?: "block"; reason?: string };

export function evaluateCodexStopHook(input: CodexStopEvaluationInput): CodexStopHookOutput {
  const hookInput = parseCodexStopInput(input.stdin);
  if (hookInput === null || hookInput.stopHookActive) {
    return {};
  }

  const summary = summarizeCodexTranscriptFile(hookInput.transcriptPath);
  const decision = decideStop(summary, input.nowMs ?? Date.now());
  if (decision.kind === "skip") {
    return {};
  }

  return { decision: "block", reason: decision.message };
}

export function runCodexStopHookCli(): void {
  const stdin = readFileSync(0, "utf8");
  const output = evaluateCodexStopHook({ stdin });
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function parseCodexStopInput(
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
