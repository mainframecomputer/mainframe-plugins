import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const generatedPaths = [
  ".cursor-plugin/plugin.json",
  ".cursor-plugin/marketplace.json",
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
  return readFileSync(path, "utf8");
}
