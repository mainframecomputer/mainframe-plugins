import { lstatSync, readFileSync } from "node:fs";

import { isJsonRecord, type JsonRecord } from "./json.js";

const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;
const MIN_EPOCH_SECONDS = 946_684_800;
const MAX_EPOCH_SECONDS = 4_102_444_800;
const MIN_EPOCH_MS = MIN_EPOCH_SECONDS * 1000;
const MAX_EPOCH_MS = MAX_EPOCH_SECONDS * 1000;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAINFRAME_VIDEO_URL_PREFIX = "https://mainframe.app/v/";

export type TranscriptSummary =
  | { kind: "unreadable" }
  | { kind: "no-user" }
  | { kind: "missing-user-time" }
  | {
      kind: "ready";
      lastUserTimeMs: number;
      workHappened: boolean;
      alreadyShared: boolean;
    };

type CursorTranscriptRow =
  | { event: "assistant_message" }
  | { event: "tool_call"; timestamp: unknown }
  | { event: "tool_result" }
  | { event: "user_message"; timestamp: unknown };

export function summarizeTranscriptFile(path: string): TranscriptSummary {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.size > MAX_TRANSCRIPT_BYTES) {
      return { kind: "unreadable" };
    }

    return summarizeTranscript(readFileSync(path, "utf8"));
  } catch {
    return { kind: "unreadable" };
  }
}

export function summarizeTranscript(text: string): TranscriptSummary {
  const summary = summarizeCursorRows(text);
  if (summary.kind === "unreadable") {
    return summary;
  }

  if (!summary.sawUser) {
    return { kind: "no-user" };
  }

  if (summary.lastUserTimeMs === null) {
    return { kind: "missing-user-time" };
  }

  return {
    kind: "ready",
    lastUserTimeMs: summary.lastUserTimeMs,
    workHappened: summary.workHappened,
    alreadyShared: summary.alreadyShared,
  };
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeEpochMs(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return null;
    }

    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      return normalizeEpochMs(Number(trimmed));
    }

    if (!ISO_TIMESTAMP_PATTERN.test(trimmed)) {
      return null;
    }

    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed) && parsed >= MIN_EPOCH_MS && parsed <= MAX_EPOCH_MS) {
      return parsed;
    }
  }

  return null;
}

function summarizeCursorRows(text: string):
  | {
      kind: "parsed";
      sawUser: boolean;
      lastUserTimeMs: number | null;
      workHappened: boolean;
      alreadyShared: boolean;
    }
  | { kind: "unreadable" } {
  let sawUser = false;
  let lastUserTimeMs: number | null = null;
  let workHappened = false;
  let alreadyShared = false;
  let previousUserTimeMs: number | null = null;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }

    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!isJsonRecord(parsed)) {
        return { kind: "unreadable" };
      }

      const row = parseCursorTranscriptRow(parsed);
      if (row === null) {
        return { kind: "unreadable" };
      }

      if (row.event === "user_message") {
        const userTimeMs = parseTimestampMs(row.timestamp);
        if (previousUserTimeMs !== null && userTimeMs !== null && userTimeMs < previousUserTimeMs) {
          return { kind: "unreadable" };
        }

        sawUser = true;
        lastUserTimeMs = userTimeMs;
        if (userTimeMs !== null) {
          previousUserTimeMs = userTimeMs;
        }
        workHappened = false;
        alreadyShared = false;
        continue;
      }

      if (sawUser) {
        const workTimeMs = readToolWorkTimeMs(row, lastUserTimeMs);
        if (workTimeMs === "unreadable") {
          return { kind: "unreadable" };
        }

        workHappened = workHappened || workTimeMs !== null;
        alreadyShared = alreadyShared || hasMainframeVideoUrl(parsed);
      }
    } catch {
      return { kind: "unreadable" };
    }
  }

  return { kind: "parsed", sawUser, lastUserTimeMs, workHappened, alreadyShared };
}

function parseCursorTranscriptRow(record: JsonRecord): CursorTranscriptRow | null {
  if (record.event === "user_message" && isNonEmptyString(record.text)) {
    return { event: record.event, timestamp: record.timestamp };
  }
  if (record.event === "tool_call" && typeof record.name === "string") {
    return { event: record.event, timestamp: record.timestamp };
  }
  if (record.event === "assistant_message") {
    return { event: record.event };
  }
  if (record.event === "tool_result") {
    return { event: record.event };
  }

  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function readToolWorkTimeMs(
  row: CursorTranscriptRow,
  lastUserTimeMs: number | null,
): number | null | "unreadable" {
  if (row.event !== "tool_call") {
    return null;
  }

  const toolTimeMs = parseTimestampMs(row.timestamp);
  if (toolTimeMs === null) {
    return "unreadable";
  }

  if (lastUserTimeMs !== null && toolTimeMs < lastUserTimeMs) {
    return "unreadable";
  }

  return toolTimeMs;
}

function normalizeEpochMs(value: number): number | null {
  if (value >= MIN_EPOCH_SECONDS && value <= MAX_EPOCH_SECONDS) {
    return Math.round(value * 1000);
  }

  if (value >= MIN_EPOCH_MS && value <= MAX_EPOCH_MS) {
    return Math.round(value);
  }

  return null;
}

function hasMainframeVideoUrl(value: unknown): boolean {
  if (typeof value === "string") {
    return value.includes(MAINFRAME_VIDEO_URL_PREFIX);
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasMainframeVideoUrl(entry));
  }

  if (isJsonRecord(value)) {
    return Object.values(value).some((entry) => hasMainframeVideoUrl(entry));
  }

  return false;
}
