import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTempRepo } from "./fixtures.js";

test("markdown indexer extracts file + section symbols", async () => {
  const repo = makeTempRepo();
  try {
    repo.write(
      "docs/intro.md",
      [
        "# Introduction",
        "",
        "Overview text.",
        "",
        "## Setup",
        "Install steps.",
        "",
        "## Usage",
        "How to use.",
        "",
        "### Examples",
        "Sample code.",
      ].join("\n"),
    );

    const stats = await repo.scan();
    assert.equal(stats.filesProcessed, 1);
    // 1 file + 4 sections (h1 Intro, h2 Setup, h2 Usage, h3 Examples)
    assert.equal(stats.symbolsIndexed, 5);

    // Verify file symbol.
    const fileSym = repo.store.getSymbolById("file:docs/intro.md");
    assert.notEqual(fileSym, null);
    assert.equal(fileSym!.kind, "file");
    assert.ok(fileSym!.tags.includes("docs"));
    assert.ok(fileSym!.tags.includes("lang/markdown"));

    // Verify a section symbol exists.
    const setupSym = repo.store.getSymbolById("section:docs/intro.md#Setup");
    assert.notEqual(setupSym, null);
    assert.equal(setupSym!.kind, "section");
    assert.ok(setupSym!.tags.includes("heading/level-2"));
    assert.ok(setupSym!.tags.includes("section/Introduction"));
  } finally {
    repo.cleanup();
  }
});

test("findByTag hierarchical: prefix matches deeper paths", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("a/foo.md", "# Foo\n## Bar\n");
    repo.write("a/b/baz.md", "# Baz\n");
    repo.write("c/other.md", "# Other\n");
    await repo.scan();

    const hits = repo.store.findByTag({
      tag: "a",
      hierarchical: true,
      limit: 100,
    });
    const paths = new Set(hits.map((h) => h.path));
    assert.ok(paths.has("a/foo.md"));
    assert.ok(paths.has("a/b/baz.md"));
    assert.ok(!paths.has("c/other.md"));

    // Our walker emits each ancestor as a separate tag, so `a` appears on
    // every nested file. This test documents that behaviour: an exact-`a`
    // lookup still finds children whose tag list literally contains `a`.
    const exact = repo.store.findByTag({
      tag: "a",
      hierarchical: false,
      limit: 100,
    });
    const exactPaths = new Set(exact.map((h) => h.path));
    assert.ok(exactPaths.has("a/foo.md"));
    assert.ok(exactPaths.has("a/b/baz.md"));
  } finally {
    repo.cleanup();
  }
});
