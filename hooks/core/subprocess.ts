import { readFileSync } from "node:fs";

import { evaluateAfkGate } from "./afk-gate.js";
import { parseJsonObject, type JsonObject } from "./json.js";
import { summarizeTranscriptFile } from "./transcript.js";

export type StopHookEvaluationInput = {
  stdin: string;
  nowMs?: number;
};

type StopHookDecision = { kind: "skip" } | { kind: "suggest"; reason: string };

export type StopHookOutput =
  | { followup_message: string; decision?: never; reason?: never }
  | { decision?: never; reason?: never; followup_message?: never };

export function evaluateStopHook(input: StopHookEvaluationInput): StopHookOutput {
  return outputForHost(evaluateStopHookDecision(input));
}

function evaluateStopHookDecision(input: StopHookEvaluationInput): StopHookDecision {
  const hookInput = parseJsonObject(input.stdin);
  if (hookInput === null || hookInput.status !== "completed" || readLoopCount(hookInput) > 0) {
    return { kind: "skip" };
  }

  const transcriptPath = readTranscriptPath(hookInput);
  if (transcriptPath === null) {
    return { kind: "skip" };
  }

  const summary = summarizeTranscriptFile(transcriptPath);
  if (summary.kind !== "ready") {
    return { kind: "skip" };
  }

  const gate = evaluateAfkGate({
    stopTimeMs: input.nowMs ?? Date.now(),
    lastUserTimeMs: summary.lastUserTimeMs,
    workHappened: summary.workHappened,
    alreadyShared: summary.alreadyShared,
  });

  if (!gate.fire) {
    return { kind: "skip" };
  }

  return { kind: "suggest", reason: gate.reason };
}

export function runStopHookCli(): void {
  const stdin = readFileSync(0, "utf8");
  const output = evaluateStopHook({ stdin });
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function outputForHost(decision: StopHookDecision): StopHookOutput {
  if (decision.kind === "skip") {
    return {};
  }

  return { followup_message: decision.reason };
}

function readTranscriptPath(input: JsonObject): string | null {
  const value = input.transcript_path;
  if (typeof value === "string") {
    return value;
  }

  return null;
}

function readLoopCount(input: JsonObject): number {
  const value = input.loop_count;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
