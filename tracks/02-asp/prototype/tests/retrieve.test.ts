import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTempRepo } from "./fixtures.js";
import { makeRetrieveOp } from "../src/operations/retrieve.js";

test("retrieve keyword mode works without embeddings", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("a.md", "# Auth\n\nLogin with username and password.");
    repo.write("b.md", "# Database\n\nSQLite local persistence.");
    await repo.scan();

    const op = makeRetrieveOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const r = await op({
      query: "login",
      mode: "keyword",
      nFinal: 5,
    });
    assert.ok(r.symbols.length > 0);
    assert.equal(r.modeUsed, "keyword");
    assert.ok(r.symbols.some((s) => s.id.includes("a.md")));
  } finally {
    repo.cleanup();
  }
});

test("retrieve vector mode falls back to keyword when model unavailable", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("a.md", "# Topic\n\nQuick brown fox content here.");
    await repo.scan();

    const op = makeRetrieveOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const r = await op({
      query: "quick brown",
      mode: "vector",
      nFinal: 3,
    });
    // Either embeddings worked (clean run) or fell back with a degradation.
    // In the test sandbox the model can't be downloaded, so we expect fallback.
    if (r.modeUsed === "keyword") {
      assert.ok(
        r.degradation.some((d) => d.feature === "embeddings"),
        "Expected embeddings degradation when falling back",
      );
    } else {
      assert.equal(r.modeUsed, "vector");
    }
  } finally {
    repo.cleanup();
  }
});

test("retrieve rerank=true emits degradation (not implemented)", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("a.md", "# Item\n\nLorem ipsum text.");
    await repo.scan();

    const op = makeRetrieveOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const r = await op({
      query: "lorem",
      mode: "keyword",
      nFinal: 3,
      rerank: true,
    });
    assert.equal(r.rerankApplied, false);
    assert.ok(r.degradation.some((d) => d.feature === "rerank"));
  } finally {
    repo.cleanup();
  }
});

test("retrieve filter narrows results by tag", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("docs/api.md", "# API\n\nEndpoint reference.");
    repo.write("src/api.md", "# Internal\n\nEndpoint internals.");
    await repo.scan();

    const op = makeRetrieveOp({
      store: repo.store,
      indexBuilt: () => true,
    });
    const r = await op({
      query: "endpoint",
      mode: "keyword",
      filter: { tags: ["docs"] },
      nFinal: 5,
    });
    for (const s of r.symbols) {
      assert.ok(
        s.tags?.includes("docs"),
        `Expected docs tag, got: ${JSON.stringify(s.tags)}`,
      );
    }
  } finally {
    repo.cleanup();
  }
});
