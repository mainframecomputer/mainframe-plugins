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

const SharedManifestSchema = z.object({
  displayName: z.literal("Mainframe"),
  version: z.literal("0.1.0"),
  description: z.literal("Create and share short Mainframe video updates from coding-agent work."),
  author: AuthorSchema,
  homepage: z.literal("https://mainframe.app"),
  repository: RepositorySchema,
  license: z.literal("UNLICENSED"),
  category: z.literal("productivity"),
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
  logo: z.literal("assets/logo.png"),
});

const ManifestSchema = SharedManifestSchema.extend({
  name: z.literal("mainframe"),
  skills: z.literal("./skills"),
  mcpServers: z.literal("./.mcp.json"),
  hooks: z.literal("./hooks/cursor/hooks.json"),
}).strict();

const manifestPaths = [".cursor-plugin/plugin.json"];

describe("generated plugin manifests", () => {
  it.each(manifestPaths)("%s matches the Cursor plugin schema subset", (path) => {
    const manifest = ManifestSchema.parse(JSON.parse(readFileSync(path, "utf8")));

    expect(manifest.license).toBe("UNLICENSED");
  });

  it("marketplace metadata matches the Cursor marketplace schema subset", () => {
    const marketplaceSchema = z
      .object({
        name: z.literal("mainframe"),
        owner: AuthorSchema,
        metadata: z
          .object({
            description: z.literal(
              "Create and share short Mainframe video updates from coding-agent work.",
            ),
          })
          .strict(),
        plugins: z.tuple([
          z
            .object({
              name: z.literal("mainframe"),
              source: z.literal("."),
              description: z.literal(
                "Create and share short Mainframe video updates from coding-agent work.",
              ),
            })
            .strict(),
        ]),
      })
      .strict();

    marketplaceSchema.parse(JSON.parse(readFileSync(".cursor-plugin/marketplace.json", "utf8")));
  });
});
