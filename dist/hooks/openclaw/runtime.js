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
            if (event.stopHookActive || state.kind === "idle") {
                return undefined;
            }
            // The finalize event has no per-message timestamps, so the turn-scoped
            // signals collected above stand in for a transcript summary and run
            // through the same stop policy as the other hosts. Only the current final
            // answer is checked for an existing share; older history is intentionally
            // not scanned so a stale Mainframe link cannot mute later turns.
            const summary = {
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
export function registerMainframeHooks(api, options = {}) {
    const tracker = createMainframeFinalizeTracker(options);
    api.on("agent_turn_prepare", tracker.onTurnPrepare);
    api.on("after_tool_call", tracker.onToolCall);
    api.on("before_agent_finalize", tracker.onFinalize);
    return tracker;
}
