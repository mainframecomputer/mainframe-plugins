import { chmodSync } from "node:fs";

const files = ["dist/hooks/cursor/stop.js"];

for (const file of files) {
  chmodSync(file, 0o755);
}
