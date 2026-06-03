import { lstatSync, readFileSync } from "node:fs";
import { isJsonRecord } from "./json.js";
const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;
const MIN_EPOCH_SECONDS = 946_684_800;
const MAX_EPOCH_SECONDS = 4_102_444_800;
const MIN_EPOCH_MS = MIN_EPOCH_SECONDS * 1000;
const MAX_EPOCH_MS = MAX_EPOCH_SECONDS * 1000;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAINFRAME_VIDEO_URL_PREFIX = "https://mainframe.app/v/";
export function summarizeTranscriptFile(path, parseRows) {
    const text = readTranscriptText(path);
    if (text === null) {
        return { kind: "unreadable" };
    }
    return summarizeTranscript(text, parseRows);
}
export function summarizeTranscript(text, parseRows) {
    const parsed = parseRows(text);
    if (parsed === "unreadable") {
        return { kind: "unreadable" };
    }
    if (!parsed.sawUser) {
        return { kind: "no-user" };
    }
    if (parsed.lastUserTimeMs === null) {
        return { kind: "missing-user-time" };
    }
    return {
        kind: "ready",
        lastUserTimeMs: parsed.lastUserTimeMs,
        workHappened: parsed.workHappened,
        alreadyShared: parsed.alreadyShared,
    };
}
function readTranscriptText(path) {
    try {
        const stat = lstatSync(path);
        if (!stat.isFile() || stat.size > MAX_TRANSCRIPT_BYTES) {
            return null;
        }
        return readFileSync(path, "utf8");
    }
    catch {
        return null;
    }
}
export function isNonEmptyString(value) {
    return typeof value === "string" && value.trim() !== "";
}
// Advance the user-message time cursor while enforcing non-decreasing order.
// Returns the parsed time (which may be null when absent/ambiguous), or
// "unreadable" when a user timestamp moves backwards: transcripts are
// append-only, so a regression means the input can't be trusted and the hook
// must fail closed. Shared so every host applies the same ordering rule.
export function nextUserTimeMs(rawTimestamp, previousUserTimeMs) {
    const userTimeMs = parseTimestampMs(rawTimestamp);
    if (previousUserTimeMs !== null && userTimeMs !== null && userTimeMs < previousUserTimeMs) {
        return "unreadable";
    }
    return userTimeMs;
}
export function parseTimestampMs(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return normalizeEpochMs(value);
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "") {
            return null;
        }
        if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
            return normalizeEpochMs(Number(trimmed));
        }
        if (!ISO_TIMESTAMP_PATTERN.test(trimmed)) {
            return null;
        }
        const parsed = Date.parse(trimmed);
        if (Number.isFinite(parsed) && parsed >= MIN_EPOCH_MS && parsed <= MAX_EPOCH_MS) {
            return parsed;
        }
    }
    return null;
}
export function hasMainframeVideoUrl(value) {
    if (typeof value === "string") {
        return value.includes(MAINFRAME_VIDEO_URL_PREFIX);
    }
    if (Array.isArray(value)) {
        return value.some((entry) => hasMainframeVideoUrl(entry));
    }
    if (isJsonRecord(value)) {
        return Object.values(value).some((entry) => hasMainframeVideoUrl(entry));
    }
    return false;
}
function normalizeEpochMs(value) {
    if (value >= MIN_EPOCH_SECONDS && value <= MAX_EPOCH_SECONDS) {
        return Math.round(value * 1000);
    }
    if (value >= MIN_EPOCH_MS && value <= MAX_EPOCH_MS) {
        return Math.round(value);
    }
    return null;
}
