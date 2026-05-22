import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTempRepo } from "./fixtures.js";
import { readFileOp, NotFoundError } from "../src/operations/read-file.js";
import { listFilesOp } from "../src/operations/list-files.js";
import { makeSearchFilesOp } from "../src/operations/search-files.js";
import { makeFindByTagOp } from "../src/operations/find-by-tag.js";
import { makeContextOp } from "../src/operations/context.js";
import { PathForbiddenError } from "../src/repo-root.js";

test("readFile rejects path traversal", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("safe.md", "# Safe\n");
    await assert.rejects(
      () => readFileOp({ path: "../../../etc/passwd" }),
      (err) => err instanceof PathForbiddenError,
    );
    await assert.rejects(
      () => readFileOp({ path: "/etc/passwd" }),
      (err) => err instanceof PathForbiddenError,
    );
  } finally {
    repo.cleanup();
  }
});

test("readFile honours line range and token budget", async () => {
  const repo = makeTempRepo();
  try {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    repo.write("big.txt", lines.join("\n"));

    const all = await readFileOp({ path: "big.txt" });
    assert.equal(all.totalLines, 20);
    assert.equal(all.truncated, false);

    const range = await readFileOp({
      path: "big.txt",
      lineRange: { start: 5, end: 7 },
    });
    assert.equal(range.content, "line 5\nline 6\nline 7");

    const tiny = await readFileOp({ path: "big.txt", tokenBudget: 1 });
    assert.equal(tiny.truncated, true);
    assert.ok(tiny.content.length < lines.join("\n").length);
  } finally {
    repo.cleanup();
  }
});

test("readFile errors on missing file", async () => {
  const repo = makeTempRepo();
  try {
    await assert.rejects(
      () => readFileOp({ path: "nope.txt" }),
      (err) => err instanceof NotFoundError,
    );
  } finally {
    repo.cleanup();
  }
});

test("listFiles returns directory contents", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("a.md", "x");
    repo.write("dir/b.md", "y");
    const r = await listFilesOp({ recursive: false });
    const paths = new Set(r.files.map((f) => f.path));
    assert.ok(paths.has("a.md"));
    assert.ok(paths.has("dir/"));
  } finally {
    repo.cleanup();
  }
});

test("searchFiles finds an indexed phrase", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("a.md", "# Spec\n\nThe quick brown fox jumped.");
    await repo.scan();

    const op = makeSearchFilesOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const r = await op({ query: "brown fox" });
    assert.ok(r.matches.length > 0);
    assert.ok(r.matches[0]!.path === "a.md");
    assert.deepEqual(r.degradation, []);
  } finally {
    repo.cleanup();
  }
});

test("searchFiles reports partial-index degradation when not built", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("a.md", "# X\n");
    const op = makeSearchFilesOp({
      store: repo.store,
      indexBuilt: () => false, // simulate scan in progress
    });
    const r = await op({ query: "X" });
    assert.ok(
      r.degradation.some((d) => d.feature === "partial-index"),
      "Expected partial-index degradation",
    );
  } finally {
    repo.cleanup();
  }
});

test("findByTag with kind filter narrows results", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("dir/x.md", "# Title\n## Section\n");
    await repo.scan();

    const op = makeFindByTagOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const onlyFiles = await op({ tag: "dir", kind: "file" });
    assert.ok(onlyFiles.symbols.every((s) => s.kind === "file"));
    assert.ok(onlyFiles.symbols.some((s) => s.id === "file:dir/x.md"));
  } finally {
    repo.cleanup();
  }
});

test("findByTag rejects invalid tag format", async () => {
  const repo = makeTempRepo();
  try {
    const op = makeFindByTagOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    await assert.rejects(() => op({ tag: "" }));
    await assert.rejects(() => op({ tag: "has space" }));
    await assert.rejects(() => op({ tag: "trailing/slash/" }));
  } finally {
    repo.cleanup();
  }
});

test("context returns symbol with parent and children", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("p.md", "# Top\n## Mid\n### Child1\n### Child2\n");
    await repo.scan();
    const op = makeContextOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const r = await op({ symbol: "section:p.md#Mid" });
    assert.notEqual(r.symbol, null);
    assert.equal(r.symbol!.id, "section:p.md#Mid");
    assert.notEqual(r.parent, null);
    assert.equal(r.parent!.id, "section:p.md#Top");
    assert.equal(r.children.length, 2);
  } finally {
    repo.cleanup();
  }
});

test("context signals graph-index degradation when references requested", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("p.md", "# X\n## Y\n");
    await repo.scan();
    const op = makeContextOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const r = await op({
      symbol: "section:p.md#Y",
      includeReferences: true,
    });
    assert.ok(r.degradation.some((d) => d.feature === "graph-index"));
    assert.deepEqual(r.references, []);
  } finally {
    repo.cleanup();
  }
});

test("context returns null symbol when not found", async () => {
  const repo = makeTempRepo();
  try {
    const op = makeContextOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const r = await op({ symbol: "section:missing.md#X" });
    assert.equal(r.symbol, null);
    assert.equal(r.children.length, 0);
  } finally {
    repo.cleanup();
  }
});
