import { closeSync, openSync, readFileSync, readSync, statSync } from "node:fs";

import { isJsonRecord, type JsonRecord } from "./json.js";

const TAIL_BYTES = 64 * 1024;
const SECONDS_TIMESTAMP_CUTOFF = 1_000_000_000_000;
const TIMESTAMP_KEYS = ["timestamp", "created_at", "createdAt", "time", "ts"];
const TOOL_KEYS = [
  "toolUse",
  "tool_use",
  "toolUseResult",
  "tool_use_result",
  "tool_call",
  "tool_calls",
];
const TOOL_NAME_MARKERS = ["bash", "shell", "exec", "apply_patch", "edit", "write", "read", "command"];
const USER_EVENTS = new Set(["user_message", "user-prompt", "userpromptsubmit"]);
const MAINFRAME_MARKERS = [
  "generate_video",
  "upload_video",
  "get_video",
  "mainframe.app/watch",
  "watchurl",
  "share-video",
];

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
  record: JsonRecord;
  timestampMs: number | null;
};

export function summarizeTranscriptFile(path: string): TranscriptSummary {
  try {
    return summarizeTranscript(readFileTail(path, TAIL_BYTES));
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
    workHappened: recentRecords.some(({ record }) => isWorkRecord(record)),
    alreadyShared: recentRecords.some(({ record }) => isMainframeShareRecord(record)),
  };
}

export function parseTimestampMs(value: unknown): number | null {
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

export function extractTimestampMs(record: JsonRecord): number | null {
  for (const key of TIMESTAMP_KEYS) {
    const timestampMs = parseTimestampMs(record[key]);
    if (timestampMs !== null) {
      return timestampMs;
    }
  }

  const message = record.message;
  if (isJsonRecord(message)) {
    return extractTimestampMs(message);
  }

  return null;
}

export function isRealUserRecord(record: JsonRecord): boolean {
  if ("toolUseResult" in record || "tool_use_result" in record || "tool_result" in record) {
    return false;
  }

  const type = lowerString(record.type);
  const event = lowerString(record.event);
  const role = lowerString(record.role);
  const userType = lowerString(record.userType ?? record.user_type);
  const source = lowerString(record.source);
  const message = isJsonRecord(record.message) ? record.message : null;
  const messageRole = message === null ? "" : lowerString(message.role);

  if (type === "user" && (userType === "" || userType === "external")) {
    return true;
  }
  if (role === "user" || messageRole === "user") {
    return source !== "tool" && source !== "system";
  }
  return USER_EVENTS.has(event);
}

export function isWorkRecord(record: JsonRecord): boolean {
  if (hasAnyKey(record, TOOL_KEYS)) {
    return true;
  }

  const type = lowerString(record.type);
  const event = lowerString(record.event);
  const kind = lowerString(record.kind);
  const toolName = lowerString(record.tool_name ?? record.toolName ?? record.name);

  if (type.includes("tool") || event.includes("tool") || kind.includes("tool")) {
    return true;
  }
  if (TOOL_NAME_MARKERS.some((marker) => toolName.includes(marker))) {
    return true;
  }

  return containsToolUse(record.content) || containsToolUse(record.message);
}

export function isMainframeShareRecord(record: JsonRecord): boolean {
  return containsMainframeMarker(record);
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
      if (isJsonRecord(parsed)) {
        parsedRecords.push({ record: parsed, timestampMs: extractTimestampMs(parsed) });
      }
    } catch {
      continue;
    }
  }

  return parsedRecords;
}

function findLastRealUserIndex(records: ParsedRecord[]): number {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (isRealUserRecord(records[index].record)) {
      return index;
    }
  }

  return -1;
}

function readFileTail(path: string, maxBytes: number): string {
  const size = statSync(path).size;
  if (size <= maxBytes) {
    return readFileSync(path, "utf8");
  }

  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    readSync(fd, buffer, 0, maxBytes, size - maxBytes);
    return buffer.toString("utf8");
  } finally {
    closeSync(fd);
  }
}

function lowerString(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function normalizeEpochMs(value: number): number {
  return value < SECONDS_TIMESTAMP_CUTOFF ? Math.round(value * 1000) : Math.round(value);
}

function hasAnyKey(record: JsonRecord, keys: readonly string[]): boolean {
  return keys.some((key) => key in record);
}

function containsToolUse(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => {
      if (!isJsonRecord(entry)) {
        return false;
      }
      const type = lowerString(entry.type);
      const name = lowerString(entry.name);
      return (
        type.includes("tool") || name.includes("tool") || name === "bash" || name === "apply_patch"
      );
    });
  }

  if (isJsonRecord(value)) {
    return containsToolUse(value.content);
  }

  return false;
}

function containsMainframeMarker(value: unknown): boolean {
  if (typeof value === "string") {
    const haystack = value.toLowerCase();
    return MAINFRAME_MARKERS.some((marker) => haystack.includes(marker));
  }

  if (Array.isArray(value)) {
    return value.some((entry) => containsMainframeMarker(entry));
  }

  if (isJsonRecord(value)) {
    return Object.values(value).some((entry) => containsMainframeMarker(entry));
  }

  return false;
}
