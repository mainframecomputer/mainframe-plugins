import { decideStop } from "../core/stop-policy.js";
import { hasMainframeVideoUrl } from "../core/transcript.js";
export function createMainframeFinalizeTracker(options = {}) {
    const nowMs = options.nowMs ?? (() => Date.now());
    let state = { kind: "idle" };
    return {
        onTurnPrepare() {
            state = { kind: "tracking", turnStartMs: nowMs(), workHappened: false };
        },
        onToolCall() {
            if (state.kind === "tracking") {
                state = { kind: "tracking", turnStartMs: state.turnStartMs, workHappened: true };
            }
        },
        onFinalize(event) {
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
            const summary = {
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
export function registerMainframeHooks(api, options = {}) {
    const tracker = createMainframeFinalizeTracker(options);
    // The tracker methods close over local state, not `this`, so the host calling
    // them detached is safe. Keep them `this`-free if this is ever refactored.
    api.on("agent_turn_prepare", tracker.onTurnPrepare);
    api.on("after_tool_call", tracker.onToolCall);
    api.on("before_agent_finalize", tracker.onFinalize);
    return tracker;
}
