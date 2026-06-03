import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { z } from "zod";
import { PACKAGE_FILES } from "./package-surface.js";

const JsonRecordSchema = z.record(z.string(), z.unknown());

const MetadataSchema = z.object({
  name: z.string().min(1),
  packageName: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().min(1),
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

const metadata = MetadataSchema.parse({
  name: "mainframe",
  packageName: "@mainframe/plugins",
  version: "0.1.0",
  description: "Create and share short Mainframe video updates from coding-agent work.",
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
  logo: metadata.logo,
  skills: metadata.skillDirectory,
  mcpServers: metadata.mcpServers,
};

function main(): void {
  writeJson(".cursor-plugin/plugin.json", {
    ...sharedManifest,
    hooks: "./hooks/cursor/hooks.json",
  });

  writeJson(".cursor-plugin/marketplace.json", marketplace());
  updatePackageJson();
}

function marketplace() {
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

function updatePackageJson(): void {
  const packageJson = JsonRecordSchema.parse(JSON.parse(readFileSync("package.json", "utf8")));
  packageJson.name = metadata.packageName;
  packageJson.version = metadata.version;
  packageJson.description = "Mainframe Cursor plugin manifest, skill, MCP wiring, and stop hook.";
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
  packageJson.files = PACKAGE_FILES;

  writeJson("package.json", packageJson);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

main();
