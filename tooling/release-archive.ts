import { mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { z } from "zod";

const PackageSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  files: z.array(z.string().min(1)).min(1),
});

const packageJson = PackageSchema.parse(JSON.parse(readFileSync("package.json", "utf8")));
const archiveName = `${packageJson.name.replace(/^@/, "").replace("/", "-")}-${packageJson.version}.tgz`;
const archivePath = `release/${archiveName}`;

const paths = ["package.json", ...packageJson.files];

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
