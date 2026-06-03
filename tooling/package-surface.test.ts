import { lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { PACKAGE_FILES, SHIPPED_FILES, readPackageFiles } from "./package-surface.js";

const PackageSchema = z
  .object({
    bin: z.record(z.string(), z.string()),
    files: z.array(z.string().min(1)),
  })
  .passthrough();

const CursorHooksSchema = z
  .object({
    hooks: z.object({
      stop: z.tuple([
        z
          .object({
            command: z.string(),
          })
          .passthrough(),
      ]),
    }),
  })
  .passthrough();

const NestedStopHooksSchema = z
  .object({
    hooks: z.object({
      Stop: z.tuple([
        z
          .object({
            hooks: z.tuple([
              z
                .object({
                  command: z.string(),
                })
                .passthrough(),
            ]),
          })
          .passthrough(),
      ]),
    }),
  })
  .passthrough();

describe("package runtime surface", () => {
  it("ships only the allowlisted plugin package surface", () => {
    const packageJson = PackageSchema.parse(readJson("package.json"));

    expect(packageJson.files).toEqual(PACKAGE_FILES);
  });

  it("ships only the expected plugin files", () => {
    const packageJson = PackageSchema.parse(readJson("package.json"));
    const shippedFiles = packageJson.files.flatMap(readPackageFiles);

    expect(shippedFiles).toHaveLength(SHIPPED_FILES.length);
    expect(new Set(shippedFiles)).toEqual(new Set(SHIPPED_FILES));
  });

  it("ships the executable Cursor hook runtime referenced by hooks.json and package bin", () => {
    const packageJson = PackageSchema.parse(readJson("package.json"));
    const hooks = CursorHooksSchema.parse(readJson("hooks/cursor/hooks.json"));

    const hookTarget = readPluginRootNodeTarget(hooks.hooks.stop[0].command, "CURSOR_PLUGIN_ROOT");
    const binTargets = Object.values(packageJson.bin).map((target) => target.replace(/^\.\//, ""));

    expect(hookTarget).toBe("dist/hooks/cursor/stop.js");
    expect(binTargets).toContain(hookTarget);
    expect(isPackaged(hookTarget, packageJson.files)).toBe(true);
    expect(statSync(hookTarget).mode & 0o111).not.toBe(0);
  });

  it("ships the executable Codex hook runtime referenced by hooks.json and package bin", () => {
    const packageJson = PackageSchema.parse(readJson("package.json"));
    const hooks = NestedStopHooksSchema.parse(readJson("hooks/codex/hooks.json"));

    const hookTarget = readPluginRootNodeTarget(
      hooks.hooks.Stop[0].hooks[0].command,
      "PLUGIN_ROOT",
    );
    const binTargets = Object.values(packageJson.bin).map((target) => target.replace(/^\.\//, ""));

    expect(hookTarget).toBe("dist/hooks/codex/stop.js");
    expect(binTargets).toContain(hookTarget);
    expect(isPackaged(hookTarget, packageJson.files)).toBe(true);
    expect(statSync(hookTarget).mode & 0o111).not.toBe(0);
  });

  it("ships the executable Claude hook runtime referenced by hooks.json and package bin", () => {
    const packageJson = PackageSchema.parse(readJson("package.json"));
    const hooks = NestedStopHooksSchema.parse(readJson("hooks/claude/hooks.json"));

    const hookTarget = readPluginRootNodeTarget(
      hooks.hooks.Stop[0].hooks[0].command,
      "CLAUDE_PLUGIN_ROOT",
    );
    const binTargets = Object.values(packageJson.bin).map((target) => target.replace(/^\.\//, ""));

    expect(hookTarget).toBe("dist/hooks/claude/stop.js");
    expect(binTargets).toContain(hookTarget);
    expect(isPackaged(hookTarget, packageJson.files)).toBe(true);
    expect(statSync(hookTarget).mode & 0o111).not.toBe(0);
  });

  it("does not include symlinks in package files", () => {
    const packageJson = PackageSchema.parse(readJson("package.json"));

    for (const path of packageJson.files) {
      expectPackagePathHasNoSymlink(path);
    }
  });
});

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Hosts reference the bundled runtime through their plugin-root env var, which
// may be written bare (`$PLUGIN_ROOT`) or braced (`${CLAUDE_PLUGIN_ROOT}`).
function readPluginRootNodeTarget(command: string, rootEnv: string): string {
  const match = new RegExp(`^node "\\$\\{?${rootEnv}\\}?/(.+)"$`).exec(command);
  if (match === null) {
    throw new Error(`Unexpected hook command: ${command}`);
  }

  return match[1];
}

function isPackaged(path: string, packageFiles: readonly string[]): boolean {
  return packageFiles.some((entry) => path === entry || path.startsWith(`${entry}/`));
}

function expectPackagePathHasNoSymlink(path: string): void {
  const stat = lstatSync(path);
  expect(stat.isSymbolicLink(), path).toBe(false);

  if (!stat.isDirectory()) {
    return;
  }

  for (const entry of readdirSync(path)) {
    expectPackagePathHasNoSymlink(join(path, entry));
  }
}
