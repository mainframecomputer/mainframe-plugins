import { chmodSync } from "node:fs";

const files = [
  "dist/hooks/cursor/stop.js",
  "dist/hooks/codex/stop.js",
  "dist/hooks/claude/stop.js",
];

for (const file of files) {
  chmodSync(file, 0o755);
}
