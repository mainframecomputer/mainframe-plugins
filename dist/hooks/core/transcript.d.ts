import { type JsonRecord } from "./json.js";
export type TranscriptSummary = {
    kind: "unreadable";
} | {
    kind: "no-user";
} | {
    kind: "missing-user-time";
} | {
    kind: "ready";
    lastUserTimeMs: number;
    workHappened: boolean;
    alreadyShared: boolean;
};
export declare function summarizeTranscriptFile(path: string): TranscriptSummary;
export declare function summarizeTranscript(text: string): TranscriptSummary;
export declare function parseTimestampMs(value: unknown): number | null;
export declare function extractTimestampMs(record: JsonRecord): number | null;
export declare function isRealUserRecord(record: JsonRecord): boolean;
export declare function isWorkRecord(record: JsonRecord): boolean;
export declare function isMainframeShareRecord(record: JsonRecord): boolean;
