import { readFileSync } from "node:fs";

import { isJsonRecord, type JsonRecord } from "./json.js";

const SECONDS_TIMESTAMP_CUTOFF = 1_000_000_000_000;
const MAINFRAME_TOOL_NAMES = new Set(["generate_video", "upload_video", "get_video"]);
const WATCH_URL_KEYS = new Set(["watchUrl", "watch_url"]);

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

type ParsedRecord = {
  row: CursorTranscriptRow;
  timestampMs: number | null;
};

type CursorTranscriptRow =
  | { event: "assistant_message"; timestamp: unknown }
  | { event: "tool_call"; timestamp: unknown; name: string; output: unknown }
  | { event: "user_message"; timestamp: unknown };

export function summarizeTranscriptFile(path: string): TranscriptSummary {
  try {
    return summarizeTranscript(readFileSync(path, "utf8"));
  } catch {
    return { kind: "unreadable" };
  }
}

export function summarizeTranscript(text: string): TranscriptSummary {
  const records = parseJsonl(text);
  const lastUserIndex = findLastRealUserIndex(records);
  if (lastUserIndex === -1) {
    return { kind: "no-user" };
  }

  const lastUser = records[lastUserIndex];
  if (lastUser.timestampMs === null) {
    return { kind: "missing-user-time" };
  }

  const recentRecords = records.slice(lastUserIndex + 1);
  return {
    kind: "ready",
    lastUserTimeMs: lastUser.timestampMs,
    workHappened: recentRecords.some(({ row }) => row.event === "tool_call"),
    alreadyShared: recentRecords.some(({ row }) => isMainframeShareRow(row)),
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

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return normalizeEpochMs(numeric);
    }

    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseJsonl(text: string): ParsedRecord[] {
  const parsedRecords: ParsedRecord[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }

    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!isJsonRecord(parsed)) {
        continue;
      }

      const row = parseCursorTranscriptRow(parsed);
      if (row !== null) {
        parsedRecords.push({ row, timestampMs: parseTimestampMs(row.timestamp) });
      }
    } catch {
      continue;
    }
  }

  return parsedRecords;
}

function findLastRealUserIndex(records: ParsedRecord[]): number {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index].row.event === "user_message") {
      return index;
    }
  }

  return -1;
}

function parseCursorTranscriptRow(record: JsonRecord): CursorTranscriptRow | null {
  if (record.event === "assistant_message") {
    return { event: record.event, timestamp: record.timestamp };
  }
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

function normalizeEpochMs(value: number): number {
  return value < SECONDS_TIMESTAMP_CUTOFF ? Math.round(value * 1000) : Math.round(value);
}

function isMainframeShareRow(row: CursorTranscriptRow): boolean {
  if (row.event !== "tool_call" || !MAINFRAME_TOOL_NAMES.has(row.name)) {
    return false;
  }

  return hasMainframeWatchUrl(row.output);
}

function hasMainframeWatchUrl(value: unknown): boolean {
  if (typeof value === "string") {
    return value.startsWith("https://mainframe.app/watch/");
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasMainframeWatchUrl(entry));
  }

  if (isJsonRecord(value)) {
    return Object.entries(value).some(([key, entry]) => {
      if (WATCH_URL_KEYS.has(key)) {
        return hasMainframeWatchUrl(entry);
      }
      return false;
    });
  }

  return false;
}
