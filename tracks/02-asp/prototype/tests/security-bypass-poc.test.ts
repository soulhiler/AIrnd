/**
 * Round-2 audit regression tests (Alex's PoC).
 *
 * On v0.1.1 these three cases let an in-repo symlink bypass the secret
 * denylist:
 *
 *  - readFile("data.json") where data.json → .env returns .env contents.
 *  - writeFile("data.json", ...) overwrites .env via the symlink.
 *  - applyPatch through a symlink-aliased target rewrites the secret.
 *
 * v0.1.2 closes them by re-running pathHasSensitiveSegment on the
 * post-realpath relative form (see src/repo-root.ts:resolveSafe).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { makeTempRepo } from "./fixtures.js";
import { readFileOp } from "../src/operations/read-file.js";
import { writeFileOp } from "../src/operations/write-file.js";
import { applyPatchOp } from "../src/operations/apply-patch.js";
import { PathForbiddenError } from "../src/repo-root.js";

test("Round-2 PoC: readFile through in-repo symlink to .env is rejected", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(".env", "API_KEY=very-secret\n");
    symlinkSync(join(repo.root, ".env"), join(repo.root, "data.json"));

    await assert.rejects(
      () => readFileOp({ path: "data.json" }),
      (e) => e instanceof PathForbiddenError,
      "data.json (symlinked to .env) must be rejected by the denylist after realpath",
    );

    // Sanity: original .env still rejected by name.
    await assert.rejects(
      () => readFileOp({ path: ".env" }),
      (e) => e instanceof PathForbiddenError,
    );
  } finally {
    repo.cleanup();
  }
});

test("Round-2 PoC: writeFile through in-repo symlink does not clobber .env", async () => {
  const prev = process.env["ASP_ENABLE_MUTATIONS"];
  process.env["ASP_ENABLE_MUTATIONS"] = "1";
  const repo = makeTempRepo();
  try {
    repo.write(".env", "API_KEY=before\n");
    symlinkSync(join(repo.root, ".env"), join(repo.root, "data.json"));

    await assert.rejects(
      () =>
        writeFileOp({
          path: "data.json",
          content: "owned",
          ifExists: "overwrite",
        }),
      (e) => e instanceof PathForbiddenError,
    );

    // .env content is unchanged.
    const stillThere = readFileSync(join(repo.root, ".env"), "utf-8");
    assert.equal(stillThere, "API_KEY=before\n", ".env must not have been overwritten");
  } finally {
    repo.cleanup();
    if (prev !== undefined) process.env["ASP_ENABLE_MUTATIONS"] = prev;
    else delete process.env["ASP_ENABLE_MUTATIONS"];
  }
});

test("Round-2 PoC: applyPatch through symlink-aliased target is rejected", async () => {
  const prev = process.env["ASP_ENABLE_MUTATIONS"];
  process.env["ASP_ENABLE_MUTATIONS"] = "1";
  const repo = makeTempRepo();
  try {
    repo.write(".env", "API_KEY=before\n");
    symlinkSync(join(repo.root, ".env"), join(repo.root, "ok.txt"));

    const maliciousPatch = [
      "--- a/ok.txt",
      "+++ b/ok.txt",
      "@@ -1,1 +1,1 @@",
      "-API_KEY=before",
      "+API_KEY=owned",
      "",
    ].join("\n");

    await assert.rejects(
      () => applyPatchOp({ patch: maliciousPatch }),
      (e) => e instanceof PathForbiddenError,
    );

    const stillThere = readFileSync(join(repo.root, ".env"), "utf-8");
    assert.equal(stillThere, "API_KEY=before\n");
  } finally {
    repo.cleanup();
    if (prev !== undefined) process.env["ASP_ENABLE_MUTATIONS"] = prev;
    else delete process.env["ASP_ENABLE_MUTATIONS"];
  }
});

test("Round-2 finding #2: applyPatch dryRun is gated like the real thing", async () => {
  const prev = process.env["ASP_ENABLE_MUTATIONS"];
  delete process.env["ASP_ENABLE_MUTATIONS"];
  const repo = makeTempRepo();
  try {
    repo.write("regular.txt", "one\ntwo\n");
    const patch = [
      "--- a/regular.txt",
      "+++ b/regular.txt",
      "@@ -1,2 +1,2 @@",
      "-one",
      "+ONE",
      " two",
      "",
    ].join("\n");

    // Per ADR 0010 §1 dryRun is gated too — no read-primitive via patch
    // conflict messages without an explicit opt-in.
    const { MutationsDisabledError } = await import(
      "../src/operations/write-file.js"
    );
    await assert.rejects(
      () => applyPatchOp({ patch, dryRun: true }),
      (e) => e instanceof MutationsDisabledError,
    );
  } finally {
    repo.cleanup();
    if (prev !== undefined) process.env["ASP_ENABLE_MUTATIONS"] = prev;
  }
});

test("Round-2 finding #2: conflict messages do not leak file content", async () => {
  const prev = process.env["ASP_ENABLE_MUTATIONS"];
  process.env["ASP_ENABLE_MUTATIONS"] = "1";
  const repo = makeTempRepo();
  try {
    const secret = "VERY_SECRET_API_KEY=abcdef1234567890";
    repo.write("config.txt", `${secret}\n`);

    // Patch that won't match — context line is wrong.
    const patch = [
      "--- a/config.txt",
      "+++ b/config.txt",
      "@@ -1,1 +1,1 @@",
      "-NOT_THE_REAL_LINE",
      "+REPLACEMENT",
      "",
    ].join("\n");

    const result = await applyPatchOp({ patch });
    assert.ok(result.conflicts.length > 0, "expected a conflict");
    const reason = result.conflicts[0]!.reason;
    assert.ok(
      !reason.includes(secret),
      `conflict message must not leak the secret content: ${reason}`,
    );
    // Sanity: message should contain a hash-style summary.
    assert.match(reason, /hash=[0-9a-f]{8}/);
  } finally {
    repo.cleanup();
    if (prev !== undefined) process.env["ASP_ENABLE_MUTATIONS"] = prev;
    else delete process.env["ASP_ENABLE_MUTATIONS"];
  }
});
