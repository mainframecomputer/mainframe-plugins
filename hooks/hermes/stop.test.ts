import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { evaluateHermesStopHook } from "./stop-evaluator.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const stopPath = join(fixtureDir, "fixtures", "stop.json");
const SHARED_VIDEO_URL = "https://mainframe.app/v/37507089004e8f3700deb918a48b2556";

describe("Hermes stop hook", () => {
  it("injects a share-video nudge after unshared work", () => {
    const output = evaluateHermesStopHook({ stdin: readFileSync(stopPath, "utf8") });

    expect(output.context).toContain("share-video");
    expect(output.context).not.toContain("SECRET_NEVER_LEAK");
  });

  it("does not fire for non-pre_llm_call events", () => {
    for (const hook_event_name of ["post_llm_call", "pre_tool_call", "on_session_end", "Stop"]) {
      expect(
        evaluateHermesStopHook({
          stdin: preLlmCall([userMessage("please work on this"), toolCallTurn()], {
            hook_event_name,
          }),
        }),
      ).toEqual({});
    }
  });

  it("does not fire when no work happened since the last user message", () => {
    expect(
      evaluateHermesStopHook({
        stdin: preLlmCall([
          userMessage("please answer this"),
          { role: "assistant", content: "Here is my answer." },
        ]),
      }),
    ).toEqual({});
  });

  it("does not fire after a Mainframe video was shared", () => {
    expect(
      evaluateHermesStopHook({
        stdin: preLlmCall([
          userMessage("please work on this"),
          toolCallTurn(),
          { role: "tool", tool_call_id: "call_1", content: `Shared: ${SHARED_VIDEO_URL}` },
        ]),
      }),
    ).toEqual({});
  });

  it("does not treat a video URL in a user message as an existing share", () => {
    const output = evaluateHermesStopHook({
      stdin: preLlmCall([userMessage(`please look at ${SHARED_VIDEO_URL}`), toolCallTurn()]),
    });

    expect(output.context).toContain("share-video");
  });

  it("does not fire when the conversation history is missing, empty, or not a list", () => {
    for (const conversation_history of [undefined, [], "not-a-list"]) {
      expect(
        evaluateHermesStopHook({
          stdin: JSON.stringify({
            hook_event_name: "pre_llm_call",
            extra: { conversation_history },
          }),
        }),
      ).toEqual({});
    }
  });

  it("does not fire when the payload has no extra object", () => {
    expect(
      evaluateHermesStopHook({ stdin: JSON.stringify({ hook_event_name: "pre_llm_call" }) }),
    ).toEqual({});
  });

  it("does not fire on corrupt JSON input", () => {
    expect(evaluateHermesStopHook({ stdin: "{not-json" })).toEqual({});
  });
});

function preLlmCall(
  conversationHistory: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    hook_event_name: "pre_llm_call",
    tool_name: null,
    tool_input: null,
    session_id: "session-123",
    cwd: "/workspace",
    extra: { conversation_history: conversationHistory },
    ...overrides,
  });
}

function userMessage(content: string): Record<string, unknown> {
  return { role: "user", content };
}

function toolCallTurn(): Record<string, unknown> {
  return {
    role: "assistant",
    content: "Working on it.",
    tool_calls: [
      {
        id: "call_1",
        type: "function",
        function: { name: "terminal", arguments: '{"command":"bun run build"}' },
      },
    ],
  };
}
