import { z } from "zod";

export type JsonObject = Record<string, unknown>;

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), z.unknown());

export function isJsonObject(value: unknown): value is JsonObject {
  return jsonObjectSchema.safeParse(value).success;
}

export function parseJsonObject(text: string): JsonObject | null {
  try {
    const parsed: unknown = JSON.parse(text);
    const result = jsonObjectSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
