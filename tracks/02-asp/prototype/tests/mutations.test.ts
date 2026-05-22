import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { makeTempRepo } from "./fixtures.js";
import { FileExistsError, writeFileOp } from "../src/operations/write-file.js";
import {
  applyPatchOp,
  PatchMalformedError,
} from "../src/operations/apply-patch.js";
import { PathForbiddenError } from "../src/repo-root.js";

test("writeFile creates a new file", async () => {
  const repo = makeTempRepo();
  try {
    const r = await writeFileOp({ path: "new.txt", content: "hello" });
    assert.equal(r.created, true);
    assert.equal(r.skipped, false);
    assert.equal(r.bytesWritten, 5);
    const actual = await readFile(join(repo.root, "new.txt"), "utf-8");
    assert.equal(actual, "hello");
  } finally {
    repo.cleanup();
  }
});

test("writeFile fails when file exists and ifExists=fail (default)", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("existing.txt", "old");
    await assert.rejects(
      () => writeFileOp({ path: "existing.txt", content: "new" }),
      (e) => e instanceof FileExistsError,
    );
  } finally {
    repo.cleanup();
  }
});

test("writeFile overwrites when ifExists=overwrite", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("existing.txt", "old");
    const r = await writeFileOp({
      path: "existing.txt",
      content: "new",
      ifExists: "overwrite",
    });
    assert.equal(r.created, false);
    assert.equal(r.skipped, false);
    const actual = await readFile(join(repo.root, "existing.txt"), "utf-8");
    assert.equal(actual, "new");
  } finally {
    repo.cleanup();
  }
});

test("writeFile skips when ifExists=skip", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("existing.txt", "old");
    const r = await writeFileOp({
      path: "existing.txt",
      content: "new",
      ifExists: "skip",
    });
    assert.equal(r.skipped, true);
    const actual = await readFile(join(repo.root, "existing.txt"), "utf-8");
    assert.equal(actual, "old");
  } finally {
    repo.cleanup();
  }
});

test("writeFile creates parent dirs when requested", async () => {
  const repo = makeTempRepo();
  try {
    const r = await writeFileOp({
      path: "deep/nested/file.txt",
      content: "x",
      createDirs: true,
    });
    assert.equal(r.created, true);
    const actual = await readFile(
      join(repo.root, "deep/nested/file.txt"),
      "utf-8",
    );
    assert.equal(actual, "x");
  } finally {
    repo.cleanup();
  }
});

test("writeFile rejects path traversal", async () => {
  const repo = makeTempRepo();
  try {
    await assert.rejects(
      () => writeFileOp({ path: "../escape.txt", content: "x" }),
      (e) => e instanceof PathForbiddenError,
    );
  } finally {
    repo.cleanup();
  }
});

test("applyPatch applies a single-hunk modification", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(
      "f.txt",
      ["line a", "line b", "line c"].join("\n"),
    );
    const patch = [
      "--- a/f.txt",
      "+++ b/f.txt",
      "@@ -1,3 +1,3 @@",
      " line a",
      "-line b",
      "+line B",
      " line c",
      "",
    ].join("\n");
    const r = await applyPatchOp({ patch });
    assert.equal(r.applied, true);
    assert.equal(r.conflicts.length, 0);
    assert.equal(r.linesAdded, 1);
    assert.equal(r.linesRemoved, 1);
    const actual = await readFile(join(repo.root, "f.txt"), "utf-8");
    assert.equal(actual, "line a\nline B\nline c");
  } finally {
    repo.cleanup();
  }
});

test("applyPatch dryRun validates without writing", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("f.txt", ["one", "two"].join("\n"));
    const patch = [
      "--- a/f.txt",
      "+++ b/f.txt",
      "@@ -1,2 +1,2 @@",
      "-one",
      "+ONE",
      " two",
      "",
    ].join("\n");
    const r = await applyPatchOp({ patch, dryRun: true });
    assert.equal(r.applied, false);
    assert.equal(r.conflicts.length, 0);
    const actual = await readFile(join(repo.root, "f.txt"), "utf-8");
    assert.equal(actual, "one\ntwo", "Dry run should not modify file");
  } finally {
    repo.cleanup();
  }
});

test("applyPatch reports conflicts on mismatched context", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("f.txt", "actual content");
    const patch = [
      "--- a/f.txt",
      "+++ b/f.txt",
      "@@ -1,1 +1,1 @@",
      "-expected content",
      "+new content",
      "",
    ].join("\n");
    const r = await applyPatchOp({ patch });
    assert.equal(r.applied, false);
    assert.ok(r.conflicts.length > 0);
  } finally {
    repo.cleanup();
  }
});

test("applyPatch rejects malformed input", async () => {
  const repo = makeTempRepo();
  try {
    await assert.rejects(
      () => applyPatchOp({ patch: "not a diff at all" }),
      (e) => e instanceof PatchMalformedError,
    );
  } finally {
    repo.cleanup();
  }
});
