import { isJsonRecord, parseJsonlRecords } from "../core/json.js";
import { hasMainframeVideoUrl, isNonEmptyString, nextUserTimeMs, summarizeTranscript, summarizeTranscriptFile, } from "../core/transcript.js";
export function summarizeClaudeTranscriptFile(path) {
    return summarizeTranscriptFile(path, parseClaudeRows);
}
export function summarizeClaudeTranscript(text) {
    return summarizeTranscript(text, parseClaudeRows);
}
// Claude Code transcripts are append-only JSONL where each line is a typed
// entry. A real user turn is `{ type: "user", message: { content } }` carrying
// human text; tool results reuse the same `user` type but carry `tool_result`
// blocks, so they must not reset the AFK timer. Assistant `tool_use` blocks
// count as work. Unrelated entry types (system, summary, ...) are ignored, but
// a transcript with no recognizable Claude message entry fails closed as
// "unreadable" so the hook never fires on a foreign or empty format.
function parseClaudeRows(text) {
    const records = parseJsonlRecords(text);
    if (records === "unreadable") {
        return "unreadable";
    }
    let sawClaudeEntry = false;
    let sawUser = false;
    let lastUserTimeMs = null;
    let workHappened = false;
    let alreadyShared = false;
    let previousUserTimeMs = null;
    for (const record of records) {
        const kind = classifyClaudeRow(record);
        if (kind !== "foreign") {
            sawClaudeEntry = true;
        }
        if (kind === "user") {
            const userTimeMs = nextUserTimeMs(record.timestamp, previousUserTimeMs);
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
            workHappened = workHappened || kind === "work";
            alreadyShared = alreadyShared || hasMainframeVideoUrl(record);
        }
    }
    if (!sawClaudeEntry) {
        return "unreadable";
    }
    return { sawUser, lastUserTimeMs, workHappened, alreadyShared };
}
function classifyClaudeRow(record) {
    if (record.type !== "user" && record.type !== "assistant") {
        return "foreign";
    }
    const message = record.message;
    if (!isJsonRecord(message)) {
        return "foreign";
    }
    if (record.type === "assistant") {
        return hasToolUseBlock(message.content) ? "work" : "claude-other";
    }
    return isRealUserMessage(message) ? "user" : "claude-other";
}
// A real user turn carries human text: either a plain string or content blocks
// that include a non-empty `text` block. Tool-result turns reuse the `user`
// type but carry `tool_result` blocks instead of prompt text, so they are
// excluded to keep the AFK timer anchored to genuine user activity.
function isRealUserMessage(message) {
    const content = message.content;
    if (isNonEmptyString(content)) {
        return true;
    }
    if (!Array.isArray(content)) {
        return false;
    }
    if (content.some(isToolResultBlock)) {
        return false;
    }
    return content.some(isNonEmptyTextBlock);
}
function hasToolUseBlock(content) {
    return Array.isArray(content) && content.some(isToolUseBlock);
}
function isToolUseBlock(block) {
    return isJsonRecord(block) && block.type === "tool_use";
}
function isToolResultBlock(block) {
    return isJsonRecord(block) && block.type === "tool_result";
}
function isNonEmptyTextBlock(block) {
    return isJsonRecord(block) && block.type === "text" && isNonEmptyString(block.text);
}
