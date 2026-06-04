import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { summarizeClaudeTranscript, summarizeClaudeTranscriptFile } from "./transcript.js";

describe("summarizeClaudeTranscript", () => {
  it("summarizes assistant tool_use work after the last user message", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        userMessage("2026-05-08T12:00:00.000Z", "earlier request"),
        userMessage("2026-05-08T13:00:00.000Z", "final request"),
        assistantToolUse("2026-05-08T13:05:00.000Z"),
      ]),
    );

    expect(summary).toEqual({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
      alreadyShared: false,
    });
  });

  it("resets work state on each user turn", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        userMessage("2026-05-08T13:00:00.000Z", "first request"),
        assistantToolUse("2026-05-08T13:05:00.000Z"),
        userMessage("2026-05-08T14:00:00.000Z", "second request"),
      ]),
    );

    expect(summary).toEqual({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T14:00:00.000Z"),
      workHappened: false,
      alreadyShared: false,
    });
  });

  it("does not treat a tool_result user entry as a real user message", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        userMessage("2026-05-08T13:00:00.000Z", "please work on this"),
        assistantToolUse("2026-05-08T13:05:00.000Z"),
        toolResult("2026-05-08T13:06:00.000Z", "command output"),
      ]),
    );

    expect(summary).toEqual({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
      alreadyShared: false,
    });
  });

  it("treats a text-block array user message as a real user turn", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        userMessage("2026-05-08T13:00:00.000Z", [{ type: "text", text: "please work on this" }]),
        assistantToolUse("2026-05-08T13:05:00.000Z"),
      ]),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
    });
  });

  it("does not let a tool-result entry with string content reset the AFK timer", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        userMessage("2026-05-08T13:00:00.000Z", "please work on this"),
        assistantToolUse("2026-05-08T13:05:00.000Z"),
        {
          type: "user",
          timestamp: "2026-05-08T13:06:00.000Z",
          sessionId: "session-1",
          uuid: "tool-result-1",
          parentUuid: "assistant-1",
          sourceToolAssistantUUID: "assistant-1",
          toolUseResult: { stdout: "build succeeded", stderr: "", interrupted: false },
          message: { role: "user", content: "build succeeded" },
        },
      ]),
    );

    expect(summary).toEqual({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
      alreadyShared: false,
    });
  });

  it("does not treat an entry carrying only sourceToolAssistantUUID as a user turn", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        userMessage("2026-05-08T13:00:00.000Z", "please work on this"),
        assistantToolUse("2026-05-08T13:05:00.000Z"),
        {
          type: "user",
          timestamp: "2026-05-08T13:06:00.000Z",
          sessionId: "session-1",
          uuid: "tool-result-2",
          parentUuid: "assistant-1",
          sourceToolAssistantUUID: "assistant-1",
          message: { role: "user", content: "some tool output text" },
        },
      ]),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
    });
  });

  it("does not let an isMeta system-injected note reset the AFK timer", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        userMessage("2026-05-08T13:00:00.000Z", "please work on this"),
        assistantToolUse("2026-05-08T13:05:00.000Z"),
        {
          type: "user",
          timestamp: "2026-05-08T14:00:00.000Z",
          sessionId: "session-1",
          uuid: "meta-1",
          parentUuid: "assistant-1",
          isMeta: true,
          message: {
            role: "user",
            content: "<system-reminder>You are running low on context.</system-reminder>",
          },
        },
      ]),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
    });
  });

  it("counts work done through MCP tool_use blocks", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        userMessage("2026-05-08T13:00:00.000Z", "please work on this"),
        {
          type: "assistant",
          timestamp: "2026-05-08T13:05:00.000Z",
          message: {
            role: "assistant",
            content: [
              { type: "tool_use", id: "toolu_1", name: "mcp__mainframe__create_video", input: {} },
            ],
          },
        },
      ]),
    );

    expect(summary).toMatchObject({ kind: "ready", workHappened: true });
  });

  it("ignores unrelated entry types and assistant text-only turns", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        { type: "summary", summary: "Prior session", leafUuid: "leaf-1" },
        { type: "system", subtype: "info", content: "context loaded" },
        userMessage("2026-05-08T13:00:00.000Z", "please work on this"),
        assistantText("2026-05-08T13:02:00.000Z", "Thinking out loud."),
        assistantToolUse("2026-05-08T13:05:00.000Z"),
      ]),
    );

    expect(summary).toEqual({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: true,
      alreadyShared: false,
    });
  });

  it("does not count an assistant text-only turn as work", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        userMessage("2026-05-08T13:00:00.000Z", "please answer"),
        assistantText("2026-05-08T13:30:00.000Z", "Here is my answer."),
      ]),
    );

    expect(summary).toEqual({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.000Z"),
      workHappened: false,
      alreadyShared: false,
    });
  });

  it("detects an existing Mainframe share from tool_result output", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        userMessage("2026-05-08T13:00:00.000Z", "please work on this"),
        assistantToolUse("2026-05-08T13:05:00.000Z"),
        toolResult(
          "2026-05-08T13:30:00.000Z",
          "Shared: https://mainframe.app/v/37507089004e8f3700deb918a48b2556",
        ),
      ]),
    );

    expect(summary).toMatchObject({ kind: "ready", workHappened: true, alreadyShared: true });
  });

  it("detects a Mainframe share from an assistant message", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        userMessage("2026-05-08T13:00:00.000Z", "please work on this"),
        assistantToolUse("2026-05-08T13:05:00.000Z"),
        assistantText(
          "2026-05-08T13:30:00.000Z",
          "Done: https://mainframe.app/v/37507089004e8f3700deb918a48b2556",
        ),
      ]),
    );

    expect(summary).toMatchObject({ kind: "ready", alreadyShared: true });
  });

  it("does not treat a video URL in the latest user message as an existing share", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([
        userMessage(
          "2026-05-08T13:00:00.000Z",
          "please look at https://mainframe.app/v/37507089004e8f3700deb918a48b2556",
        ),
        assistantToolUse("2026-05-08T13:05:00.000Z"),
      ]),
    );

    expect(summary).toMatchObject({ kind: "ready", workHappened: true, alreadyShared: false });
  });

  it("accepts ISO timestamps with sub-millisecond precision", () => {
    const summary = summarizeClaudeTranscript(
      claudeTranscript([userMessage("2026-05-08T13:00:00.123456789+00:00", "please work on this")]),
    );

    expect(summary).toMatchObject({
      kind: "ready",
      lastUserTimeMs: Date.parse("2026-05-08T13:00:00.123Z"),
    });
  });

  it("treats out-of-order user timestamps as unreadable", () => {
    expect(
      summarizeClaudeTranscript(
        claudeTranscript([
          userMessage("2026-05-08T15:00:00.000Z", "latest request"),
          userMessage("2026-05-08T13:00:00.000Z", "older request emitted later"),
          assistantToolUse("2026-05-08T13:05:00.000Z"),
        ]),
      ),
    ).toEqual({ kind: "unreadable" });
  });

  it("reports missing user time when the latest user timestamp is malformed", () => {
    expect(
      summarizeClaudeTranscript(
        claudeTranscript([
          userMessage("2026-05-08T13:00:00.000Z", "first request"),
          userMessage("not-a-timestamp", "latest request"),
        ]),
      ),
    ).toEqual({ kind: "missing-user-time" });
  });

  it("uses a discriminated state when no real user message is present", () => {
    expect(
      summarizeClaudeTranscript(
        claudeTranscript([assistantText("2026-05-08T13:30:00.000Z", "done")]),
      ),
    ).toEqual({ kind: "no-user" });
  });

  it("does not treat a tool_result-only turn as a real user message", () => {
    expect(
      summarizeClaudeTranscript(
        claudeTranscript([toolResult("2026-05-08T13:00:00.000Z", "stray output")]),
      ),
    ).toEqual({ kind: "no-user" });
  });

  it("treats a Cursor-style transcript as unreadable", () => {
    expect(
      summarizeClaudeTranscript(
        JSON.stringify({
          timestamp: "2026-05-08T13:00:00.000Z",
          event: "user_message",
          text: "please work on this",
        }),
      ),
    ).toEqual({ kind: "unreadable" });
  });

  it("treats a Codex-style transcript as unreadable", () => {
    expect(
      summarizeClaudeTranscript(
        [
          JSON.stringify({
            timestamp: "2026-05-08T12:55:00.000Z",
            type: "session_meta",
            payload: { id: "session-1", cwd: "/workspace" },
          }),
          JSON.stringify({
            timestamp: "2026-05-08T13:00:00.000Z",
            type: "event_msg",
            payload: { type: "user_message", message: "please work on this", kind: "plain" },
          }),
        ].join("\n"),
      ),
    ).toEqual({ kind: "unreadable" });
  });

  it("treats a user entry without a message object as unreadable", () => {
    expect(
      summarizeClaudeTranscript(
        JSON.stringify({ type: "user", timestamp: "2026-05-08T13:00:00.000Z" }),
      ),
    ).toEqual({ kind: "unreadable" });
  });

  it("treats corrupt JSONL as unreadable", () => {
    expect(
      summarizeClaudeTranscript(
        [
          JSON.stringify(userMessage("2026-05-08T13:00:00.000Z", "please work on this")),
          "{not-json",
        ].join("\n"),
      ),
    ).toEqual({ kind: "unreadable" });
  });

  it("treats non-object rows as unreadable", () => {
    expect(summarizeClaudeTranscript(JSON.stringify(["not", "a", "claude", "row"]))).toEqual({
      kind: "unreadable",
    });
  });

  it("uses a discriminated state when the transcript file cannot be read", () => {
    expect(summarizeClaudeTranscriptFile("/tmp/mainframe-missing-claude-transcript.jsonl")).toEqual(
      { kind: "unreadable" },
    );
  });

  it("treats symlink transcript paths as unreadable", () => {
    const directory = mkdtempSync(join(tmpdir(), "mainframe-claude-transcript-test-"));
    const sourcePath = join(directory, "source.jsonl");
    const symlinkPath = join(directory, "linked.jsonl");
    writeFileSync(
      sourcePath,
      claudeTranscript([userMessage("2026-05-08T13:00:00.000Z", "please work on this")]),
    );
    symlinkSync(sourcePath, symlinkPath);

    expect(summarizeClaudeTranscriptFile(symlinkPath)).toEqual({ kind: "unreadable" });
  });
});

function claudeTranscript(rows: Array<Record<string, unknown>>): string {
  return rows.map((row) => JSON.stringify(row)).join("\n");
}

function userMessage(timestamp: string, content: unknown): Record<string, unknown> {
  return {
    parentUuid: null,
    isSidechain: false,
    userType: "external",
    sessionId: "session-1",
    type: "user",
    message: { role: "user", content },
    uuid: `user-${timestamp}`,
    timestamp,
  };
}

function assistantToolUse(timestamp: string): Record<string, unknown> {
  return {
    parentUuid: null,
    isSidechain: false,
    sessionId: "session-1",
    type: "assistant",
    message: {
      role: "assistant",
      model: "claude-opus-4-20250514",
      content: [{ type: "tool_use", id: "toolu_1", name: "Bash", input: { command: "ls" } }],
    },
    uuid: `assistant-${timestamp}`,
    timestamp,
  };
}

function assistantText(timestamp: string, text: string): Record<string, unknown> {
  return {
    parentUuid: null,
    isSidechain: false,
    sessionId: "session-1",
    type: "assistant",
    message: {
      role: "assistant",
      model: "claude-opus-4-20250514",
      content: [{ type: "text", text }],
    },
    uuid: `assistant-${timestamp}`,
    timestamp,
  };
}

function toolResult(timestamp: string, content: string): Record<string, unknown> {
  return {
    parentUuid: null,
    isSidechain: false,
    userType: "external",
    sessionId: "session-1",
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content }] },
    uuid: `tool-result-${timestamp}`,
    timestamp,
  };
}
