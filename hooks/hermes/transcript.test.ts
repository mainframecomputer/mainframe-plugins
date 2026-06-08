import { describe, expect, it } from "vitest";

import { summarizeHermesConversation } from "./transcript.js";

const SHARED_VIDEO_URL = "https://mainframe.app/v/37507089004e8f3700deb918a48b2556";

describe("summarizeHermesConversation", () => {
  it("reports tool-call work after the last user message", () => {
    const summary = summarizeHermesConversation([
      userMessage("earlier request"),
      userMessage("final request"),
      toolCallTurn(),
      { role: "tool", tool_call_id: "call_1", content: "done" },
    ]);

    expect(summary).toMatchObject({ workHappened: true, alreadyShared: false });
  });

  it("counts a bare tool result row as work", () => {
    const summary = summarizeHermesConversation([
      userMessage("please work on this"),
      { role: "tool", tool_call_id: "call_1", content: "done" },
    ]);

    expect(summary).toMatchObject({ workHappened: true });
  });

  it("does not count assistant prose without tool calls as work", () => {
    const summary = summarizeHermesConversation([
      userMessage("please answer this"),
      { role: "assistant", content: "Here is the answer." },
    ]);

    expect(summary).toMatchObject({ workHappened: false });
  });

  it("resets work state on each user turn", () => {
    const summary = summarizeHermesConversation([
      userMessage("first request"),
      toolCallTurn(),
      userMessage("second request"),
    ]);

    expect(summary).toMatchObject({ workHappened: false });
  });

  it("detects an existing Mainframe share from a tool result", () => {
    const summary = summarizeHermesConversation([
      userMessage("please work on this"),
      toolCallTurn(),
      { role: "tool", tool_call_id: "call_1", content: `Shared: ${SHARED_VIDEO_URL}` },
    ]);

    expect(summary).toMatchObject({ workHappened: true, alreadyShared: true });
  });

  it("does not treat a video URL in a user message as an existing share", () => {
    const summary = summarizeHermesConversation([
      userMessage(`please look at ${SHARED_VIDEO_URL}`),
      toolCallTurn(),
    ]);

    expect(summary).toMatchObject({ workHappened: true, alreadyShared: false });
  });

  it("treats a non-object message row as unreadable", () => {
    expect(summarizeHermesConversation([userMessage("hi"), "not-a-message"])).toBe("unreadable");
  });
});

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
