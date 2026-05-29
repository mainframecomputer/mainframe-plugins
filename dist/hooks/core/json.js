export function isJsonObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseJsonObject(text) {
    try {
        const parsed = JSON.parse(text);
        return isJsonObject(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=json.js.map