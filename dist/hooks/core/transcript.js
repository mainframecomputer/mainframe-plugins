import { lstatSync, readFileSync } from "node:fs";
import { isJsonRecord } from "./json.js";
const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;
const MIN_EPOCH_SECONDS = 946_684_800;
const MAX_EPOCH_SECONDS = 4_102_444_800;
const MIN_EPOCH_MS = MIN_EPOCH_SECONDS * 1000;
const MAX_EPOCH_MS = MAX_EPOCH_SECONDS * 1000;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAINFRAME_WATCH_URL_PREFIX = "https://mainframe.app/watch/";
export function summarizeTranscriptFile(path) {
    try {
        const stat = lstatSync(path);
        if (!stat.isFile() || stat.size > MAX_TRANSCRIPT_BYTES) {
            return { kind: "unreadable" };
        }
        return summarizeTranscript(readFileSync(path, "utf8"));
    }
    catch {
        return { kind: "unreadable" };
    }
}
export function summarizeTranscript(text) {
    const summary = summarizeCursorRows(text);
    if (summary.kind === "unreadable") {
        return summary;
    }
    if (!summary.sawUser) {
        return { kind: "no-user" };
    }
    if (summary.lastUserTimeMs === null) {
        return { kind: "missing-user-time" };
    }
    return {
        kind: "ready",
        lastUserTimeMs: summary.lastUserTimeMs,
        workHappened: summary.workHappened,
        alreadyShared: summary.alreadyShared,
    };
}
function parseTimestampMs(value) {
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
function summarizeCursorRows(text) {
    let sawUser = false;
    let lastUserTimeMs = null;
    let workHappened = false;
    let alreadyShared = false;
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (!isJsonRecord(parsed)) {
                return { kind: "unreadable" };
            }
            const event = readCursorTranscriptEvent(parsed);
            if (event === "user_message") {
                sawUser = true;
                lastUserTimeMs = parseTimestampMs(parsed.timestamp);
                workHappened = false;
                alreadyShared = false;
                continue;
            }
            if (!isPostUserCursorEvent(event)) {
                continue;
            }
            if (sawUser) {
                workHappened = workHappened || event === "tool_call";
                alreadyShared = alreadyShared || hasMainframeWatchUrl(parsed);
            }
        }
        catch {
            return { kind: "unreadable" };
        }
    }
    return { kind: "parsed", sawUser, lastUserTimeMs, workHappened, alreadyShared };
}
function readCursorTranscriptEvent(record) {
    if (record.event === "user_message") {
        return record.event;
    }
    if (record.event === "tool_call" && typeof record.name === "string") {
        return record.event;
    }
    if (record.event === "assistant_message") {
        return record.event;
    }
    return null;
}
function isPostUserCursorEvent(event) {
    return event === "assistant_message" || event === "tool_call";
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
function hasMainframeWatchUrl(value) {
    if (typeof value === "string") {
        return value.includes(MAINFRAME_WATCH_URL_PREFIX);
    }
    if (Array.isArray(value)) {
        return value.some((entry) => hasMainframeWatchUrl(entry));
    }
    if (isJsonRecord(value)) {
        return Object.values(value).some((entry) => hasMainframeWatchUrl(entry));
    }
    return false;
}
