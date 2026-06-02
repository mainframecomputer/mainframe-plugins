import { readFileSync } from "node:fs";
import { isJsonRecord } from "./json.js";
const SECONDS_TIMESTAMP_CUTOFF = 1_000_000_000_000;
const TIMESTAMP_KEYS = ["timestamp", "created_at", "createdAt", "time", "ts"];
const TOOL_RECORD_KEYS = [
    "toolUse",
    "tool_use",
    "toolCall",
    "toolUseResult",
    "tool_use_result",
    "tool_call",
    "tool_calls",
];
const TOOL_NAME_MARKERS = [
    "bash",
    "shell",
    "exec",
    "apply_patch",
    "edit",
    "write",
    "read",
    "command",
];
const USER_EVENTS = new Set(["user_message", "user-prompt", "userpromptsubmit"]);
const MAINFRAME_TOOL_NAMES = new Set(["generate_video", "upload_video", "get_video"]);
const TOOL_OUTPUT_KEYS = ["output", "result", "content"];
const WATCH_URL_KEYS = new Set(["watchUrl", "watch_url"]);
const MAX_TOOL_PAYLOAD_DEPTH = 8;
export function summarizeTranscriptFile(path) {
    try {
        return summarizeTranscript(readFileSync(path, "utf8"));
    }
    catch {
        return { kind: "unreadable" };
    }
}
export function summarizeTranscript(text) {
    const records = parseJsonl(text);
    const lastUserIndex = findLastRealUserIndex(records);
    if (lastUserIndex === -1) {
        return { kind: "no-user" };
    }
    const lastUser = records[lastUserIndex];
    if (lastUser.timestampMs === null) {
        return { kind: "missing-user-time" };
    }
    const recentRecords = records.slice(lastUserIndex + 1);
    return {
        kind: "ready",
        lastUserTimeMs: lastUser.timestampMs,
        workHappened: recentRecords.some(({ record }) => isWorkRecord(record)),
        alreadyShared: recentRecords.some(({ record }) => isMainframeShareRecord(record)),
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
function extractTimestampMs(record) {
    for (const key of TIMESTAMP_KEYS) {
        const timestampMs = parseTimestampMs(record[key]);
        if (timestampMs !== null) {
            return timestampMs;
        }
    }
    const message = record.message;
    if (isJsonRecord(message)) {
        return extractTimestampMs(message);
    }
    return null;
}
function isRealUserRecord(record) {
    if ("toolUseResult" in record || "tool_use_result" in record || "tool_result" in record) {
        return false;
    }
    if (containsToolResult(record.content) || containsToolResult(record.message)) {
        return false;
    }
    const type = lowerString(record.type);
    const event = lowerString(record.event);
    const role = lowerString(record.role);
    const userType = lowerString(record.userType ?? record.user_type);
    const source = lowerString(record.source);
    const message = isJsonRecord(record.message) ? record.message : null;
    const messageRole = message === null ? "" : lowerString(message.role);
    if (type === "user" && (userType === "" || userType === "external")) {
        return true;
    }
    if (role === "user" || messageRole === "user") {
        return source !== "tool" && source !== "system";
    }
    return USER_EVENTS.has(event);
}
function isWorkRecord(record) {
    if (hasAnyKey(record, TOOL_RECORD_KEYS)) {
        return true;
    }
    const type = lowerString(record.type);
    const event = lowerString(record.event);
    const kind = lowerString(record.kind);
    const toolName = lowerString(record.tool_name ?? record.toolName);
    if (type.includes("tool") || event.includes("tool") || kind.includes("tool")) {
        return true;
    }
    if (TOOL_NAME_MARKERS.some((marker) => toolName.includes(marker))) {
        return true;
    }
    return containsToolUse(record.content) || containsToolUse(record.message);
}
function isMainframeShareRecord(record) {
    return (hasMainframeToolName(record, false) ||
        hasMainframeToolPayload(record, 0) ||
        hasMainframeOutput(record));
}
function parseJsonl(text) {
    const parsedRecords = [];
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (isJsonRecord(parsed)) {
                parsedRecords.push({ record: parsed, timestampMs: extractTimestampMs(parsed) });
            }
        }
        catch {
            continue;
        }
    }
    return parsedRecords;
}
function findLastRealUserIndex(records) {
    for (let index = records.length - 1; index >= 0; index -= 1) {
        if (isRealUserRecord(records[index].record)) {
            return index;
        }
    }
    return -1;
}
function lowerString(value) {
    return typeof value === "string" ? value.toLowerCase() : "";
}
function normalizeEpochMs(value) {
    return value < SECONDS_TIMESTAMP_CUTOFF ? Math.round(value * 1000) : Math.round(value);
}
function hasAnyKey(record, keys) {
    return keys.some((key) => key in record);
}
function containsToolUse(value) {
    if (Array.isArray(value)) {
        return value.some((entry) => containsToolUse(entry));
    }
    if (isJsonRecord(value)) {
        return isToolUseLikeRecord(value) || containsToolUse(value.content);
    }
    return false;
}
function containsToolResult(value) {
    if (Array.isArray(value)) {
        return value.some((entry) => containsToolResult(entry));
    }
    if (isJsonRecord(value)) {
        return isToolResultLikeRecord(value) || containsToolResult(value.content);
    }
    return false;
}
function isToolUseLikeRecord(record) {
    const type = lowerString(record.type);
    const name = lowerString(record.name);
    return (type.includes("tool") || name.includes("tool") || name === "bash" || name === "apply_patch");
}
function isToolResultLikeRecord(record) {
    const type = lowerString(record.type);
    return type.includes("tool") && type.includes("result");
}
function hasMainframeToolPayload(record, depth) {
    if (depth >= MAX_TOOL_PAYLOAD_DEPTH) {
        return false;
    }
    return TOOL_RECORD_KEYS.some((key) => {
        const value = record[key];
        if (Array.isArray(value)) {
            return value.some((entry) => isJsonRecord(entry) && hasMainframeToolEvidence(entry, depth + 1));
        }
        return isJsonRecord(value) && hasMainframeToolEvidence(value, depth + 1);
    });
}
function hasMainframeToolEvidence(record, depth) {
    return (hasMainframeToolName(record, true) ||
        hasMainframeToolPayload(record, depth) ||
        hasMainframeOutput(record));
}
function hasMainframeToolName(record, includeGenericName) {
    const name = lowerString(includeGenericName
        ? (record.tool_name ?? record.toolName ?? record.name)
        : (record.tool_name ?? record.toolName));
    return MAINFRAME_TOOL_NAMES.has(name);
}
function hasMainframeOutput(record) {
    return TOOL_OUTPUT_KEYS.some((key) => hasMainframeWatchUrl(record[key]));
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
            if (TOOL_OUTPUT_KEYS.includes(key)) {
                return hasMainframeWatchUrl(entry);
            }
            return false;
        });
    }
    return false;
}
