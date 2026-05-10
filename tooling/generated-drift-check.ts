import { readFileSync, readlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";

const generatedPaths = [
  ".cursor-plugin/plugin.json",
  ".cursor-plugin/marketplace.json",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".codex-plugin/plugin.json",
  ".agents/plugins/marketplace.json",
  ".agents/skills/share-video",
  "openclaw.plugin.json",
  "package.json",
];

const before = new Map(generatedPaths.map((path) => [path, readGeneratedPath(path)]));
const result = spawnSync("bun", ["run", "generate"], { stdio: "inherit" });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const drifted = generatedPaths.filter((path) => before.get(path) !== readGeneratedPath(path));
if (drifted.length > 0) {
  console.error(["Generated files are out of date:", ...drifted].join("\n"));
  process.exit(1);
}

function readGeneratedPath(path: string): string {
  if (path === ".agents/skills/share-video") {
    return `symlink:${readlinkSync(path)}`;
  }

  return readFileSync(path, "utf8");
}
