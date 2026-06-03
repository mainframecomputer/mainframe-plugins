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
// irrelevant here, so unrecognized-but-valid rows are ignored. Structural
// corruption (non-JSON or non-object rows) and the absence of a `session_meta`
// row fail closed so the hook never fires on an untrusted transcript.
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

  for (const record of records) {
    const kind = classifyCodexRow(record);
    if (kind === "session-meta") {
      sawSessionMeta = true;
      continue;
    }

    if (kind === "user") {
      sawUser = true;
      lastUserTimeMs = parseTimestampMs(record.timestamp);
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

  if (record.type === "response_item" && payload.type === "function_call") {
    return "work";
  }

  return "other";
}
