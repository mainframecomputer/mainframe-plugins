import { evaluateAfkGate } from "../core/afk-gate.js";
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
            const gate = evaluateAfkGate({
                stopTimeMs: nowMs(),
                lastUserTimeMs: state.turnStartMs,
                workHappened: state.workHappened,
                alreadyShared: alreadySharedFromEvent(event),
            });
            return gate.fire ? { action: "revise", reason: gate.reason } : undefined;
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
function alreadySharedFromEvent(event) {
    return hasMainframeVideoUrl(event.lastAssistantMessage) || hasMainframeVideoUrl(event.messages);
}
