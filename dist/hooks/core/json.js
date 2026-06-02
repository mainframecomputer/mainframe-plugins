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
//# sourceMappingURL=json.js.map