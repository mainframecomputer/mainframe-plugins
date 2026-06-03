export type JsonRecord = Record<string, unknown>;

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonRecord(text: string): JsonRecord | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isJsonRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Parse JSONL into records, failing closed: any non-JSON or non-object line
// yields "unreadable". This is the single chokepoint for turning an untrusted
// transcript into trusted rows; blank lines are skipped.
export function parseJsonlRecords(text: string): JsonRecord[] | "unreadable" {
  const records: JsonRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return "unreadable";
    }
    if (!isJsonRecord(parsed)) {
      return "unreadable";
    }

    records.push(parsed);
  }

  return records;
}
