export type JsonObject = Record<string, unknown>;
export declare function isJsonObject(value: unknown): value is JsonObject;
export declare function parseJsonObject(text: string): JsonObject | null;
