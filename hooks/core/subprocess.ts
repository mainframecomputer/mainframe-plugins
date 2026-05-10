import { readFileSync } from "node:fs";

import { evaluateAfkGate, thresholdMsFromEnv } from "./afk-gate.js";
import { isJsonObject, parseJsonObject, type JsonObject } from "./json.js";
import { parseTimestampMs, summarizeTranscriptFile } from "./transcript.js";

export type SubprocessHost = "claude" | "codex" | "cursor" | "devin-terminal";

export type StopHookEvaluationInput = {
  stdin: string;
  env?: NodeJS.ProcessEnv;
  nowMs?: number;
};

type StopHookDecision = { kind: "skip" } | { kind: "suggest"; reason: string };

export type StopHookOutput =
  | { decision: "block"; reason: string; followup_message?: never }
  | { followup_message: string; decision?: never; reason?: never }
  | { decision?: never; reason?: never; followup_message?: never };

export function evaluateStopHook(
  host: SubprocessHost,
  input: StopHookEvaluationInput,
): StopHookOutput {
  return outputForHost(host, evaluateStopHookDecision(host, input));
}

function evaluateStopHookDecision(
  host: SubprocessHost,
  input: StopHookEvaluationInput,
): StopHookDecision {
  const env = input.env ?? process.env;
  if (env.MAINFRAME_HOOK === "0") {
    return { kind: "skip" };
  }

  const hookInput = parseJsonObject(input.stdin);
  if (hookInput === null || isLoopGuardActive(hookInput)) {
    return { kind: "skip" };
  }

  const transcriptPath =
    readTranscriptPath(hookInput) ??
    (host === "cursor" ? readStringEnv(env, "CURSOR_TRANSCRIPT_PATH") : null);
  if (transcriptPath === null) {
    return { kind: "skip" };
  }

  const summary = summarizeTranscriptFile(transcriptPath);
  if (summary.kind !== "ready") {
    return { kind: "skip" };
  }

  const gate = evaluateAfkGate({
    stopTimeMs: readStopTimeMs(hookInput, input.nowMs ?? Date.now()),
    lastUserTimeMs: summary.lastUserTimeMs,
    thresholdMs: thresholdMsFromEnv(env.MAINFRAME_HOOK_AFK_HOURS),
    workHappened: summary.workHappened,
    alreadyShared: summary.alreadyShared,
  });

  if (!gate.fire) {
    return { kind: "skip" };
  }

  return { kind: "suggest", reason: gate.reason };
}

export function runStopHookCli(host: SubprocessHost): void {
  const stdin = readFileSync(0, "utf8");
  const output = evaluateStopHook(host, { stdin });
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function outputForHost(host: SubprocessHost, decision: StopHookDecision): StopHookOutput {
  if (decision.kind === "skip") {
    return {};
  }

  if (host === "cursor") {
    return { followup_message: decision.reason };
  }

  return { decision: "block", reason: decision.reason };
}

function isLoopGuardActive(input: JsonObject): boolean {
  return input.stop_hook_active === true || input.stopHookActive === true;
}

function readTranscriptPath(input: JsonObject): string | null {
  for (const key of ["transcript_path", "transcriptPath"]) {
    const value = input[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}

function readStopTimeMs(input: JsonObject, nowMs: number): number {
  const directKeys = ["stop_time_ms", "stopTimeMs", "timestamp", "time", "created_at", "createdAt"];
  for (const key of directKeys) {
    const parsed = parseTimestampMs(input[key]);
    if (parsed !== null) {
      return parsed;
    }
  }

  const event = input.event;
  if (isJsonObject(event)) {
    return readStopTimeMs(event, nowMs);
  }

  return nowMs;
}

function readStringEnv(env: NodeJS.ProcessEnv, key: string): string | null {
  const value = env[key];
  return value === undefined || value.trim() === "" ? null : value;
}
