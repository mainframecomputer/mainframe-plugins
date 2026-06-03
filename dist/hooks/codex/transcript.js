import { hasMainframeVideoUrl, isNonEmptyString, parseTimestampMs, readTranscriptText, summaryFromParsed, } from "../core/transcript.js";
import { isJsonRecord } from "../core/json.js";
export function summarizeCodexTranscriptFile(path) {
    const text = readTranscriptText(path);
    if (text === null) {
        return { kind: "unreadable" };
    }
    return summarizeCodexTranscript(text);
}
export function summarizeCodexTranscript(text) {
    const parsed = parseCodexRows(text);
    if (parsed === "unreadable") {
        return { kind: "unreadable" };
    }
    return summaryFromParsed(parsed);
}
// Codex rollout files are append-only JSONL where every line is
// `{ timestamp, type, payload }`. The format carries many event types that are
// irrelevant here, so unrecognized-but-valid rows are ignored. Structural
// corruption (non-JSON or non-object rows) and the absence of a `session_meta`
// row fail closed so the hook never fires on an untrusted transcript.
function parseCodexRows(text) {
    let sawSessionMeta = false;
    let sawUser = false;
    let lastUserTimeMs = null;
    let workHappened = false;
    let alreadyShared = false;
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === "") {
            continue;
        }
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        }
        catch {
            return "unreadable";
        }
        if (!isJsonRecord(parsed)) {
            return "unreadable";
        }
        const row = classifyCodexRow(parsed);
        if (row.kind === "session-meta") {
            sawSessionMeta = true;
            continue;
        }
        if (row.kind === "user") {
            sawUser = true;
            lastUserTimeMs = parseTimestampMs(parsed.timestamp);
            workHappened = false;
            alreadyShared = false;
            continue;
        }
        if (sawUser) {
            workHappened = workHappened || row.kind === "work";
            alreadyShared = alreadyShared || hasMainframeVideoUrl(parsed);
        }
    }
    if (!sawSessionMeta) {
        return "unreadable";
    }
    return { sawUser, lastUserTimeMs, workHappened, alreadyShared };
}
function classifyCodexRow(record) {
    if (record.type === "session_meta") {
        return { kind: "session-meta" };
    }
    const payload = record.payload;
    if (!isJsonRecord(payload)) {
        return { kind: "other" };
    }
    if (record.type === "event_msg" &&
        payload.type === "user_message" &&
        isNonEmptyString(payload.message)) {
        return { kind: "user" };
    }
    if (record.type === "response_item" && payload.type === "function_call") {
        return { kind: "work" };
    }
    return { kind: "other" };
}
