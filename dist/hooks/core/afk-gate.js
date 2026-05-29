import { z } from "zod";
export const MS_PER_HOUR = 3_600_000;
export const DEFAULT_AFK_THRESHOLD_MS = MS_PER_HOUR;
const positiveHourSchema = z.coerce.number().finite().positive();
export function evaluateAfkGate(input) {
    const elapsedMs = input.stopTimeMs - input.lastUserTimeMs;
    if (elapsedMs < input.thresholdMs) {
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
        reason: `The user has been away for about ${elapsedHours} hours while you worked. Consider using the share-video skill to leave a short Mainframe video summarizing what you did, then stop. If sensitive content makes a video unwise, ignore this hint and stop normally.`,
    };
}
export function thresholdMsFromEnv(value) {
    if (value === undefined || value.trim() === "") {
        return DEFAULT_AFK_THRESHOLD_MS;
    }
    return positiveHourSchema.parse(value) * MS_PER_HOUR;
}
//# sourceMappingURL=afk-gate.js.map