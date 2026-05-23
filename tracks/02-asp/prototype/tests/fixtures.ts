/**
 * Shared test helpers: per-test temp repo, file writers, scan invocation.
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { fullScan } from "../src/index/indexer.js";
import { IndexStore } from "../src/index/store.js";
import { setRepoRoot } from "../src/repo-root.js";

export interface TempRepo {
  root: string;
  store: IndexStore;
  write(relPath: string, content: string, mtime?: number): void;
  scan(opts?: { incremental?: boolean }): ReturnType<typeof fullScan>;
  cleanup(): void;
}

export function makeTempRepo(): TempRepo {
  const root = mkdtempSync(join(tmpdir(), "asp-ref-test-"));
  setRepoRoot(root);
  const store = new IndexStore(join(root, ".asp", "index.db"));

  return {
    root,
    store,
    write(relPath, content, mtime) {
      const abs = join(root, relPath);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf-8");
      if (mtime !== undefined) {
        utimesSync(abs, mtime / 1000, mtime / 1000);
      }
    },
    async scan(opts) {
      return fullScan({
        root,
        store,
        ...(opts?.incremental !== undefined && {
          incremental: opts.incremental,
        }),
      });
    },
    cleanup() {
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
