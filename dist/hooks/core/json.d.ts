import { z } from "zod";
export type JsonObject = Record<string, unknown>;
export declare const jsonObjectSchema: z.ZodType<JsonObject>;
export declare function isJsonObject(value: unknown): value is JsonObject;
export declare function parseJsonObject(text: string): JsonObject | null;
