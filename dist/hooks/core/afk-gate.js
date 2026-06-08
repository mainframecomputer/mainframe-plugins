export const MS_PER_HOUR = 3_600_000;
export const DEFAULT_AFK_THRESHOLD_MS = MS_PER_HOUR;
// Shared share-video call to action. Hosts frame it differently (the AFK gate
// prepends an elapsed-hours clause; Hermes prepends an unshared-work clause),
// so the product copy lives here once to keep every host's nudge consistent.
export const SHARE_VIDEO_SKILL_SUGGESTION = "using the share-video skill to leave a short Mainframe video summarizing what you did";
export function evaluateAfkGate(input) {
    const elapsedMs = input.stopTimeMs - input.lastUserTimeMs;
    if (elapsedMs < DEFAULT_AFK_THRESHOLD_MS) {
        return { fire: false };
    }
    if (!input.workHappened) {
        return { fire: false };
    }
    if (input.alreadyShared) {
        return { fire: false };
    }
    const elapsedHours = (elapsedMs / MS_PER_HOUR).toFixed(1);
    return {
        fire: true,
        reason: `The user has been away for about ${elapsedHours} hours while you worked. Consider ${SHARE_VIDEO_SKILL_SUGGESTION}, then stop.`,
    };
}
