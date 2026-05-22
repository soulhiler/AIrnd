import { test } from "node:test";
import assert from "node:assert/strict";
import { symlinkSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeTempRepo } from "./fixtures.js";
import { readFileOp } from "../src/operations/read-file.js";
import { listFilesOp } from "../src/operations/list-files.js";
import { writeFileOp, MutationsDisabledError } from "../src/operations/write-file.js";
import { PathForbiddenError } from "../src/repo-root.js";

test("readFile rejects .env and other secret files", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(".env", "API_KEY=secret\n");
    repo.write(".env.production", "DB_PASS=hunter2\n");
    repo.write("id_rsa", "-----BEGIN PRIVATE KEY-----\n");
    repo.write("credentials.json", '{"k":"v"}\n');

    for (const sensitive of [
      ".env",
      ".env.production",
      "id_rsa",
      "credentials.json",
    ]) {
      await assert.rejects(
        () => readFileOp({ path: sensitive }),
        (e) => e instanceof PathForbiddenError,
        `Expected ${sensitive} to be rejected`,
      );
    }
  } finally {
    repo.cleanup();
  }
});

test("readFile rejects files under sensitive directories", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(".ssh/id_rsa", "secret");
    repo.write(".aws/credentials", "[default]\naws_access_key=...");
    await assert.rejects(
      () => readFileOp({ path: ".ssh/id_rsa" }),
      (e) => e instanceof PathForbiddenError,
    );
    await assert.rejects(
      () => readFileOp({ path: ".aws/credentials" }),
      (e) => e instanceof PathForbiddenError,
    );
  } finally {
    repo.cleanup();
  }
});

test("listFiles omits sensitive entries even when present", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(".env", "x");
    repo.write("regular.txt", "y");
    const result = await listFilesOp({ recursive: false });
    const paths = result.files.map((f) => f.path);
    assert.ok(paths.includes("regular.txt"));
    assert.ok(
      !paths.some((p) => p === ".env"),
      `Expected .env to be omitted, got: ${paths.join(", ")}`,
    );
  } finally {
    repo.cleanup();
  }
});

test("readFile blocks symlink escape outside repo root", async () => {
  const repo = makeTempRepo();
  const escapeTarget = mkdtempSync(join(tmpdir(), "asp-ref-escape-"));
  try {
    writeFileSync(join(escapeTarget, "secret.txt"), "very secret\n", "utf-8");
    // Create a symlink inside the repo pointing at the secret outside.
    symlinkSync(
      join(escapeTarget, "secret.txt"),
      join(repo.root, "leak.txt"),
    );
    await assert.rejects(
      () => readFileOp({ path: "leak.txt" }),
      (e) => e instanceof PathForbiddenError,
      "Symlink pointing outside repo root should be rejected",
    );
  } finally {
    repo.cleanup();
    // Clean up the escape target as well.
    try {
      const { rmSync } = await import("node:fs");
      rmSync(escapeTarget, { recursive: true, force: true });
    } catch {
      /* nothing to do */
    }
  }
});

test("writeFile rejects writing into a symlinked-out path", async () => {
  const prev = process.env["ASP_ENABLE_MUTATIONS"];
  process.env["ASP_ENABLE_MUTATIONS"] = "1";
  const repo = makeTempRepo();
  const externalDir = mkdtempSync(join(tmpdir(), "asp-ref-extdir-"));
  try {
    // Symlink `repo/escape-dir/` → externalDir.
    symlinkSync(externalDir, join(repo.root, "escape-dir"));
    await assert.rejects(
      () =>
        writeFileOp({
          path: "escape-dir/payload.txt",
          content: "owned",
          createDirs: true,
        }),
      (e) => e instanceof PathForbiddenError,
    );
  } finally {
    repo.cleanup();
    try {
      const { rmSync } = await import("node:fs");
      rmSync(externalDir, { recursive: true, force: true });
    } catch {
      /* nothing */
    }
    if (prev !== undefined) process.env["ASP_ENABLE_MUTATIONS"] = prev;
    else delete process.env["ASP_ENABLE_MUTATIONS"];
  }
});

test("writeFile requires ASP_ENABLE_MUTATIONS env to be set", async () => {
  const prev = process.env["ASP_ENABLE_MUTATIONS"];
  delete process.env["ASP_ENABLE_MUTATIONS"];
  const repo = makeTempRepo();
  try {
    await assert.rejects(
      () => writeFileOp({ path: "new.txt", content: "x" }),
      (e) => e instanceof MutationsDisabledError,
    );
  } finally {
    repo.cleanup();
    if (prev !== undefined) process.env["ASP_ENABLE_MUTATIONS"] = prev;
  }
});

test("mutationsEnabled accepts only '1' or 'true'", async () => {
  const { mutationsEnabled } = await import("../src/security.js");
  const prev = process.env["ASP_ENABLE_MUTATIONS"];
  try {
    delete process.env["ASP_ENABLE_MUTATIONS"];
    assert.equal(mutationsEnabled(), false);
    process.env["ASP_ENABLE_MUTATIONS"] = "1";
    assert.equal(mutationsEnabled(), true);
    process.env["ASP_ENABLE_MUTATIONS"] = "true";
    assert.equal(mutationsEnabled(), true);
    process.env["ASP_ENABLE_MUTATIONS"] = "yes"; // not allowed
    assert.equal(mutationsEnabled(), false);
    process.env["ASP_ENABLE_MUTATIONS"] = "0";
    assert.equal(mutationsEnabled(), false);
  } finally {
    if (prev !== undefined) process.env["ASP_ENABLE_MUTATIONS"] = prev;
    else delete process.env["ASP_ENABLE_MUTATIONS"];
  }
});

test("makeTempRepo helper does not leak temp files", async () => {
  const r = makeTempRepo();
  r.cleanup();
  const { existsSync } = await import("node:fs");
  assert.equal(existsSync(r.root), false);
});
