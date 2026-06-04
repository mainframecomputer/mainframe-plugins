import { decideStop } from "../core/stop-policy.js";
import { hasMainframeVideoUrl } from "../core/transcript.js";
export function createMainframeFinalizeTracker(options = {}) {
    const nowMs = options.nowMs ?? (() => Date.now());
    let state = { kind: "idle" };
    return {
        onTurnPrepare() {
            state = { kind: "tracking", turnStartMs: nowMs(), workHappened: false, alreadyShared: false };
        },
        onToolCall(event) {
            if (state.kind === "tracking") {
                state = {
                    kind: "tracking",
                    turnStartMs: state.turnStartMs,
                    workHappened: true,
                    alreadyShared: state.alreadyShared || hasMainframeVideoUrl(event?.result),
                };
            }
        },
        onFinalize(event) {
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
            const summary = {
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
export function registerMainframeHooks(api, options = {}) {
    const tracker = createMainframeFinalizeTracker(options);
    // The tracker methods close over local state, not `this`, so the host calling
    // them detached is safe. Keep them `this`-free if this is ever refactored.
    api.on("agent_turn_prepare", tracker.onTurnPrepare);
    api.on("after_tool_call", tracker.onToolCall);
    api.on("before_agent_finalize", tracker.onFinalize);
    return tracker;
}
