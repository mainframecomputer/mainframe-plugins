import { SHARE_VIDEO_SKILL_SUGGESTION } from "../core/afk-gate.js";
import { isJsonRecord, parseJsonRecord } from "../core/json.js";
import { summarizeHermesConversation } from "./transcript.js";

export type HermesStopEvaluationInput = {
  stdin: string;
};

// Hermes shell hooks read `{"context": "..."}` from stdout only for the
// `pre_llm_call` event and prepend it to the current turn's user message; an
// empty object is a silent no-op. That injection is the one Hermes hook channel
// that can steer the agent, so the share-video nudge rides on it.
export type HermesStopHookOutput = { context?: string };

// Injected at the start of the next turn. Mirrors the other hosts' stop nudge
// but drops the "away for N hours" clause: Hermes hook payloads carry no
// timestamps, so there is no AFK timer to report. The "is this a good moment?"
// judgment is delegated to the agent and the share-video skill, which already
// encodes when not to record (active iteration, unfinished work, secrets).
const SHARE_VIDEO_NUDGE =
  `You did work in your previous turn without sharing a Mainframe video. ` +
  `If you are at a good stopping point, consider ${SHARE_VIDEO_SKILL_SUGGESTION}.`;

export function evaluateHermesStopHook(input: HermesStopEvaluationInput): HermesStopHookOutput {
  const conversationHistory = parsePreLlmCallConversation(input.stdin);
  if (conversationHistory === null) {
    return {};
  }

  const summary = summarizeHermesConversation(conversationHistory);
  if (summary === "unreadable" || !summary.workHappened || summary.alreadyShared) {
    return {};
  }

  return { context: SHARE_VIDEO_NUDGE };
}

// Read the prior conversation from a Hermes `pre_llm_call` shell-hook payload.
// Fails closed (returns null, so the hook stays silent) on any other event or a
// payload shape that does not carry an inline conversation array.
function parsePreLlmCallConversation(stdin: string): readonly unknown[] | null {
  const input = parseJsonRecord(stdin);
  if (input === null || input.hook_event_name !== "pre_llm_call") {
    return null;
  }

  const extra = input.extra;
  if (!isJsonRecord(extra)) {
    return null;
  }

  const conversationHistory = extra.conversation_history;
  if (!Array.isArray(conversationHistory)) {
    return null;
  }

  return conversationHistory;
}
