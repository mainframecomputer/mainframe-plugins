import { decideStop } from "../core/stop-policy.js";
import { hasMainframeVideoUrl, type TranscriptSummary } from "../core/transcript.js";

// Minimal local mirror of the OpenClaw plugin hook surface this plugin uses,
// per https://docs.openclaw.ai/plugins/hooks (openclaw 2026.6.1). Like the
// Cursor, Codex, and Claude Code hooks, this models the host contract locally
// instead of depending on a host SDK.
export type OpenClawFinalizeEvent = {
  stopHookActive: boolean;
  lastAssistantMessage?: string;
};

export type OpenClawReviseResult = { action: "revise"; reason: string };

// OpenClaw exposes a final-answer review gate (`before_agent_finalize`) instead
// of the stdin/stdout Stop hook the other hosts use, and its event carries no
// per-message wall-clock time. Elapsed time is therefore measured across the
// turn: `agent_turn_prepare` marks the start, `after_tool_call` records that
// work happened, and `before_agent_finalize` feeds the shared stop policy to
// ask for one more pass that leaves a Mainframe video. The tracker fails closed:
// if a turn never starts or no tool work is seen, it never suggests.
export type OpenClawPluginApi = {
  on(hookName: "agent_turn_prepare", handler: () => void): void;
  on(hookName: "after_tool_call", handler: () => void): void;
  on(
    hookName: "before_agent_finalize",
    handler: (event: OpenClawFinalizeEvent) => OpenClawReviseResult | undefined,
  ): void;
};

export type MainframeFinalizeTracker = {
  onTurnPrepare: () => void;
  onToolCall: () => void;
  onFinalize: (event: OpenClawFinalizeEvent) => OpenClawReviseResult | undefined;
};

type TrackerState =
  | { kind: "idle" }
  | { kind: "tracking"; turnStartMs: number; workHappened: boolean };

export type MainframeTrackerOptions = {
  nowMs?: () => number;
};

export function createMainframeFinalizeTracker(
  options: MainframeTrackerOptions = {},
): MainframeFinalizeTracker {
  const nowMs = options.nowMs ?? (() => Date.now());
  let state: TrackerState = { kind: "idle" };

  return {
    onTurnPrepare(): void {
      state = { kind: "tracking", turnStartMs: nowMs(), workHappened: false };
    },

    onToolCall(): void {
      if (state.kind === "tracking") {
        state = { kind: "tracking", turnStartMs: state.turnStartMs, workHappened: true };
      }
    },

    onFinalize(event: OpenClawFinalizeEvent): OpenClawReviseResult | undefined {
      if (event.stopHookActive || state.kind === "idle") {
        return undefined;
      }

      // The finalize event has no per-message timestamps, so the turn-scoped
      // signals collected above stand in for a transcript summary and run
      // through the same stop policy as the other hosts. Only the current final
      // answer is checked for an existing share; older history is intentionally
      // not scanned so a stale Mainframe link cannot mute later turns.
      const summary: TranscriptSummary = {
        kind: "ready",
        lastUserTimeMs: state.turnStartMs,
        workHappened: state.workHappened,
        alreadyShared: hasMainframeVideoUrl(event.lastAssistantMessage),
      };
      const decision = decideStop(summary, nowMs());

      return decision.kind === "suggest"
        ? { action: "revise", reason: decision.message }
        : undefined;
    },
  };
}

export function registerMainframeHooks(
  api: OpenClawPluginApi,
  options: MainframeTrackerOptions = {},
): MainframeFinalizeTracker {
  const tracker = createMainframeFinalizeTracker(options);
  api.on("agent_turn_prepare", tracker.onTurnPrepare);
  api.on("after_tool_call", tracker.onToolCall);
  api.on("before_agent_finalize", tracker.onFinalize);
  return tracker;
}
