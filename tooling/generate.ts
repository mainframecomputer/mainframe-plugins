import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { z } from "zod";
import { PACKAGE_FILES } from "./package-surface.js";

const JsonRecordSchema = z.record(z.string(), z.unknown());

const MetadataSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  packageName: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(1),
  longDescription: z.string().min(1),
  category: z.string().min(1),
  author: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  homepage: z.string().url(),
  repository: z.string().url(),
  license: z.literal("UNLICENSED"),
  keywords: z.array(z.string().min(1)).min(1),
  logo: z.string().min(1),
  mcpServers: z.string().min(1),
  skillDirectory: z.string().min(1),
});

const CURSOR_HOOKS = "./hooks/cursor/hooks.json";
const CODEX_HOOKS = "./hooks/codex/hooks.json";
const CLAUDE_HOOKS = "./hooks/claude/hooks.json";

const metadata = MetadataSchema.parse({
  name: "mainframe",
  displayName: "Mainframe",
  packageName: "@mainframe/plugins",
  version: "0.1.0",
  description: "Create and share short video updates from agent work.",
  longDescription:
    "Watch what your agents did instead of reading through all of it. Each task wraps up with a short narrated video in your own voice and company branding, so you stay up to date at a glance and can share it with your team.",
  category: "Productivity",
  author: {
    name: "Mainframe",
    email: "support@mainframe.app",
  },
  homepage: "https://mainframe.app",
  repository: "https://github.com/mainframecomputer/mainframe-plugins.git",
  license: "UNLICENSED",
  keywords: ["mainframe", "agent-skills", "mcp", "hooks", "video"],
  logo: "assets/logo.png",
  mcpServers: "./.mcp.json",
  skillDirectory: "./skills",
});

const sharedManifest = {
  name: metadata.name,
  version: metadata.version,
  description: metadata.description,
  author: metadata.author,
  homepage: metadata.homepage,
  repository: metadata.repository,
  license: metadata.license,
  keywords: metadata.keywords,
};

function main(): void {
  writeJson(".cursor-plugin/plugin.json", {
    ...sharedManifest,
    logo: metadata.logo,
    skills: metadata.skillDirectory,
    mcpServers: metadata.mcpServers,
    hooks: CURSOR_HOOKS,
  });
  writeJson(".cursor-plugin/marketplace.json", cursorMarketplace());

  writeJson(".codex-plugin/plugin.json", codexManifest());
  writeJson(".agents/plugins/marketplace.json", codexMarketplace());

  writeJson(".claude-plugin/plugin.json", claudeManifest());
  writeJson(".claude-plugin/marketplace.json", claudeMarketplace());

  updatePackageJson();
}

function cursorMarketplace() {
  return {
    name: metadata.name,
    owner: metadata.author,
    metadata: {
      description: metadata.description,
    },
    plugins: [
      {
        name: metadata.name,
        source: ".",
        description: metadata.description,
      },
    ],
  };
}

function codexManifest() {
  return {
    ...sharedManifest,
    skills: metadata.skillDirectory,
    mcpServers: metadata.mcpServers,
    hooks: CODEX_HOOKS,
    interface: {
      displayName: metadata.displayName,
      shortDescription: metadata.description,
      longDescription: metadata.longDescription,
      developerName: metadata.author.name,
      category: metadata.category,
      logo: `./${metadata.logo}`,
    },
  };
}

// Codex resolves a marketplace's local plugin sources from a subdirectory, so we
// point the entry at the repository root through a Git URL source. That keeps the
// Codex plugin rooted alongside the Cursor plugin and sharing the same skill,
// MCP wiring, and hook runtime instead of duplicating them into a subfolder.
function codexMarketplace() {
  return {
    name: metadata.name,
    interface: {
      displayName: metadata.displayName,
    },
    plugins: [
      {
        name: metadata.name,
        source: {
          source: "url",
          url: metadata.repository,
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL",
        },
        category: metadata.category,
      },
    ],
  };
}

function claudeManifest() {
  return {
    ...sharedManifest,
    skills: metadata.skillDirectory,
    mcpServers: metadata.mcpServers,
    hooks: CLAUDE_HOOKS,
  };
}

// Claude Code loads the plugin in place from the repository root, where its
// `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json` live side
// by side. The relative `"./"` source points at that root so the Claude plugin
// shares the same skill, MCP wiring, and hook runtime as the other hosts.
function claudeMarketplace() {
  return {
    name: metadata.name,
    owner: metadata.author,
    plugins: [
      {
        name: metadata.name,
        source: "./",
        description: metadata.description,
      },
    ],
  };
}

function updatePackageJson(): void {
  const packageJson = JsonRecordSchema.parse(JSON.parse(readFileSync("package.json", "utf8")));
  packageJson.name = metadata.packageName;
  packageJson.version = metadata.version;
  packageJson.description =
    "Mainframe Cursor, Codex, and Claude Code plugin manifests, skill, MCP wiring, and stop hooks.";
  packageJson.private = true;
  packageJson.license = metadata.license;
  packageJson.homepage = metadata.homepage;
  packageJson.repository = {
    type: "git",
    url: metadata.repository,
  };
  packageJson.keywords = metadata.keywords;
  packageJson.bin = {
    "mainframe-hook-cursor": "./dist/hooks/cursor/stop.js",
    "mainframe-hook-codex": "./dist/hooks/codex/stop.js",
    "mainframe-hook-claude": "./dist/hooks/claude/stop.js",
  };
  packageJson.files = PACKAGE_FILES;

  writeJson("package.json", packageJson);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

main();
