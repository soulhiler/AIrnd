import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTempRepo } from "./fixtures.js";

test("incremental scan skips unchanged files", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("a.md", "# A\n## A1\n");
    repo.write("b.md", "# B\n");

    // Initial scan
    const first = await repo.scan();
    assert.equal(first.filesProcessed, 2);
    assert.equal(first.filesSkipped, 0);

    // Incremental rescan with no changes
    const second = await repo.scan({ incremental: true });
    assert.equal(second.filesProcessed, 0);
    assert.equal(second.filesSkipped, 2);
  } finally {
    repo.cleanup();
  }
});

test("incremental scan picks up modified files", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("a.md", "# A\n", 1_000_000);
    await repo.scan();

    // Modify a.md (newer mtime)
    repo.write("a.md", "# A\n## NewSection\n", 2_000_000);
    const incr = await repo.scan({ incremental: true });

    assert.equal(incr.filesProcessed, 1);
    assert.equal(incr.filesSkipped, 0);

    // The new section should now be indexed
    const sym = repo.store.getSymbolById("section:a.md#NewSection");
    assert.notEqual(sym, null);
  } finally {
    repo.cleanup();
  }
});

test("scan prunes symbols for deleted files", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("keep.md", "# Keep\n");
    repo.write("gone.md", "# Gone\n");
    await repo.scan();
    assert.notEqual(repo.store.getSymbolById("file:gone.md"), null);

    // Remove the file
    const { rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    rmSync(join(repo.root, "gone.md"));

    const result = await repo.scan({ incremental: true });
    assert.ok(result.filesRemoved >= 1);
    assert.equal(repo.store.getSymbolById("file:gone.md"), null);
    assert.notEqual(repo.store.getSymbolById("file:keep.md"), null);
  } finally {
    repo.cleanup();
  }
});

test("scan removes stale sections when file content shrinks", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(
      "x.md",
      "# Title\n## A\n## B\n## C\n",
      1_000_000,
    );
    await repo.scan();
    assert.notEqual(repo.store.getSymbolById("section:x.md#B"), null);

    // Rewrite file without section B
    repo.write("x.md", "# Title\n## A\n## C\n", 2_000_000);
    await repo.scan({ incremental: true });

    assert.equal(
      repo.store.getSymbolById("section:x.md#B"),
      null,
      "Section B should be pruned after the file shrank",
    );
    assert.notEqual(repo.store.getSymbolById("section:x.md#A"), null);
    assert.notEqual(repo.store.getSymbolById("section:x.md#C"), null);
  } finally {
    repo.cleanup();
  }
});
