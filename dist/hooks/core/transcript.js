import { readFileSync } from "node:fs";
import { isJsonRecord } from "./json.js";
const SECONDS_TIMESTAMP_CUTOFF = 1_000_000_000_000;
const MAINFRAME_TOOL_NAMES = new Set(["generate_video", "upload_video", "get_video"]);
const WATCH_URL_KEYS = new Set(["watchUrl", "watch_url"]);
export function summarizeTranscriptFile(path) {
    try {
        return summarizeTranscript(readFileSync(path, "utf8"));
    }
    catch {
        return { kind: "unreadable" };
    }
}
export function summarizeTranscript(text) {
    const summary = summarizeCursorRows(text);
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
        const numeric = Number(trimmed);
        if (Number.isFinite(numeric)) {
            return normalizeEpochMs(numeric);
        }
        const parsed = Date.parse(trimmed);
        if (Number.isFinite(parsed)) {
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
                continue;
            }
            const row = parseCursorTranscriptRow(parsed);
            if (row === null) {
                continue;
            }
            if (row.event === "user_message") {
                sawUser = true;
                lastUserTimeMs = parseTimestampMs(row.timestamp);
                workHappened = false;
                alreadyShared = false;
                continue;
            }
            if (sawUser) {
                workHappened = true;
                alreadyShared = alreadyShared || isMainframeShareRow(row);
            }
        }
        catch {
            continue;
        }
    }
    return { sawUser, lastUserTimeMs, workHappened, alreadyShared };
}
function parseCursorTranscriptRow(record) {
    if (record.event === "user_message") {
        return { event: record.event, timestamp: record.timestamp };
    }
    if (record.event === "tool_call" && typeof record.name === "string") {
        return {
            event: record.event,
            timestamp: record.timestamp,
            name: record.name,
            output: record.output,
        };
    }
    return null;
}
function normalizeEpochMs(value) {
    return value < SECONDS_TIMESTAMP_CUTOFF ? Math.round(value * 1000) : Math.round(value);
}
function isMainframeShareRow(row) {
    if (row.event !== "tool_call" || !MAINFRAME_TOOL_NAMES.has(row.name)) {
        return false;
    }
    return hasMainframeWatchUrl(row.output);
}
function hasMainframeWatchUrl(value) {
    if (typeof value === "string") {
        return value.startsWith("https://mainframe.app/watch/");
    }
    if (Array.isArray(value)) {
        return value.some((entry) => hasMainframeWatchUrl(entry));
    }
    if (isJsonRecord(value)) {
        return Object.entries(value).some(([key, entry]) => {
            if (WATCH_URL_KEYS.has(key)) {
                return hasMainframeWatchUrl(entry);
            }
            return false;
        });
    }
    return false;
}
