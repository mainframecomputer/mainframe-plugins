import { lstatSync, readFileSync } from "node:fs";

import { isJsonRecord, type JsonRecord } from "./json.js";

const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;
const MIN_EPOCH_SECONDS = 946_684_800;
const MAX_EPOCH_SECONDS = 4_102_444_800;
const MIN_EPOCH_MS = MIN_EPOCH_SECONDS * 1000;
const MAX_EPOCH_MS = MAX_EPOCH_SECONDS * 1000;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAINFRAME_TOOL_NAMES = new Set(["generate_video", "upload_video", "get_video"]);
const MAINFRAME_WATCH_URL_PREFIX = "https://mainframe.app/watch/";

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
  | { event: "tool_call"; timestamp: unknown; name: string; output: unknown }
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
        continue;
      }

      if (row.event === "user_message") {
        sawUser = true;
        lastUserTimeMs = parseTimestampMs(row.timestamp);
        workHappened = false;
        alreadyShared = false;
        continue;
      }

      if (sawUser) {
        workHappened = true;
        alreadyShared = alreadyShared || isMainframeShareRow(row);
      }
    } catch {
      return { kind: "unreadable" };
    }
  }

  return { kind: "parsed", sawUser, lastUserTimeMs, workHappened, alreadyShared };
}

function parseCursorTranscriptRow(record: JsonRecord): CursorTranscriptRow | null {
  if (record.event === "user_message") {
    return { event: record.event, timestamp: record.timestamp };
  }
  if (record.event === "tool_call" && typeof record.name === "string") {
    return {
      event: record.event,
      timestamp: record.timestamp,
      name: record.name,
      output: record.output,
    };
  }

  return null;
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

function isMainframeShareRow(row: CursorTranscriptRow): boolean {
  if (row.event !== "tool_call" || !MAINFRAME_TOOL_NAMES.has(row.name)) {
    return false;
  }

  return hasMainframeWatchUrl(row.output);
}

function hasMainframeWatchUrl(value: unknown): boolean {
  if (typeof value === "string") {
    return value.includes(MAINFRAME_WATCH_URL_PREFIX);
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasMainframeWatchUrl(entry));
  }

  if (isJsonRecord(value)) {
    return Object.values(value).some((entry) => hasMainframeWatchUrl(entry));
  }

  return false;
}
