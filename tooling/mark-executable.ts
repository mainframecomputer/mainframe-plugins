import { chmodSync } from "node:fs";

const files = [
  "dist/hooks/claude/stop.js",
  "dist/hooks/codex/stop.js",
  "dist/hooks/cursor/stop.js",
  "dist/hooks/devin-terminal/stop.js",
];

for (const file of files) {
  chmodSync(file, 0o755);
}
