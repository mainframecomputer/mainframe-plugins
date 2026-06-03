import {
  hasMainframeVideoUrl,
  isNonEmptyString,
  nextUserTimeMs,
  type ParsedTranscript,
  parseTimestampMs,
  summarizeTranscript,
  summarizeTranscriptFile,
  type TranscriptSummary,
} from "../core/transcript.js";
import { type JsonRecord, parseJsonlRecords } from "../core/json.js";

type CursorTranscriptRow =
  | { event: "assistant_message" }
  | { event: "tool_call"; timestamp: unknown }
  | { event: "tool_result" }
  | { event: "user_message"; timestamp: unknown };

export function summarizeCursorTranscriptFile(path: string): TranscriptSummary {
  return summarizeTranscriptFile(path, parseCursorRows);
}

export function summarizeCursorTranscript(text: string): TranscriptSummary {
  return summarizeTranscript(text, parseCursorRows);
}

function parseCursorRows(text: string): ParsedTranscript | "unreadable" {
  const records = parseJsonlRecords(text);
  if (records === "unreadable") {
    return "unreadable";
  }

  let sawUser = false;
  let lastUserTimeMs: number | null = null;
  let workHappened = false;
  let alreadyShared = false;
  let previousUserTimeMs: number | null = null;

  for (const record of records) {
    const row = parseCursorTranscriptRow(record);
    if (row === null) {
      return "unreadable";
    }

    if (row.event === "user_message") {
      const userTimeMs = nextUserTimeMs(row.timestamp, previousUserTimeMs);
      if (userTimeMs === "unreadable") {
        return "unreadable";
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
        return "unreadable";
      }

      workHappened = workHappened || workTimeMs !== null;
      alreadyShared = alreadyShared || hasMainframeVideoUrl(record);
    }
  }

  return { sawUser, lastUserTimeMs, workHappened, alreadyShared };
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
