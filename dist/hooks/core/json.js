export function isJsonRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseJsonRecord(text) {
    try {
        const parsed = JSON.parse(text);
        return isJsonRecord(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
// Parse JSONL into records, failing closed: any non-JSON or non-object line
// yields "unreadable". This is the single chokepoint for turning an untrusted
// transcript into trusted rows; blank lines are skipped.
export function parseJsonlRecords(text) {
    const records = [];
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
        records.push(parsed);
    }
    return records;
}
