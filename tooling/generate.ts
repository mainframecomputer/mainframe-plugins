import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

import { z } from "zod";

const JsonObjectSchema = z.record(z.string(), z.unknown());

const MetadataSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  packageName: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(1),
  longDescription: z.string().min(1),
  developerName: z.string().min(1),
  author: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  homepage: z.string().url(),
  websiteURL: z.string().url(),
  repository: z.string().url(),
  license: z.literal("UNLICENSED"),
  category: z.string().min(1),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  keywords: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string().min(1)).min(1),
  capabilities: z.array(z.enum(["skills", "mcp", "hooks"])).min(1),
  defaultPrompt: z.string().min(1),
  icon: z.string().min(1),
  logo: z.string().min(1),
  screenshots: z.array(z.string().min(1)).min(1),
  mcpServers: z.string().min(1),
  skillDirectory: z.string().min(1),
  privacyPolicyUrl: z.string().url(),
  termsOfServiceUrl: z.string().url(),
});

const metadata = MetadataSchema.parse({
  name: "mainframe",
  displayName: "Mainframe",
  packageName: "@mainframe/plugins",
  version: "0.1.0",
  description: "Create and share short Mainframe video updates from coding-agent work.",
  longDescription:
    "Mainframe adds a share-video skill, hosted MCP server wiring, and optional stop hooks that suggest a short video update after meaningful agent work when the user has been away.",
  developerName: "Mainframe",
  author: {
    name: "Mainframe",
    email: "support@mainframe.app",
  },
  homepage: "https://mainframe.app",
  websiteURL: "https://mainframe.app",
  repository: "https://github.com/mainframecomputer/mainframe-plugins.git",
  license: "UNLICENSED",
  category: "productivity",
  brandColor: "#20C7B7",
  keywords: ["mainframe", "agent-skills", "mcp", "hooks", "video"],
  tags: ["video", "agent-work", "handoff", "mcp", "hooks"],
  capabilities: ["skills", "mcp", "hooks"],
  defaultPrompt:
    "Use Mainframe when completed agent work would be easier to review as a short narrated or visual video update.",
  icon: "assets/icon.png",
  logo: "assets/logo.png",
  screenshots: ["assets/screenshots/cursor-mainframe.png"],
  mcpServers: "./.mcp.json",
  skillDirectory: "./skills",
  privacyPolicyUrl: "https://mainframe.app/privacy",
  termsOfServiceUrl: "https://mainframe.app/terms",
});

const support = {
  mcp: {
    server: "mainframe",
    url: "https://mcp.mainframe.app/mcp",
  },
  skill: {
    name: "share-video",
    slashCommand: "/mainframe:share-video",
    path: "skills/share-video/SKILL.md",
  },
  environment: {
    MAINFRAME_HOOK: "Set to 0 to disable AFK stop-hook suggestions.",
    MAINFRAME_HOOK_AFK_HOURS: "Hours away before a stop hook suggests a video. Defaults to 1.",
  },
};

const sharedManifest = {
  schemaVersion: 1,
  name: metadata.name,
  displayName: metadata.displayName,
  version: metadata.version,
  description: metadata.description,
  longDescription: metadata.longDescription,
  developerName: metadata.developerName,
  author: metadata.author,
  homepage: metadata.homepage,
  websiteURL: metadata.websiteURL,
  repository: {
    type: "git",
    url: metadata.repository,
  },
  license: metadata.license,
  category: metadata.category,
  brandColor: metadata.brandColor,
  keywords: metadata.keywords,
  tags: metadata.tags,
  capabilities: metadata.capabilities,
  defaultPrompt: metadata.defaultPrompt,
  icon: metadata.icon,
  logo: metadata.logo,
  screenshots: metadata.screenshots,
  privacyPolicyUrl: metadata.privacyPolicyUrl,
  privacyPolicyURL: metadata.privacyPolicyUrl,
  termsOfServiceUrl: metadata.termsOfServiceUrl,
  termsOfServiceURL: metadata.termsOfServiceUrl,
  skills: metadata.skillDirectory,
  mcpServers: metadata.mcpServers,
  support,
};

function main(): void {
  writeJson(".cursor-plugin/plugin.json", {
    ...sharedManifest,
    host: "cursor",
    hooks: "./hooks/cursor/hooks.json",
  });

  writeJson(".cursor-plugin/marketplace.json", marketplace("cursor"));
  updatePackageJson();
}

function marketplace(host: "cursor") {
  return {
    schemaVersion: 1,
    marketplace: host,
    owner: metadata.author,
    plugins: [
      {
        name: metadata.name,
        displayName: metadata.displayName,
        source: ".",
        version: metadata.version,
        description: metadata.description,
        longDescription: metadata.longDescription,
        developerName: metadata.developerName,
        author: metadata.author,
        homepage: metadata.homepage,
        websiteURL: metadata.websiteURL,
        repository: metadata.repository,
        license: metadata.license,
        category: metadata.category,
        brandColor: metadata.brandColor,
        tags: metadata.tags,
        capabilities: metadata.capabilities,
        defaultPrompt: metadata.defaultPrompt,
        icon: metadata.icon,
        logo: metadata.logo,
        screenshots: metadata.screenshots,
        privacyPolicyUrl: metadata.privacyPolicyUrl,
        privacyPolicyURL: metadata.privacyPolicyUrl,
        termsOfServiceUrl: metadata.termsOfServiceUrl,
        termsOfServiceURL: metadata.termsOfServiceUrl,
      },
    ],
  };
}

function updatePackageJson(): void {
  const packageJson = JsonObjectSchema.parse(JSON.parse(readFileSync("package.json", "utf8")));
  packageJson.name = metadata.packageName;
  packageJson.version = metadata.version;
  packageJson.description =
    "Mainframe Cursor plugin manifest, skill, MCP wiring, and AFK video handoff hook.";
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
  };
  packageJson.files = [
    ".cursor-plugin",
    ".mcp.json",
    "AGENTS.md",
    "LICENSE",
    "README.md",
    "assets/icon.png",
    "assets/logo.png",
    "assets/screenshots/cursor-mainframe.png",
    "dist",
    "hooks/core/afk-gate.ts",
    "hooks/core/json.ts",
    "hooks/core/subprocess.ts",
    "hooks/core/transcript.ts",
    "hooks/cursor/hooks.json",
    "hooks/cursor/stop.ts",
    "skills",
  ];

  writeJson("package.json", packageJson);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

main();
