import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const AuthorSchema = z
  .object({
    name: z.literal("Mainframe"),
    email: z.literal("support@mainframe.app"),
  })
  .strict();

const RepositorySchema = z.literal("https://github.com/mainframecomputer/mainframe-plugins.git");

const DescriptionSchema = z.literal("Create and share short video updates from agent work.");

const LongDescriptionSchema = z.literal(
  "Watch what your agents did instead of reading through all of it. Each task wraps up with a short narrated video in your own voice and company branding, so you stay up to date at a glance and can share it with your team.",
);

const KeywordsSchema = z.tuple([
  z.literal("mainframe"),
  z.literal("agent-skills"),
  z.literal("mcp"),
  z.literal("hooks"),
  z.literal("video"),
]);

const SharedManifestSchema = z.object({
  name: z.literal("mainframe"),
  version: z.literal("0.1.0"),
  description: DescriptionSchema,
  author: AuthorSchema,
  homepage: z.literal("https://mainframe.app"),
  repository: RepositorySchema,
  license: z.literal("UNLICENSED"),
  keywords: KeywordsSchema,
  skills: z.literal("./skills"),
  mcpServers: z.literal("./.mcp.json"),
});

const CursorManifestSchema = SharedManifestSchema.extend({
  logo: z.literal("assets/logo.png"),
  hooks: z.literal("./hooks/cursor/hooks.json"),
}).strict();

const CodexManifestSchema = SharedManifestSchema.extend({
  hooks: z.literal("./hooks/codex/hooks.json"),
  interface: z
    .object({
      displayName: z.literal("Mainframe"),
      shortDescription: DescriptionSchema,
      longDescription: LongDescriptionSchema,
      developerName: z.literal("Mainframe"),
      category: z.literal("Productivity"),
      logo: z.literal("./assets/logo.png"),
    })
    .strict(),
}).strict();

const ClaudeManifestSchema = SharedManifestSchema.extend({
  hooks: z.literal("./hooks/claude/hooks.json"),
}).strict();

describe("generated plugin manifests", () => {
  it(".cursor-plugin/plugin.json matches the Cursor plugin schema", () => {
    const manifest = CursorManifestSchema.parse(
      JSON.parse(readFileSync(".cursor-plugin/plugin.json", "utf8")),
    );

    expect(manifest.license).toBe("UNLICENSED");
  });

  it(".codex-plugin/plugin.json matches the Codex plugin schema", () => {
    const manifest = CodexManifestSchema.parse(
      JSON.parse(readFileSync(".codex-plugin/plugin.json", "utf8")),
    );

    expect(manifest.hooks).toBe("./hooks/codex/hooks.json");
  });

  it(".claude-plugin/plugin.json matches the Claude Code plugin schema", () => {
    const manifest = ClaudeManifestSchema.parse(
      JSON.parse(readFileSync(".claude-plugin/plugin.json", "utf8")),
    );

    expect(manifest.hooks).toBe("./hooks/claude/hooks.json");
  });

  it("Cursor marketplace metadata matches the Cursor marketplace schema", () => {
    const marketplaceSchema = z
      .object({
        name: z.literal("mainframe"),
        owner: AuthorSchema,
        metadata: z
          .object({
            description: DescriptionSchema,
          })
          .strict(),
        plugins: z.tuple([
          z
            .object({
              name: z.literal("mainframe"),
              source: z.literal("."),
              description: DescriptionSchema,
            })
            .strict(),
        ]),
      })
      .strict();

    marketplaceSchema.parse(JSON.parse(readFileSync(".cursor-plugin/marketplace.json", "utf8")));
  });

  it("Codex marketplace metadata matches the Codex marketplace schema", () => {
    const marketplaceSchema = z
      .object({
        name: z.literal("mainframe"),
        interface: z
          .object({
            displayName: z.literal("Mainframe"),
          })
          .strict(),
        plugins: z.tuple([
          z
            .object({
              name: z.literal("mainframe"),
              source: z
                .object({
                  source: z.literal("url"),
                  url: RepositorySchema,
                })
                .strict(),
              policy: z
                .object({
                  installation: z.literal("AVAILABLE"),
                  authentication: z.literal("ON_INSTALL"),
                })
                .strict(),
              category: z.literal("Productivity"),
            })
            .strict(),
        ]),
      })
      .strict();

    marketplaceSchema.parse(JSON.parse(readFileSync(".agents/plugins/marketplace.json", "utf8")));
  });

  it("Claude marketplace metadata matches the Claude marketplace schema", () => {
    const marketplaceSchema = z
      .object({
        name: z.literal("mainframe"),
        owner: AuthorSchema,
        plugins: z.tuple([
          z
            .object({
              name: z.literal("mainframe"),
              source: z.literal("./"),
              description: DescriptionSchema,
            })
            .strict(),
        ]),
      })
      .strict();

    marketplaceSchema.parse(JSON.parse(readFileSync(".claude-plugin/marketplace.json", "utf8")));
  });
});
