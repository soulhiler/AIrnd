import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTempRepo } from "./fixtures.js";
import { fullScan } from "../src/index/indexer.js";
import {
  makeRefreshOp,
  refreshStatusOp,
} from "../src/operations/refresh.js";

test("refresh with scope paths only re-indexes within scope", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("src/a.md", "# A\n", 1_000_000);
    repo.write("docs/b.md", "# B\n", 1_000_000);
    await repo.scan();

    // Modify both
    repo.write("src/a.md", "# A2\n", 2_000_000);
    repo.write("docs/b.md", "# B2\n", 2_000_000);

    // Scoped incremental refresh: only src/
    const stats = await fullScan({
      root: repo.root,
      store: repo.store,
      incremental: true,
      paths: ["src"],
    });

    assert.equal(stats.filesProcessed, 1, "Only src/a.md should be reprocessed");
    // docs/b.md still has its v1 indexed because it's out of scope.
    const docsSym = repo.store.getSymbolById("file:docs/b.md");
    assert.notEqual(docsSym, null);
  } finally {
    repo.cleanup();
  }
});

test("refresh async returns jobId and refreshStatus reports completion", async () => {
  const repo = makeTempRepo();
  try {
    repo.write("a.md", "# A\n");
    const op = makeRefreshOp({
      store: repo.store,
      repoRoot: repo.root,
    });
    const result = await op({ wait: false });
    assert.equal(result.completed, false);
    assert.ok(result.jobId !== undefined);

    // Poll until complete.
    let status = await refreshStatusOp({ jobId: result.jobId! });
    for (let i = 0; i < 50 && status.status !== "complete"; i++) {
      await new Promise((r) => setTimeout(r, 50));
      status = await refreshStatusOp({ jobId: result.jobId! });
    }
    assert.equal(status.status, "complete", `Job did not complete: ${JSON.stringify(status)}`);
    assert.ok(status.stats !== undefined);
    assert.ok(status.stats!.filesProcessed >= 1);
  } finally {
    repo.cleanup();
  }
});

test("refreshStatus returns failed for unknown jobId", async () => {
  const repo = makeTempRepo();
  try {
    const r = await refreshStatusOp({ jobId: "job-does-not-exist" });
    assert.equal(r.status, "failed");
    assert.ok(r.error !== undefined);
  } finally {
    repo.cleanup();
  }
});
