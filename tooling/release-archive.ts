import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";

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
const tempRoot = mkdtempSync(join(tmpdir(), "mainframe-plugin-release-"));
const payloadDir = join(tempRoot, "payload");
const tempArchivePath = join(tempRoot, archiveName);
let tarExitCode = 0;

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
mkdirSync(payloadDir, { recursive: true });

try {
  for (const path of paths) {
    const destination = join(payloadDir, path);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(path, destination, {
      errorOnExist: false,
      filter: (source) => {
        if (basename(source) === ".DS_Store") {
          return false;
        }
        if (lstatSync(source).isSymbolicLink()) {
          throw new Error(`Package path must not be a symlink: ${source}`);
        }
        return true;
      },
      force: true,
      recursive: true,
    });
  }

  const result = spawnSync(
    "tar",
    ["-czf", tempArchivePath, "--exclude", ".DS_Store", "--exclude", "*/.DS_Store", ...paths],
    { cwd: payloadDir, stdio: "inherit" },
  );
  if (result.status !== 0) {
    tarExitCode = result.status ?? 1;
  } else {
    mkdirSync(dirname(archivePath), { recursive: true });
    renameSync(tempArchivePath, archivePath);
  }
} finally {
  rmSync(tempRoot, { force: true, recursive: true });
}

if (tarExitCode !== 0) {
  process.exit(tarExitCode);
}

console.log(archivePath);

function isPackaged(path: string, packageFiles: readonly string[]): boolean {
  return packageFiles.some((entry) => path === entry || path.startsWith(`${entry}/`));
}
