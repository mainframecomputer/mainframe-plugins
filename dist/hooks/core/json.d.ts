export type JsonRecord = Record<string, unknown>;
export declare function isJsonRecord(value: unknown): value is JsonRecord;
export declare function parseJsonRecord(text: string): JsonRecord | null;
