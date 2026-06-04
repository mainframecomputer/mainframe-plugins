import { decideStop } from "../core/stop-policy.js";
import { hasMainframeVideoUrl, type TranscriptSummary } from "../core/transcript.js";

// Minimal local mirror of the OpenClaw plugin hook surface this plugin uses,
// per https://docs.openclaw.ai/plugins/hooks (openclaw 2026.6.1). Like the
// Cursor, Codex, and Claude Code hooks, this models the host contract locally
// instead of depending on a host SDK. `stopHookActive` is optional so the guard
// can fail closed when the host omits or malforms it, and the assistant/tool
// payloads are `unknown` because `hasMainframeVideoUrl` already recurses over
// strings, arrays, and records.
export type OpenClawFinalizeEvent = {
  stopHookActive?: boolean;
  lastAssistantMessage?: unknown;
};

export type OpenClawToolCallEvent = {
  result?: unknown;
};

export type OpenClawReviseResult = { action: "revise"; reason: string };

// OpenClaw exposes a final-answer review gate (`before_agent_finalize`) instead
// of the stdin/stdout Stop hook the other hosts use, and its event carries no
// per-message wall-clock time. Elapsed time is therefore measured across the
// turn: `agent_turn_prepare` marks the start, `after_tool_call` records that
// work happened and watches tool results for an existing Mainframe share, and
// `before_agent_finalize` feeds the turn-scoped signals into the shared stop
// policy. The tracker fails closed: any finalize spends the armed turn (so it
// suggests at most once), it proceeds only on an explicit `stopHookActive ===
// false`, it never suggests without a turn start and observed tool work, and a
// missing or malformed event is tolerated as a no-op rather than throwing.
export type OpenClawPluginApi = {
  on(hookName: "agent_turn_prepare", handler: () => void): void;
  on(hookName: "after_tool_call", handler: (event: OpenClawToolCallEvent) => void): void;
  on(
    hookName: "before_agent_finalize",
    handler: (event: OpenClawFinalizeEvent) => OpenClawReviseResult | undefined,
  ): void;
};

export type MainframeFinalizeTracker = {
  onTurnPrepare: () => void;
  onToolCall: (event?: OpenClawToolCallEvent) => void;
  onFinalize: (event?: OpenClawFinalizeEvent) => OpenClawReviseResult | undefined;
};

type TrackerState =
  | { kind: "idle" }
  | { kind: "tracking"; turnStartMs: number; workHappened: boolean; alreadyShared: boolean };

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
      state = { kind: "tracking", turnStartMs: nowMs(), workHappened: false, alreadyShared: false };
    },

    onToolCall(event?: OpenClawToolCallEvent): void {
      if (state.kind === "tracking") {
        state = {
          kind: "tracking",
          turnStartMs: state.turnStartMs,
          workHappened: true,
          alreadyShared: state.alreadyShared || hasMainframeVideoUrl(event?.result),
        };
      }
    },

    onFinalize(event?: OpenClawFinalizeEvent): OpenClawReviseResult | undefined {
      if (state.kind === "idle") {
        return undefined;
      }

      // Any finalize attempt spends the armed turn, so a re-finalize after a
      // revise, or a later finalize the host emits without a fresh
      // `agent_turn_prepare`, hits the idle guard instead of reusing stale
      // turn-start/work signals.
      const { turnStartMs, workHappened, alreadyShared } = state;
      state = { kind: "idle" };

      // Fail closed on the loop guard: proceed only when the host explicitly
      // reports the turn is not already being re-prompted. A missing or
      // malformed event reads as `undefined` here and skips.
      if (event?.stopHookActive !== false) {
        return undefined;
      }

      // The turn-scoped signals stand in for a transcript summary and run
      // through the same stop policy as the other hosts. A share counts when it
      // appears in this turn's tool results or the current final answer; older
      // history is intentionally not scanned so a stale link cannot mute later
      // turns.
      const summary: TranscriptSummary = {
        kind: "ready",
        lastUserTimeMs: turnStartMs,
        workHappened,
        alreadyShared: alreadyShared || hasMainframeVideoUrl(event?.lastAssistantMessage),
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
