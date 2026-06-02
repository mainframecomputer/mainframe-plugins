import { readFileSync } from "node:fs";

import { evaluateStopPolicy } from "../core/stop-policy.js";
import { parseJsonRecord, type JsonRecord } from "../core/json.js";

export type CursorStopEvaluationInput = {
  stdin: string;
  nowMs?: number;
};

export type CursorStopHookOutput = { followup_message?: string };

export function evaluateCursorStopHook(input: CursorStopEvaluationInput): CursorStopHookOutput {
  const hookInput = parseJsonRecord(input.stdin);
  if (hookInput === null || hookInput.status !== "completed" || readLoopCount(hookInput) > 0) {
    return {};
  }

  const transcriptPath = readTranscriptPath(hookInput);
  if (transcriptPath === null) {
    return {};
  }

  const decision = evaluateStopPolicy({
    transcriptPath,
    stopTimeMs: input.nowMs ?? Date.now(),
  });
  if (decision.kind === "skip") {
    return {};
  }

  return { followup_message: decision.message };
}

export function runCursorStopHookCli(): void {
  const stdin = readFileSync(0, "utf8");
  const output = evaluateCursorStopHook({ stdin });
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function readTranscriptPath(input: JsonRecord): string | null {
  const value = input.transcript_path;
  if (typeof value === "string") {
    return value;
  }

  return null;
}

function readLoopCount(input: JsonRecord): number {
  const value = input.loop_count;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
