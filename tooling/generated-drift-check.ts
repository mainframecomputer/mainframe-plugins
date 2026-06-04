import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const generatedPaths = [
  ".cursor-plugin/plugin.json",
  ".cursor-plugin/marketplace.json",
  ".codex-plugin/plugin.json",
  ".agents/plugins/marketplace.json",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  "package.json",
];

const before = new Map(generatedPaths.map((path) => [path, readGeneratedPath(path)]));
const result = spawnSync("bun", ["run", "generate"], { stdio: "inherit" });
let exitCode = 0;

if (result.status !== 0) {
  exitCode = result.status ?? 1;
} else {
  const drifted = generatedPaths.filter((path) => before.get(path) !== readGeneratedPath(path));
  if (drifted.length > 0) {
    console.error(["Generated files are out of date:", ...drifted].join("\n"));
    exitCode = 1;
  }
}

if (exitCode !== 0) {
  for (const [path, content] of before) {
    writeFileSync(path, content);
  }

  process.exit(exitCode);
}

function readGeneratedPath(path: string): string {
  return readFileSync(path, "utf8");
}
