import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { jsonObjectSchema } from "../core/json.js";
import plugin, { registerMainframeHooks } from "./register.js";
import { createOpenClawHandlers, type OpenClawApi } from "./runtime.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const lifecycle = jsonObjectSchema.parse(
  JSON.parse(readFileSync(join(fixtureDir, "fixtures", "lifecycle.json"), "utf8")),
);

describe("OpenClaw plugin registration", () => {
  it("exports a definePluginEntry-compatible plugin", () => {
    expect(plugin).toMatchObject({
      id: "mainframe",
      name: "Mainframe",
      description: "Create and share short Mainframe video updates from coding-agent work.",
      configSchema: expect.objectContaining({
        jsonSchema: {
          type: "object",
          additionalProperties: false,
        },
      }),
    });
    expect(plugin.configSchema).toMatchObject({
      jsonSchema: {
        type: "object",
        additionalProperties: false,
      },
    });
    expect(typeof plugin.register).toBe("function");
  });

  it("returns a revise action when the user has been away after tool work", () => {
    const handlers = createOpenClawHandlers({
      env: {},
      nowMs: () => Date.parse("2026-05-08T13:00:00.000Z"),
    });
    handlers.beforeAgentRun(lifecycle.run);

    const output = handlers.beforeAgentFinalize(lifecycle.finalize);

    expect(output).toMatchObject({
      action: "revise",
      reason: expect.stringContaining("2.5 hours"),
    });
  });

  it("skips when disabled or when Mainframe was already shared", () => {
    const disabled = createOpenClawHandlers({ env: { MAINFRAME_HOOK: "0" } });
    disabled.beforeAgentRun({ timestamp: "2026-05-08T13:00:00.000Z" });
    expect(
      disabled.beforeAgentFinalize({ timestamp: "2026-05-08T15:30:00.000Z", type: "tool_use" }),
    ).toBeUndefined();

    const alreadyShared = createOpenClawHandlers({
      env: {},
      nowMs: () => Date.parse("2026-05-08T13:00:00.000Z"),
    });
    alreadyShared.beforeAgentRun(lifecycle.run);
    expect(alreadyShared.beforeAgentFinalize(lifecycle.alreadySharedFinalize)).toBeUndefined();
  });

  it("registers the current OpenClaw SDK callback names", () => {
    const names: string[] = [];
    const api: OpenClawApi = {
      on(eventName) {
        names.push(eventName);
      },
    };

    registerMainframeHooks(api);

    expect(names).toEqual(["agent_turn_prepare", "before_agent_finalize"]);
  });
});
