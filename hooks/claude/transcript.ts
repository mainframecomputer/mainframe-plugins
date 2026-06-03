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
// human text; tool results reuse the same `user` type but carry `tool_result`
// blocks, so they must not reset the AFK timer. Assistant `tool_use` blocks
// count as work. Unrelated entry types (system, summary, ...) are ignored, but
// a transcript with no recognizable Claude message entry fails closed as
// "unreadable" so the hook never fires on a foreign or empty format.
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

  return isRealUserMessage(message) ? "user" : "ignore";
}

// A real user turn carries human text: either a plain string or content blocks
// that include a non-empty `text` block. Tool-result turns reuse the `user`
// type but carry `tool_result` blocks instead of prompt text, so they are
// excluded to keep the AFK timer anchored to genuine user activity.
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
