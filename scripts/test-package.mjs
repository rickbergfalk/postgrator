// Verifies the published package, not `src`.
//
// 1. `npm pack` (which runs `prepack` -> build) into a temp directory.
// 2. Extract the tarball into a throwaway consumer project's node_modules.
// 3. Run a runtime smoke test that imports `postgrator` by name.
// 4. Type-check a consumer against the published `.d.ts` files.
//
// Runtime dependencies are symlinked from the repo's node_modules so this
// works offline and always tests the tarball contents.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const fixturesDir = path.join(repoRoot, "scripts", "package-test");
const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "postgrator-package-test-")
);

function run(command, args, options = {}) {
  execFileSync(command, args, { cwd: repoRoot, stdio: "inherit", ...options });
}

function expectedTarballFiles(packageJson, packedFiles) {
  const normalize = (file) => file.replace(/^\.\//, "");
  const missing = [];
  const required = [
    "package.json",
    packageJson.main,
    packageJson.types,
    "CHANGELOG.md",
  ].map(normalize);
  for (const file of required) {
    if (!packedFiles.includes(file)) {
      missing.push(file);
    }
  }
  return missing;
}

try {
  const packOutput = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", tempDir],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }
  );
  const [packed] = JSON.parse(packOutput);
  const tarball = path.join(tempDir, packed.filename);

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
  );
  const packedFiles = packed.files.map((file) => file.path);
  const missingFiles = expectedTarballFiles(packageJson, packedFiles);
  if (missingFiles.length > 0) {
    throw new Error(
      `Packed tarball is missing expected files: ${missingFiles.join(", ")}`
    );
  }
  for (const file of packedFiles) {
    // Sources, tests, and dev scripts must never ship.
    if (["src/", "test/", "scripts/"].some((dir) => file.startsWith(dir))) {
      throw new Error(`Unexpected file in packed tarball: ${file}`);
    }
    // Declaration maps reference sources that are not published.
    if (file.endsWith(".d.ts.map")) {
      throw new Error(`Unexpected declaration map in packed tarball: ${file}`);
    }
  }

  const consumerDir = path.join(tempDir, "consumer");
  const nodeModulesDir = path.join(consumerDir, "node_modules");
  const installedDir = path.join(nodeModulesDir, "postgrator");
  fs.mkdirSync(installedDir, { recursive: true });
  fs.writeFileSync(
    path.join(consumerDir, "package.json"),
    JSON.stringify(
      { name: "postgrator-package-test", private: true, type: "module" },
      null,
      2
    )
  );

  run("tar", ["-xzf", tarball, "-C", installedDir, "--strip-components=1"]);

  // Symlink runtime dependencies (and their transitive deps, resolved through
  // realpaths) plus the dev-only driver and types used by the smoke test.
  const installedPackageJson = JSON.parse(
    fs.readFileSync(path.join(installedDir, "package.json"), "utf8")
  );
  const linkedDeps = new Set([
    ...Object.keys(installedPackageJson.dependencies ?? {}),
    "better-sqlite3",
  ]);
  for (const dep of linkedDeps) {
    fs.symlinkSync(
      path.join(repoRoot, "node_modules", dep),
      path.join(nodeModulesDir, dep),
      "junction"
    );
  }
  fs.symlinkSync(
    path.join(repoRoot, "node_modules", "@types"),
    path.join(nodeModulesDir, "@types"),
    "junction"
  );

  for (const file of ["smoke.mjs", "consumer.ts", "tsconfig.json"]) {
    fs.copyFileSync(path.join(fixturesDir, file), path.join(consumerDir, file));
  }

  run(process.execPath, ["smoke.mjs"], { cwd: consumerDir });
  run(
    process.execPath,
    [
      path.join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      "tsconfig.json",
    ],
    { cwd: consumerDir }
  );
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
