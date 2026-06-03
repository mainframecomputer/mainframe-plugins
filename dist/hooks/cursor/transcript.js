import { hasMainframeVideoUrl, isNonEmptyString, nextUserTimeMs, parseTimestampMs, summarizeTranscript, summarizeTranscriptFile, } from "../core/transcript.js";
import { parseJsonlRecords } from "../core/json.js";
export function summarizeCursorTranscriptFile(path) {
    return summarizeTranscriptFile(path, parseCursorRows);
}
export function summarizeCursorTranscript(text) {
    return summarizeTranscript(text, parseCursorRows);
}
function parseCursorRows(text) {
    const records = parseJsonlRecords(text);
    if (records === "unreadable") {
        return "unreadable";
    }
    let sawUser = false;
    let lastUserTimeMs = null;
    let workHappened = false;
    let alreadyShared = false;
    let previousUserTimeMs = null;
    for (const record of records) {
        const row = parseCursorTranscriptRow(record);
        if (row === null) {
            return "unreadable";
        }
        if (row.event === "user_message") {
            const userTimeMs = nextUserTimeMs(row.timestamp, previousUserTimeMs);
            if (userTimeMs === "unreadable") {
                return "unreadable";
            }
            sawUser = true;
            lastUserTimeMs = userTimeMs;
            if (userTimeMs !== null) {
                previousUserTimeMs = userTimeMs;
            }
            workHappened = false;
            alreadyShared = false;
            continue;
        }
        if (sawUser) {
            const workTimeMs = readToolWorkTimeMs(row, lastUserTimeMs);
            if (workTimeMs === "unreadable") {
                return "unreadable";
            }
            workHappened = workHappened || workTimeMs !== null;
            alreadyShared = alreadyShared || hasMainframeVideoUrl(record);
        }
    }
    return { sawUser, lastUserTimeMs, workHappened, alreadyShared };
}
function parseCursorTranscriptRow(record) {
    if (record.event === "user_message" && isNonEmptyString(record.text)) {
        return { event: record.event, timestamp: record.timestamp };
    }
    if (record.event === "tool_call" && typeof record.name === "string") {
        return { event: record.event, timestamp: record.timestamp };
    }
    if (record.event === "assistant_message") {
        return { event: record.event };
    }
    if (record.event === "tool_result") {
        return { event: record.event };
    }
    return null;
}
function readToolWorkTimeMs(row, lastUserTimeMs) {
    if (row.event !== "tool_call") {
        return null;
    }
    const toolTimeMs = parseTimestampMs(row.timestamp);
    if (toolTimeMs === null) {
        return "unreadable";
    }
    if (lastUserTimeMs !== null && toolTimeMs < lastUserTimeMs) {
        return "unreadable";
    }
    return toolTimeMs;
}
