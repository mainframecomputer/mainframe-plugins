import { closeSync, openSync, readFileSync, readSync, statSync } from "node:fs";

import { isJsonObject, type JsonObject } from "./json.js";

const TAIL_BYTES = 64 * 1024;
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
  record: JsonObject;
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
    return value < 1_000_000_000_000 ? Math.round(value * 1000) : Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return parseTimestampMs(numeric);
    }
  }

  return null;
}

export function extractTimestampMs(record: JsonObject): number | null {
  for (const key of ["timestamp", "created_at", "createdAt", "time", "ts"]) {
    const timestampMs = parseTimestampMs(record[key]);
    if (timestampMs !== null) {
      return timestampMs;
    }
  }

  const message = record.message;
  if (isJsonObject(message)) {
    return extractTimestampMs(message);
  }

  return null;
}

export function isRealUserRecord(record: JsonObject): boolean {
  if ("toolUseResult" in record || "tool_use_result" in record || "tool_result" in record) {
    return false;
  }

  const type = lowerString(record.type);
  const event = lowerString(record.event);
  const role = lowerString(record.role);
  const userType = lowerString(record.userType ?? record.user_type);
  const source = lowerString(record.source);
  const message = isJsonObject(record.message) ? record.message : null;
  const messageRole = message === null ? "" : lowerString(message.role);

  if (type === "user" && (userType === "" || userType === "external")) {
    return true;
  }
  if (role === "user" || messageRole === "user") {
    return source !== "tool" && source !== "system";
  }
  return event === "user_message" || event === "user-prompt" || event === "userpromptsubmit";
}

export function isWorkRecord(record: JsonObject): boolean {
  if (
    hasAnyKey(record, [
      "toolUse",
      "tool_use",
      "toolUseResult",
      "tool_use_result",
      "tool_call",
      "tool_calls",
    ])
  ) {
    return true;
  }

  const type = lowerString(record.type);
  const event = lowerString(record.event);
  const kind = lowerString(record.kind);
  const toolName = lowerString(record.tool_name ?? record.toolName ?? record.name);

  if (type.includes("tool") || event.includes("tool") || kind.includes("tool")) {
    return true;
  }
  if (
    ["bash", "shell", "exec", "apply_patch", "edit", "write", "read", "command"].some((marker) =>
      toolName.includes(marker),
    )
  ) {
    return true;
  }

  return arrayContainsToolUse(record.content) || arrayContainsToolUse(record.message);
}

export function isMainframeShareRecord(record: JsonObject): boolean {
  const haystack = JSON.stringify(record).toLowerCase();
  return MAINFRAME_MARKERS.some((marker) => haystack.includes(marker));
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
      if (isJsonObject(parsed)) {
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

function hasAnyKey(record: JsonObject, keys: readonly string[]): boolean {
  return keys.some((key) => key in record);
}

function arrayContainsToolUse(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => {
      if (!isJsonObject(entry)) {
        return false;
      }
      const type = lowerString(entry.type);
      const name = lowerString(entry.name);
      return (
        type.includes("tool") || name.includes("tool") || name === "bash" || name === "apply_patch"
      );
    });
  }

  if (isJsonObject(value)) {
    return arrayContainsToolUse(value.content);
  }

  return false;
}
