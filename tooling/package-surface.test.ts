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

const HooksSchema = z
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

describe("package runtime surface", () => {
  it("ships only the Cursor plugin package surface", () => {
    const packageJson = PackageSchema.parse(readJson("package.json"));

    expect(packageJson.files).toEqual(PACKAGE_FILES);
  });

  it("ships only the expected Cursor plugin files", () => {
    const packageJson = PackageSchema.parse(readJson("package.json"));
    const shippedFiles = packageJson.files.flatMap(readPackageFiles);

    expect(shippedFiles).toHaveLength(SHIPPED_FILES.length);
    expect(new Set(shippedFiles)).toEqual(new Set(SHIPPED_FILES));
  });

  it("ships the executable Cursor hook runtime referenced by hooks.json and package bin", () => {
    const packageJson = PackageSchema.parse(readJson("package.json"));
    const hooks = HooksSchema.parse(readJson("hooks/cursor/hooks.json"));

    const hookTarget = readCursorPluginRootNodeTarget(hooks.hooks.stop[0].command);
    const binTargets = Object.values(packageJson.bin).map((target) => target.replace(/^\.\//, ""));

    expect(hookTarget).toBe("dist/hooks/cursor/stop.js");
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

function readCursorPluginRootNodeTarget(command: string): string {
  const match = /^node "\$CURSOR_PLUGIN_ROOT\/(.+)"$/.exec(command);
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
