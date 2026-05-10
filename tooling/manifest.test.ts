import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const AuthorSchema = z
  .object({
    name: z.literal("Mainframe"),
    email: z.literal("support@mainframe.app"),
  })
  .strict();

const RepositorySchema = z
  .object({
    type: z.literal("git"),
    url: z.literal("https://github.com/mainframecomputer/mainframe-plugins.git"),
  })
  .strict();

const SupportSchema = z
  .object({
    mcp: z
      .object({
        server: z.literal("mainframe"),
        url: z.literal("https://mcp.mainframe.app/mcp"),
      })
      .strict(),
    skill: z
      .object({
        name: z.literal("share-video"),
        slashCommand: z.literal("/mainframe:share-video"),
        path: z.literal("skills/share-video/SKILL.md"),
      })
      .strict(),
    environment: z
      .object({
        MAINFRAME_HOOK: z.literal("Set to 0 to disable AFK stop-hook suggestions."),
        MAINFRAME_HOOK_AFK_HOURS: z.literal(
          "Hours away before a stop hook suggests a video. Defaults to 1.",
        ),
      })
      .strict(),
  })
  .strict();

const SharedManifestSchema = z.object({
  displayName: z.literal("Mainframe"),
  version: z.literal("0.1.0"),
  description: z.literal("Create and share short Mainframe video updates from coding-agent work."),
  longDescription: z.literal(
    "Mainframe adds a share-video skill, hosted MCP server wiring, and optional stop hooks that suggest a short video update after meaningful agent work when the user has been away.",
  ),
  developerName: z.literal("Mainframe"),
  author: AuthorSchema,
  homepage: z.literal("https://mainframe.app"),
  websiteURL: z.literal("https://mainframe.app"),
  repository: RepositorySchema,
  license: z.literal("UNLICENSED"),
  category: z.literal("productivity"),
  brandColor: z.literal("#20C7B7"),
  keywords: z.tuple([
    z.literal("mainframe"),
    z.literal("agent-skills"),
    z.literal("mcp"),
    z.literal("hooks"),
    z.literal("video"),
  ]),
  tags: z.tuple([
    z.literal("video"),
    z.literal("agent-work"),
    z.literal("handoff"),
    z.literal("mcp"),
    z.literal("hooks"),
  ]),
  capabilities: z.tuple([z.literal("skills"), z.literal("mcp"), z.literal("hooks")]),
  defaultPrompt: z.literal(
    "Use Mainframe when completed agent work would be easier to review as a short narrated or visual video update.",
  ),
  icon: z.literal("assets/icon.png"),
  logo: z.literal("assets/logo.png"),
  screenshots: z.tuple([
    z.literal("assets/screenshots/cursor-mainframe.png"),
    z.literal("assets/screenshots/claude-mainframe.png"),
    z.literal("assets/screenshots/codex-mainframe.png"),
    z.literal("assets/screenshots/devin-terminal-mainframe.png"),
    z.literal("assets/screenshots/openclaw-mainframe.png"),
  ]),
  privacyPolicyUrl: z.literal("https://mainframe.app/privacy"),
  privacyPolicyURL: z.literal("https://mainframe.app/privacy"),
  termsOfServiceUrl: z.literal("https://mainframe.app/terms"),
  termsOfServiceURL: z.literal("https://mainframe.app/terms"),
  support: SupportSchema,
});

function subprocessManifestSchema(host: "cursor" | "claude-code" | "codex", hooksPath: string) {
  return SharedManifestSchema.extend({
    schemaVersion: z.literal(1),
    name: z.literal("mainframe"),
    skills: z.literal("./skills"),
    mcpServers: z.literal("./.mcp.json"),
    host: z.literal(host),
    hooks: z.literal(hooksPath),
  }).strict();
}

const OpenClawManifestSchema = SharedManifestSchema.extend({
  id: z.literal("mainframe"),
  name: z.literal("Mainframe"),
  skills: z.tuple([z.literal("./skills")]),
  activation: z.object({ onStartup: z.literal(true) }).strict(),
  configSchema: z
    .object({
      type: z.literal("object"),
      additionalProperties: z.literal(false),
    })
    .strict(),
  host: z.literal("openclaw"),
  entrypoint: z.literal("./dist/hooks/openclaw/register.js"),
  sourceEntrypoint: z.literal("./hooks/openclaw/register.ts"),
  callbacks: z.tuple([z.literal("agent_turn_prepare"), z.literal("before_agent_finalize")]),
}).strict();

const ManifestSchema = z.discriminatedUnion("host", [
  subprocessManifestSchema("cursor", "./hooks/cursor/hooks.json"),
  subprocessManifestSchema("claude-code", "./hooks/claude/hooks.json"),
  subprocessManifestSchema("codex", "./hooks/codex/hooks.json"),
  OpenClawManifestSchema,
]);

const manifestPaths = [
  ".cursor-plugin/plugin.json",
  ".claude-plugin/plugin.json",
  ".codex-plugin/plugin.json",
  "openclaw.plugin.json",
];

describe("generated plugin manifests", () => {
  it.each(manifestPaths)("%s matches its host contract", (path) => {
    const manifest = ManifestSchema.parse(JSON.parse(readFileSync(path, "utf8")));

    expect(manifest.license).toBe("UNLICENSED");
  });
});
