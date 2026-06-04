import {
  accumulateClassifiedRows,
  type ClassifiedRowKind,
  isNonEmptyString,
  type ParsedTranscript,
  summarizeTranscript,
  summarizeTranscriptFile,
  type TranscriptSummary,
} from "../core/transcript.js";
import { isJsonRecord, type JsonRecord, parseJsonlRecords } from "../core/json.js";

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

  // Every Codex rollout opens with a `session_meta` row; its absence means this
  // isn't a Codex rollout, so fail closed.
  if (!records.some((record) => record.type === "session_meta")) {
    return "unreadable";
  }

  return accumulateClassifiedRows(records, classifyCodexRow);
}

function classifyCodexRow(record: JsonRecord): ClassifiedRowKind {
  const payload = record.payload;
  if (!isJsonRecord(payload)) {
    return "ignore";
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

  return "ignore";
}

// Responses API tool invocations are persisted as `response_item` rows whose
// payload type ends in `_call` (`function_call`, `local_shell_call`,
// `custom_tool_call`, `web_search_call`, ...). Match the whole family so work
// done through any tool counts, not just plain function calls. Result rows end
// in `_output`, so they are excluded.
function isToolCallType(type: unknown): boolean {
  return typeof type === "string" && type.endsWith("_call");
}
