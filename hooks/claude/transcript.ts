import { isJsonRecord, type JsonRecord, parseJsonlRecords } from "../core/json.js";
import {
  accumulateClassifiedRows,
  type ClassifiedRowKind,
  isNonEmptyString,
  type ParsedTranscript,
  summarizeTranscript,
  summarizeTranscriptFile,
  type TranscriptSummary,
} from "../core/transcript.js";

export function summarizeClaudeTranscriptFile(path: string): TranscriptSummary {
  return summarizeTranscriptFile(path, parseClaudeRows);
}

export function summarizeClaudeTranscript(text: string): TranscriptSummary {
  return summarizeTranscript(text, parseClaudeRows);
}

// Claude Code transcripts are append-only JSONL where each line is a typed
// entry. A real user turn is `{ type: "user", message: { content } }` carrying
// human text. Tool results and system-injected notes reuse the same
// `type: "user"` shape and are distinguished only by record-level markers (see
// `isSyntheticUserEntry`), so they must not reset the AFK timer. Assistant
// `tool_use` blocks count as work. Unrelated entry types (system, summary, ...)
// are ignored, but a transcript with no recognizable Claude message entry fails
// closed as "unreadable" so the hook never fires on a foreign or empty format.
function parseClaudeRows(text: string): ParsedTranscript | "unreadable" {
  const records = parseJsonlRecords(text);
  if (records === "unreadable") {
    return "unreadable";
  }

  if (!records.some(isClaudeMessageEntry)) {
    return "unreadable";
  }

  return accumulateClassifiedRows(records, classifyClaudeRow);
}

// A Claude transcript always carries user/assistant message entries; their
// absence means this is a foreign or empty format, so fail closed.
function isClaudeMessageEntry(record: JsonRecord): boolean {
  return (record.type === "user" || record.type === "assistant") && isJsonRecord(record.message);
}

function classifyClaudeRow(record: JsonRecord): ClassifiedRowKind {
  if (record.type !== "user" && record.type !== "assistant") {
    return "ignore";
  }

  const message = record.message;
  if (!isJsonRecord(message)) {
    return "ignore";
  }

  if (record.type === "assistant") {
    return hasToolUseBlock(message.content) ? "work" : "ignore";
  }

  if (isSyntheticUserEntry(record)) {
    return "ignore";
  }

  return isRealUserMessage(message) ? "user" : "ignore";
}

// Claude Code logs tool results and system-injected notes with the same
// `type: "user"` shape as real prompts, told apart only by record-level markers
// rather than message content (https://github.com/anthropics/claude-code/issues/26508):
// `toolUseResult`/`sourceToolAssistantUUID` mark a tool result, and `isMeta`
// marks an injected note. Excluding these keeps the AFK timer anchored to
// genuine prompts so the hook still fires after the user has actually left.
function isSyntheticUserEntry(record: JsonRecord): boolean {
  return (
    record.isMeta === true ||
    record.toolUseResult !== undefined ||
    typeof record.sourceToolAssistantUUID === "string"
  );
}

// Content-level check for a genuine prompt, applied once record-level synthetic
// markers are ruled out: accept a plain string or content blocks with a
// non-empty `text` block, and still reject any residual `tool_result` blocks.
function isRealUserMessage(message: JsonRecord): boolean {
  const content = message.content;
  if (isNonEmptyString(content)) {
    return true;
  }

  if (!Array.isArray(content)) {
    return false;
  }

  if (content.some(isToolResultBlock)) {
    return false;
  }

  return content.some(isNonEmptyTextBlock);
}

function hasToolUseBlock(content: unknown): boolean {
  return Array.isArray(content) && content.some(isToolUseBlock);
}

function isToolUseBlock(block: unknown): boolean {
  return isJsonRecord(block) && block.type === "tool_use";
}

function isToolResultBlock(block: unknown): boolean {
  return isJsonRecord(block) && block.type === "tool_result";
}

function isNonEmptyTextBlock(block: unknown): boolean {
  return isJsonRecord(block) && block.type === "text" && isNonEmptyString(block.text);
}
