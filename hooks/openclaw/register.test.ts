import { describe, expect, it } from "vitest";

import plugin, { registerMainframeHooks } from "./register.js";
import {
  createMainframeFinalizeTracker,
  type OpenClawFinalizeEvent,
  type OpenClawPluginApi,
} from "./runtime.js";

const userTimeMs = Date.parse("2026-05-08T13:00:00.000Z");
const awayTimeMs = Date.parse("2026-05-08T15:30:00.000Z");
const sharedVideoUrl = "https://mainframe.app/v/37507089004e8f3700deb918a48b2556";

function trackerAt(times: readonly number[]): ReturnType<typeof createMainframeFinalizeTracker> {
  let index = 0;
  return createMainframeFinalizeTracker({
    nowMs: () => times[Math.min(index++, times.length - 1)] ?? awayTimeMs,
  });
}

describe("OpenClaw before_agent_finalize hook", () => {
  it("asks for a revise after tool work once the user is away past the threshold", () => {
    const tracker = trackerAt([userTimeMs, awayTimeMs]);
    tracker.onTurnPrepare();
    tracker.onToolCall();

    const result = tracker.onFinalize({ stopHookActive: false });

    expect(result?.action).toBe("revise");
    expect(result?.reason).toContain("2.5 hours");
    expect(result?.reason).toContain("share-video");
  });

  it("does not fire before the fixed one-hour threshold", () => {
    const tracker = trackerAt([userTimeMs, Date.parse("2026-05-08T13:30:00.000Z")]);
    tracker.onTurnPrepare();
    tracker.onToolCall();

    expect(tracker.onFinalize({ stopHookActive: false })).toBeUndefined();
  });

  it("does not fire when no tool work happened since the turn began", () => {
    const tracker = trackerAt([userTimeMs, awayTimeMs]);
    tracker.onTurnPrepare();

    expect(tracker.onFinalize({ stopHookActive: false })).toBeUndefined();
  });

  it("does not fire when finalize arrives before any turn began", () => {
    const tracker = trackerAt([awayTimeMs]);

    expect(tracker.onFinalize({ stopHookActive: false })).toBeUndefined();
  });

  it("does not fire after a continuation already re-prompted the agent", () => {
    const tracker = trackerAt([userTimeMs, awayTimeMs]);
    tracker.onTurnPrepare();
    tracker.onToolCall();

    expect(tracker.onFinalize({ stopHookActive: true })).toBeUndefined();
  });

  it("does not fire after a Mainframe video URL already appears in the turn", () => {
    for (const event of sharedEvents()) {
      const tracker = trackerAt([userTimeMs, awayTimeMs]);
      tracker.onTurnPrepare();
      tracker.onToolCall();

      expect(tracker.onFinalize(event)).toBeUndefined();
    }
  });

  it("derives its suggestion from elapsed time only and never echoes turn content", () => {
    const tracker = trackerAt([userTimeMs, awayTimeMs]);
    tracker.onTurnPrepare();
    tracker.onToolCall();

    const result = tracker.onFinalize({
      stopHookActive: false,
      lastAssistantMessage: "SECRET_NEVER_LEAK",
      messages: [{ text: "ANOTHER_SECRET" }],
    });

    expect(result?.reason).not.toContain("SECRET_NEVER_LEAK");
    expect(result?.reason).not.toContain("ANOTHER_SECRET");
  });

  it("exports a default plugin entry that registers the OpenClaw hook names in order", () => {
    expect(plugin).toMatchObject({
      id: "mainframe",
      name: "Mainframe",
      description: "Create and share short video updates from agent work.",
    });
    expect(typeof plugin.register).toBe("function");

    const names: string[] = [];
    const api: OpenClawPluginApi = {
      on(hookName: string): void {
        names.push(hookName);
      },
    };
    registerMainframeHooks(api);

    expect(names).toEqual(["agent_turn_prepare", "after_tool_call", "before_agent_finalize"]);
  });
});

function sharedEvents(): OpenClawFinalizeEvent[] {
  return [
    { stopHookActive: false, lastAssistantMessage: `Shared: ${sharedVideoUrl}` },
    { stopHookActive: false, messages: [{ output: `Shared: ${sharedVideoUrl}` }] },
  ];
}
