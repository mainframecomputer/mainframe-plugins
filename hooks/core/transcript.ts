import { lstatSync, readFileSync } from "node:fs";

import { isJsonRecord } from "./json.js";

const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;
const MIN_EPOCH_SECONDS = 946_684_800;
const MAX_EPOCH_SECONDS = 4_102_444_800;
const MIN_EPOCH_MS = MIN_EPOCH_SECONDS * 1000;
const MAX_EPOCH_MS = MAX_EPOCH_SECONDS * 1000;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAINFRAME_VIDEO_URL_PREFIX = "https://mainframe.app/v/";

export type TranscriptSummary =
  | { kind: "unreadable" }
  | { kind: "no-user" }
  | { kind: "missing-user-time" }
  | {
      kind: "ready";
      lastUserTimeMs: number;
      workHappened: boolean;
      alreadyShared: boolean;
    };

export type ParsedTranscript = {
  sawUser: boolean;
  lastUserTimeMs: number | null;
  workHappened: boolean;
  alreadyShared: boolean;
};

// A host adds support by supplying one of these: it turns transcript text into
// a `ParsedTranscript`, or fails closed with "unreadable". The shared file
// reading, size guarding, and summary shaping below are host-agnostic.
export type TranscriptRowParser = (text: string) => ParsedTranscript | "unreadable";

export function summarizeTranscriptFile(
  path: string,
  parseRows: TranscriptRowParser,
): TranscriptSummary {
  const text = readTranscriptText(path);
  if (text === null) {
    return { kind: "unreadable" };
  }

  return summarizeTranscript(text, parseRows);
}

export function summarizeTranscript(
  text: string,
  parseRows: TranscriptRowParser,
): TranscriptSummary {
  const parsed = parseRows(text);
  if (parsed === "unreadable") {
    return { kind: "unreadable" };
  }

  if (!parsed.sawUser) {
    return { kind: "no-user" };
  }

  if (parsed.lastUserTimeMs === null) {
    return { kind: "missing-user-time" };
  }

  return {
    kind: "ready",
    lastUserTimeMs: parsed.lastUserTimeMs,
    workHappened: parsed.workHappened,
    alreadyShared: parsed.alreadyShared,
  };
}

function readTranscriptText(path: string): string | null {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.size > MAX_TRANSCRIPT_BYTES) {
      return null;
    }

    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function parseTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeEpochMs(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return null;
    }

    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      return normalizeEpochMs(Number(trimmed));
    }

    if (!ISO_TIMESTAMP_PATTERN.test(trimmed)) {
      return null;
    }

    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed) && parsed >= MIN_EPOCH_MS && parsed <= MAX_EPOCH_MS) {
      return parsed;
    }
  }

  return null;
}

export function hasMainframeVideoUrl(value: unknown): boolean {
  if (typeof value === "string") {
    return value.includes(MAINFRAME_VIDEO_URL_PREFIX);
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasMainframeVideoUrl(entry));
  }

  if (isJsonRecord(value)) {
    return Object.values(value).some((entry) => hasMainframeVideoUrl(entry));
  }

  return false;
}

function normalizeEpochMs(value: number): number | null {
  if (value >= MIN_EPOCH_SECONDS && value <= MAX_EPOCH_SECONDS) {
    return Math.round(value * 1000);
  }

  if (value >= MIN_EPOCH_MS && value <= MAX_EPOCH_MS) {
    return Math.round(value);
  }

  return null;
}
