import {
  mkdirSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
  lstatSync,
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
  screenshots: [
    "assets/screenshots/cursor-mainframe.png",
    "assets/screenshots/claude-mainframe.png",
    "assets/screenshots/codex-mainframe.png",
    "assets/screenshots/devin-terminal-mainframe.png",
    "assets/screenshots/openclaw-mainframe.png",
  ],
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

  writeJson(".claude-plugin/plugin.json", {
    ...sharedManifest,
    host: "claude-code",
    hooks: "./hooks/claude/hooks.json",
  });

  writeJson(".codex-plugin/plugin.json", {
    ...sharedManifest,
    host: "codex",
    hooks: "./hooks/codex/hooks.json",
  });

  writeJson("openclaw.plugin.json", {
    id: metadata.name,
    name: metadata.displayName,
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
    skills: [metadata.skillDirectory],
    activation: {
      onStartup: true,
    },
    configSchema: {
      type: "object",
      additionalProperties: false,
    },
    support,
    host: "openclaw",
    entrypoint: "./dist/hooks/openclaw/register.js",
    sourceEntrypoint: "./hooks/openclaw/register.ts",
    callbacks: ["agent_turn_prepare", "before_agent_finalize"],
  });

  writeJson(".cursor-plugin/marketplace.json", marketplace("cursor"));
  writeJson(".claude-plugin/marketplace.json", marketplace("claude-code"));
  writeJson(".agents/plugins/marketplace.json", marketplace("codex"));
  updatePackageJson();
  ensureSkillSymlink();
}

function marketplace(host: "cursor" | "claude-code" | "codex") {
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
    "Mainframe plugin manifests, skill, MCP wiring, and AFK video handoff hooks for coding-agent hosts.";
  packageJson.private = true;
  packageJson.license = metadata.license;
  packageJson.homepage = metadata.homepage;
  packageJson.repository = {
    type: "git",
    url: metadata.repository,
  };
  packageJson.keywords = metadata.keywords;
  packageJson.openclaw = {
    extensions: ["./hooks/openclaw/register.ts"],
    runtimeExtensions: ["./dist/hooks/openclaw/register.js"],
    compat: {
      pluginApi: ">=2026.5.7",
    },
    build: {
      openclawVersion: "2026.5.7",
      pluginSdkVersion: "2026.5.7",
    },
  };

  writeJson("package.json", packageJson);
}

function ensureSkillSymlink(): void {
  const linkPath = ".agents/skills/share-video";
  const target = "../../skills/share-video";

  mkdirSync(dirname(linkPath), { recursive: true });

  try {
    const stat = lstatSync(linkPath);
    if (stat.isSymbolicLink() && readlinkSync(linkPath) === target) {
      return;
    }
    throw new Error(`${linkPath} exists but does not point to ${target}`);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  symlinkSync(target, linkPath, "dir");
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

main();
