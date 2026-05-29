import { z } from "zod";
export const jsonObjectSchema = z.record(z.string(), z.unknown());
export function isJsonObject(value) {
    return jsonObjectSchema.safeParse(value).success;
}
export function parseJsonObject(text) {
    try {
        const parsed = JSON.parse(text);
        const result = jsonObjectSchema.safeParse(parsed);
        return result.success ? result.data : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=json.js.map