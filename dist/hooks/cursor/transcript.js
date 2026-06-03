import { hasMainframeVideoUrl, isNonEmptyString, parseTimestampMs, summarizeTranscript, summarizeTranscriptFile, } from "../core/transcript.js";
import { isJsonRecord } from "../core/json.js";
export function summarizeCursorTranscriptFile(path) {
    return summarizeTranscriptFile(path, parseCursorRows);
}
export function summarizeCursorTranscript(text) {
    return summarizeTranscript(text, parseCursorRows);
}
function parseCursorRows(text) {
    let sawUser = false;
    let lastUserTimeMs = null;
    let workHappened = false;
    let alreadyShared = false;
    let previousUserTimeMs = null;
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === "") {
            continue;
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (!isJsonRecord(parsed)) {
                return "unreadable";
            }
            const row = parseCursorTranscriptRow(parsed);
            if (row === null) {
                return "unreadable";
            }
            if (row.event === "user_message") {
                const userTimeMs = parseTimestampMs(row.timestamp);
                if (previousUserTimeMs !== null && userTimeMs !== null && userTimeMs < previousUserTimeMs) {
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
                alreadyShared = alreadyShared || hasMainframeVideoUrl(parsed);
            }
        }
        catch {
            return "unreadable";
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
