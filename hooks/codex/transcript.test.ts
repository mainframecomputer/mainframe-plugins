import { describe, expect, it } from "vitest";

import { summarizeCodexTranscript, summarizeCodexTranscriptFile } from "./transcript.js";

const sessionMeta = {
  timestamp: "2026-05-08T12:55:00.000Z",
  type: "session_meta",
  payload: { id: "session-1", cwd: "/workspace", originator: "codex", cli_version: "0.130.0" },
};

describe("summarizeCodexTranscript", () => {
  it("summarizes function-call work after the last user message", () => {
    const summary = summarizeCodexTranscript(
      codexRollout([
        sessionMeta,
        userMessage("2026-05-08T12:00:00.000Z", "earlier request"),
        userMessage("2026-05-08T13:00:00.000Z", "final request"),
        functionCall("2026-05-08T13:05:00.000Z"),
      ]),
    );

    expect(summary).toEqual({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
      alreadyShared: false,
    });
  });

  it("ignores unrelated rollout event types", () => {
    const summary = summarizeCodexTranscript(
      codexRollout([
        sessionMeta,
        {
          timestamp: "2026-05-08T12:59:00.000Z",
          type: "event_msg",
          payload: { type: "task_started" },
        },
        userMessage("2026-05-08T13:00:00.000Z", "please work on this"),
        {
          timestamp: "2026-05-08T13:01:00.000Z",
          type: "event_msg",
          payload: { type: "token_count" },
        },
        {
          timestamp: "2026-05-08T13:02:00.000Z",
          type: "response_item",
          payload: { type: "reasoning", summary: ["thinking"] },
        },
        functionCall("2026-05-08T13:05:00.000Z"),
      ]),
    );

    expect(summary).toEqual({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
      alreadyShared: false,
    });
  });

  it("detects an existing Mainframe share from function-call output", () => {
    const summary = summarizeCodexTranscript(
      codexRollout([
        sessionMeta,
        userMessage("2026-05-08T13:00:00.000Z", "please work on this"),
        functionCall("2026-05-08T13:05:00.000Z"),
        {
          timestamp: "2026-05-08T13:30:00.000Z",
          type: "response_item",
          payload: {
            type: "function_call_output",
            call_id: "call_1",
            output: "Shared: https://mainframe.app/v/37507089004e8f3700deb918a48b2556",
          },
        },
      ]),
    );

    expect(summary).toMatchObject({ kind: "ready", workHappened: true, alreadyShared: true });
  });

  it("detects a Mainframe share from an agent message", () => {
    const summary = summarizeCodexTranscript(
      codexRollout([
        sessionMeta,
        userMessage("2026-05-08T13:00:00.000Z", "please work on this"),
        {
          timestamp: "2026-05-08T13:30:00.000Z",
          type: "event_msg",
          payload: {
            type: "agent_message",
            message: "Done: https://mainframe.app/v/37507089004e8f3700deb918a48b2556",
          },
        },
      ]),
    );

    expect(summary).toMatchObject({ kind: "ready", alreadyShared: true });
  });

  it("does not treat a video URL in the latest user message as an existing share", () => {
    const summary = summarizeCodexTranscript(
      codexRollout([
        sessionMeta,
        userMessage(
          "2026-05-08T13:00:00.000Z",
          "please look at https://mainframe.app/v/37507089004e8f3700deb918a48b2556",
        ),
        functionCall("2026-05-08T13:05:00.000Z"),
      ]),
    );

    expect(summary).toMatchObject({ kind: "ready", workHappened: true, alreadyShared: false });
  });

  it("accepts RFC3339 timestamps with sub-millisecond precision", () => {
    const summary = summarizeCodexTranscript(
      codexRollout([
        sessionMeta,
        userMessage("2026-05-08T13:00:00.123456789+00:00", "please work on this"),
      ]),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.123Z"),
    });
  });

  it("uses a discriminated state when no real user message is present", () => {
    const summary = summarizeCodexTranscript(
      codexRollout([
        sessionMeta,
        {
          timestamp: "2026-05-08T13:00:00.000Z",
          type: "event_msg",
          payload: { type: "agent_message", message: "done" },
        },
      ]),
    );

    expect(summary).toEqual({ kind: "no-user" });
  });

  it("does not treat a synthetic response_item user row as a real user", () => {
    const summary = summarizeCodexTranscript(
      codexRollout([
        sessionMeta,
        {
          timestamp: "2026-05-08T13:00:00.000Z",
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: "<environment_context>cwd</environment_context>" },
            ],
          },
        },
      ]),
    );

    expect(summary).toEqual({ kind: "no-user" });
  });

  it("reports missing user time when the latest user timestamp is malformed", () => {
    const summary = summarizeCodexTranscript(
      codexRollout([
        sessionMeta,
        userMessage("2026-05-08T13:00:00.000Z", "first request"),
        userMessage("not-a-timestamp", "latest request"),
      ]),
    );

    expect(summary).toEqual({ kind: "missing-user-time" });
  });

  it("treats a transcript without a session_meta row as unreadable", () => {
    expect(
      summarizeCodexTranscript(codexRollout([userMessage("2026-05-08T13:00:00.000Z", "hi")])),
    ).toEqual({ kind: "unreadable" });
  });

  it("treats a Cursor-style transcript as unreadable", () => {
    expect(
      summarizeCodexTranscript(
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          event: "user_message",
          text: "please work on this",
        }),
      ),
    ).toEqual({ kind: "unreadable" });
  });

  it("treats corrupt JSONL as unreadable", () => {
    expect(summarizeCodexTranscript([JSON.stringify(sessionMeta), "{not-json"].join("\n"))).toEqual(
      { kind: "unreadable" },
    );
  });

  it("treats non-object rows as unreadable", () => {
    expect(summarizeCodexTranscript(JSON.stringify(["not", "a", "codex", "row"]))).toEqual({
      kind: "unreadable",
    });
  });

  it("uses a discriminated state when the transcript file cannot be read", () => {
    expect(summarizeCodexTranscriptFile("/tmp/mainframe-missing-rollout.jsonl")).toEqual({
      kind: "unreadable",
    });
  });
});

function codexRollout(rows: Array<Record<string, unknown>>): string {
  return rows.map((row) => JSON.stringify(row)).join("\n");
}

function userMessage(timestamp: string, message: string): Record<string, unknown> {
  return {
    timestamp,
    type: "event_msg",
    payload: { type: "user_message", message, kind: "plain" },
  };
}

function functionCall(timestamp: string): Record<string, unknown> {
  return {
    timestamp,
    type: "response_item",
    payload: { type: "function_call", name: "shell", arguments: "{}", call_id: "call_1" },
  };
}
