import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { z } from "zod";

const PackageSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  files: z.array(z.string().min(1)).min(1),
});

const PluginManifestSchema = z.object({
  hooks: z.string().min(1),
  logo: z.string().min(1),
  mcpServers: z.string().min(1),
  skills: z.string().min(1),
});

const packageJson = PackageSchema.parse(JSON.parse(readFileSync("package.json", "utf8")));
const pluginManifest = PluginManifestSchema.parse(
  JSON.parse(readFileSync(".cursor-plugin/plugin.json", "utf8")),
);
const archiveName = `${packageJson.name.replace(/^@/, "").replace("/", "-")}-${packageJson.version}.tgz`;
const archivePath = `release/${archiveName}`;

const paths = ["package.json", ...packageJson.files];
const manifestPaths = [
  pluginManifest.hooks,
  pluginManifest.logo,
  pluginManifest.mcpServers,
  pluginManifest.skills,
].map((path) => path.replace(/^\.\//, ""));

for (const path of manifestPaths) {
  if (!existsSync(path)) {
    throw new Error(`Manifest path does not exist: ${path}`);
  }
  if (!isPackaged(path, packageJson.files)) {
    throw new Error(`Manifest path is not included in package files: ${path}`);
  }
}

mkdirSync("release", { recursive: true });

const result = spawnSync(
  "tar",
  ["-czhf", archivePath, "--exclude", ".DS_Store", "--exclude", "*/.DS_Store", ...paths],
  { stdio: "inherit" },
);
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(archivePath);

function isPackaged(path: string, packageFiles: readonly string[]): boolean {
  return packageFiles.some((entry) => path === entry || path.startsWith(`${entry}/`));
}
