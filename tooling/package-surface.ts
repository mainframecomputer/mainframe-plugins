import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const PACKAGE_FILES = [
  ".agents",
  ".claude-plugin",
  ".codex-plugin",
  ".cursor-plugin",
  ".hermes-plugin",
  ".mcp.json",
  "LICENSE",
  "README.md",
  "assets/logo.png",
  "dist",
  "hooks/claude/hooks.json",
  "hooks/codex/hooks.json",
  "hooks/cursor/hooks.json",
  "skills",
];

export const SHIPPED_FILES = [
  ".agents/plugins/marketplace.json",
  ".claude-plugin/marketplace.json",
  ".claude-plugin/plugin.json",
  ".codex-plugin/plugin.json",
  ".cursor-plugin/marketplace.json",
  ".cursor-plugin/plugin.json",
  ".hermes-plugin/config.yaml",
  ".mcp.json",
  "LICENSE",
  "README.md",
  "assets/logo.png",
  "dist/hooks/claude/stop-evaluator.js",
  "dist/hooks/claude/stop.js",
  "dist/hooks/claude/transcript.js",
  "dist/hooks/codex/stop-evaluator.js",
  "dist/hooks/codex/stop.js",
  "dist/hooks/codex/transcript.js",
  "dist/hooks/core/afk-gate.js",
  "dist/hooks/core/json.js",
  "dist/hooks/core/run-stop-hook.js",
  "dist/hooks/core/stop-hook.js",
  "dist/hooks/core/stop-policy.js",
  "dist/hooks/core/transcript.js",
  "dist/hooks/cursor/stop-evaluator.js",
  "dist/hooks/cursor/stop.js",
  "dist/hooks/cursor/transcript.js",
  "hooks/claude/hooks.json",
  "hooks/codex/hooks.json",
  "hooks/cursor/hooks.json",
  "skills/share-video/SKILL.md",
];

export function readPackageFiles(path: string): string[] {
  const stat = lstatSync(path);
  if (!stat.isDirectory()) {
    return [path];
  }

  return readdirSync(path).flatMap((entry) => readPackageFiles(join(path, entry)));
}

export function assertPluginPackageSurface(packageFiles: readonly string[]): void {
  assertSameItems("Package files differ from the plugin allowlist", packageFiles, PACKAGE_FILES);

  const shippedFiles = packageFiles.flatMap(readPackageFiles);
  assertSameItems("Shipped files differ from the plugin allowlist", shippedFiles, SHIPPED_FILES);
}

function assertSameItems(
  message: string,
  actual: readonly string[],
  expected: readonly string[],
): void {
  if (actual.length !== expected.length) {
    throw new Error(`${message}: expected ${expected.length} files, got ${actual.length}`);
  }

  const actualSet = new Set(actual);
  for (const path of expected) {
    if (!actualSet.has(path)) {
      throw new Error(`${message}: missing ${path}`);
    }
  }

  const expectedSet = new Set(expected);
  for (const path of actual) {
    if (!expectedSet.has(path)) {
      throw new Error(`${message}: unexpected ${path}`);
    }
  }
}
