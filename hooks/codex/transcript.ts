import {
  hasMainframeVideoUrl,
  isNonEmptyString,
  type ParsedTranscript,
  parseTimestampMs,
  summarizeTranscript,
  summarizeTranscriptFile,
  type TranscriptSummary,
} from "../core/transcript.js";
import { isJsonRecord, type JsonRecord, parseJsonlRecords } from "../core/json.js";

type CodexRowKind = "session-meta" | "user" | "work" | "other";

export function summarizeCodexTranscriptFile(path: string): TranscriptSummary {
  return summarizeTranscriptFile(path, parseCodexRows);
}

export function summarizeCodexTranscript(text: string): TranscriptSummary {
  return summarizeTranscript(text, parseCodexRows);
}

// Codex rollout files are append-only JSONL where every line is
// `{ timestamp, type, payload }`. The format carries many event types that are
// irrelevant here, so unrecognized-but-valid rows are ignored. Anything that
// makes the transcript untrustworthy fails closed (returns "unreadable" so the
// hook never fires): non-JSON or non-object rows, a missing `session_meta` row,
// or user timestamps that move backwards.
function parseCodexRows(text: string): ParsedTranscript | "unreadable" {
  const records = parseJsonlRecords(text);
  if (records === "unreadable") {
    return "unreadable";
  }

  let sawSessionMeta = false;
  let sawUser = false;
  let lastUserTimeMs: number | null = null;
  let workHappened = false;
  let alreadyShared = false;
  let previousUserTimeMs: number | null = null;

  for (const record of records) {
    const kind = classifyCodexRow(record);
    if (kind === "session-meta") {
      sawSessionMeta = true;
      continue;
    }

    if (kind === "user") {
      const userTimeMs = parseTimestampMs(record.timestamp);
      if (previousUserTimeMs !== null && userTimeMs !== null && userTimeMs < previousUserTimeMs) {
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
      workHappened = workHappened || kind === "work";
      alreadyShared = alreadyShared || hasMainframeVideoUrl(record);
    }
  }

  if (!sawSessionMeta) {
    return "unreadable";
  }

  return { sawUser, lastUserTimeMs, workHappened, alreadyShared };
}

function classifyCodexRow(record: JsonRecord): CodexRowKind {
  if (record.type === "session_meta") {
    return "session-meta";
  }

  const payload = record.payload;
  if (!isJsonRecord(payload)) {
    return "other";
  }

  if (
    record.type === "event_msg" &&
    payload.type === "user_message" &&
    isNonEmptyString(payload.message)
  ) {
    return "user";
  }

  if (record.type === "response_item" && isToolCallType(payload.type)) {
    return "work";
  }

  return "other";
}

// Responses API tool invocations are persisted as `response_item` rows whose
// payload type ends in `_call` (`function_call`, `local_shell_call`,
// `custom_tool_call`, `web_search_call`, ...). Match the whole family so work
// done through any tool counts, not just plain function calls. Result rows end
// in `_output`, so they are excluded.
function isToolCallType(type: unknown): boolean {
  return typeof type === "string" && type.endsWith("_call");
}
