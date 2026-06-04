import { decideStop } from "../core/stop-policy.js";
import { hasMainframeVideoUrl, type TranscriptSummary } from "../core/transcript.js";

// Minimal local mirror of the OpenClaw plugin hook surface this plugin uses,
// per https://docs.openclaw.ai/plugins/hooks (openclaw 2026.6.1). Like the
// Cursor, Codex, and Claude Code hooks, this models the host contract locally
// instead of depending on a host SDK.
export type OpenClawFinalizeEvent = {
  // Optional at this trust boundary so the guard can fail closed when the host
  // omits or malforms it, rather than coercing a missing value to "not active".
  stopHookActive?: boolean;
  // The host contract allows structured assistant content; `hasMainframeVideoUrl`
  // recurses over strings, arrays, and records, so keep this as `unknown`.
  lastAssistantMessage?: unknown;
};

export type OpenClawReviseResult = { action: "revise"; reason: string };

// OpenClaw exposes a final-answer review gate (`before_agent_finalize`) instead
// of the stdin/stdout Stop hook the other hosts use, and its event carries no
// per-message wall-clock time. Elapsed time is therefore measured across the
// turn: `agent_turn_prepare` marks the start, `after_tool_call` records that
// work happened, and `before_agent_finalize` feeds the shared stop policy to
// ask for one more pass that leaves a Mainframe video. The tracker fails closed:
// it suggests at most once per armed turn (finalize consumes the turn back to
// idle), only proceeds when the host reports `stopHookActive === false`, and
// never suggests without a turn start and observed tool work.
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
      // Fail closed on the loop guard: only a turn the host reports as not
      // already re-prompted may proceed, so a missing/ambiguous `stopHookActive`
      // skips instead of risking a re-suggest.
      if (event.stopHookActive !== false || state.kind === "idle") {
        return undefined;
      }

      // Consume the turn back to idle before deciding. A turn is suggested at
      // most once: a re-finalize after a revise, or any later finalize that the
      // host emits without a fresh `agent_turn_prepare`, hits the idle guard
      // instead of reusing stale turn-start/work signals.
      const { turnStartMs, workHappened } = state;
      state = { kind: "idle" };

      // The finalize event has no per-message timestamps, so the turn-scoped
      // signals stand in for a transcript summary and run through the same stop
      // policy as the other hosts. Only the current final answer is checked for
      // an existing share; older history is intentionally not scanned so a stale
      // Mainframe link cannot mute later turns.
      const summary: TranscriptSummary = {
        kind: "ready",
        lastUserTimeMs: turnStartMs,
        workHappened,
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
  // The tracker methods close over local state, not `this`, so the host calling
  // them detached is safe. Keep them `this`-free if this is ever refactored.
  api.on("agent_turn_prepare", tracker.onTurnPrepare);
  api.on("after_tool_call", tracker.onToolCall);
  api.on("before_agent_finalize", tracker.onFinalize);
  return tracker;
}
