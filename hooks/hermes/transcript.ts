import { isJsonRecord, type JsonRecord } from "../core/json.js";
import {
  accumulateClassifiedRows,
  type ClassifiedRowKind,
  type ParsedTranscript,
} from "../core/transcript.js";

// Hermes fires the share-video nudge from a `pre_llm_call` shell hook whose
// stdin payload carries the prior conversation inline as OpenAI-format message
// records under `extra.conversation_history` — there is no transcript file and
// no per-message timestamps (see hooks/hermes/stop-evaluator.ts). So unlike the
// file-backed hosts, Hermes classifies the in-payload messages directly and
// uses only the timeless work/share signals the shared accumulator derives; the
// non-decreasing user-time cursor stays inert because these rows carry no
// `timestamp`, leaving `lastUserTimeMs` null.
export function summarizeHermesConversation(
  conversationHistory: readonly unknown[],
): ParsedTranscript | "unreadable" {
  const records: JsonRecord[] = [];
  for (const entry of conversationHistory) {
    if (!isJsonRecord(entry)) {
      return "unreadable";
    }
    records.push(entry);
  }

  return accumulateClassifiedRows(records, classifyHermesMessage);
}

// A real user turn is a `role: "user"` message; it resets the accumulator's
// per-turn work and share flags. Agent work is an assistant message that issued
// tool calls, or a `role: "tool"` result row. Assistant prose and any other
// role (system, developer) are ignored.
function classifyHermesMessage(record: JsonRecord): ClassifiedRowKind {
  const role = record.role;
  if (role === "user") {
    return "user";
  }

  if (role === "assistant" && hasToolCalls(record.tool_calls)) {
    return "work";
  }

  if (role === "tool") {
    return "work";
  }

  return "ignore";
}

function hasToolCalls(toolCalls: unknown): boolean {
  return Array.isArray(toolCalls) && toolCalls.length > 0;
}
