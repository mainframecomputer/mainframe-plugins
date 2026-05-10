import { evaluateAfkGate, thresholdMsFromEnv } from "../core/afk-gate.js";
import { isJsonObject, type JsonObject } from "../core/json.js";
import { extractTimestampMs, isMainframeShareRecord, isWorkRecord } from "../core/transcript.js";

export type OpenClawHookResult = { action: "revise"; reason: string } | undefined;

type OpenClawHookName = "agent_turn_prepare" | "before_agent_finalize";
type OpenClawHookHandlerMap = {
  agent_turn_prepare: (input: unknown) => undefined;
  before_agent_finalize: (input: unknown) => OpenClawHookResult;
};
type OpenClawState =
  | { kind: "idle" }
  | {
      kind: "tracking";
      lastUserTimeMs: number;
      workHappened: boolean;
      alreadyShared: boolean;
    };

export type OpenClawApi = {
  on<K extends OpenClawHookName>(eventName: K, handler: OpenClawHookHandlerMap[K]): void;
};

export type OpenClawOptions = {
  env?: NodeJS.ProcessEnv;
  nowMs?: () => number;
};

export type OpenClawHandlers = {
  beforeAgentRun: OpenClawHookHandlerMap["agent_turn_prepare"];
  beforeAgentFinalize: OpenClawHookHandlerMap["before_agent_finalize"];
};

export function createOpenClawHandlers(options: OpenClawOptions): OpenClawHandlers {
  let state: OpenClawState = { kind: "idle" };

  const nowMs = (): number => options.nowMs?.() ?? Date.now();

  return {
    beforeAgentRun(input: unknown): undefined {
      state = {
        kind: "tracking",
        lastUserTimeMs: extractTimestampFromUnknown(input) ?? nowMs(),
        workHappened: false,
        alreadyShared: false,
      };
      return undefined;
    },

    beforeAgentFinalize(input: unknown): OpenClawHookResult {
      const env = options.env ?? process.env;
      if (env.MAINFRAME_HOOK === "0" || state.kind === "idle") {
        return undefined;
      }

      const records = collectJsonObjects(input);
      state = {
        kind: "tracking",
        lastUserTimeMs: state.lastUserTimeMs,
        workHappened: state.workHappened || records.some(isWorkRecord),
        alreadyShared: state.alreadyShared || records.some(isMainframeShareRecord),
      };

      const gate = evaluateAfkGate({
        stopTimeMs: extractTimestampFromUnknown(input) ?? nowMs(),
        lastUserTimeMs: state.lastUserTimeMs,
        thresholdMs: thresholdMsFromEnv(env.MAINFRAME_HOOK_AFK_HOURS),
        workHappened: state.workHappened,
        alreadyShared: state.alreadyShared,
      });

      return gate.fire ? { action: "revise", reason: gate.reason } : undefined;
    },
  };
}

export function registerMainframeHooks(api: OpenClawApi): OpenClawHandlers {
  const handlers = createOpenClawHandlers({});
  // OpenClaw 2026.5.7 exposes the prompt-capture phase as agent_turn_prepare.
  api.on("agent_turn_prepare", handlers.beforeAgentRun);
  api.on("before_agent_finalize", handlers.beforeAgentFinalize);
  return handlers;
}

function extractTimestampFromUnknown(value: unknown): number | null {
  for (const record of collectJsonObjects(value)) {
    const timestampMs = extractTimestampMs(record);
    if (timestampMs !== null) {
      return timestampMs;
    }
  }

  return null;
}

function collectJsonObjects(value: unknown): JsonObject[] {
  const seen = new Set<object>();

  function collect(entry: unknown): JsonObject[] {
    if (Array.isArray(entry)) {
      return entry.flatMap(collect);
    }

    if (!isJsonObject(entry)) {
      return [];
    }

    if (seen.has(entry)) {
      return [];
    }
    seen.add(entry);

    return [entry, ...Object.values(entry).flatMap(collect)];
  }

  return collect(value);
}
