import type { IndexStore } from "./store.js";
import { walkRepo } from "./walker.js";
import { indexMarkdownFile, isMarkdownPath } from "./markdown-indexer.js";
import { indexCodeFile, isCodePath } from "./code-indexer.js";

export interface IndexStats {
  filesProcessed: number;
  filesSkipped: number;
  filesRemoved: number;
  symbolsIndexed: number;
  durationMs: number;
}

export interface ScanOptions {
  root: string;
  store: IndexStore;
  /**
   * If true, skip files whose `mtimeMs` matches the indexed value AND remove
   * stale rows for files that no longer exist on disk.
   * If false (or omitted), reindex every file unconditionally; stale rows are
   * still pruned.
   */
  incremental?: boolean;
  onProgress?: (processed: number) => void;
}

/**
 * Repository scan. Markdown only for now; tree-sitter for code lands in the
 * next iteration.
 *
 * Incremental semantics:
 *  - File present on disk + same mtime as indexed → skip.
 *  - File present on disk + different mtime → re-index (overwrite).
 *  - File present on disk + not indexed → index.
 *  - File missing on disk + present in index → delete its symbols.
 */
export async function fullScan(opts: ScanOptions): Promise<IndexStats> {
  const start = Date.now();
  const incremental = opts.incremental === true;
  let processed = 0;
  let skipped = 0;
  let symbolsAdded = 0;

  // Track which paths we observed on disk so we can prune the rest.
  const seenPaths = new Set<string>();

  for await (const entry of walkRepo({
    root: opts.root,
    respectGitignore: true,
    fileFilter: (p) => isMarkdownPath(p) || isCodePath(p),
  })) {
    seenPaths.add(entry.relPath);

    if (incremental) {
      const indexedMtime = opts.store.getFileMtime(entry.relPath);
      if (indexedMtime !== null && indexedMtime === entry.mtimeMs) {
        skipped++;
        continue;
      }
    }

    // mtime changed (or non-incremental, or new file) → reindex.
    // Delete existing symbols for this path so removed sections don't linger.
    opts.store.deleteByPath(entry.relPath);

    let syms;
    if (isMarkdownPath(entry.relPath)) {
      syms = await indexMarkdownFile(
        entry.absPath,
        entry.relPath,
        entry.mtimeMs,
      );
    } else {
      // isCodePath was true above
      syms = await indexCodeFile(
        entry.absPath,
        entry.relPath,
        entry.mtimeMs,
      );
    }
    opts.store.upsertMany(syms);
    processed++;
    symbolsAdded += syms.length;
    if (opts.onProgress !== undefined && processed % 25 === 0) {
      opts.onProgress(processed);
    }
  }

  // Prune symbols for files that disappeared from disk.
  let removed = 0;
  const indexedPaths = opts.store.indexedPaths();
  for (const indexedPath of indexedPaths) {
    if (!seenPaths.has(indexedPath)) {
      removed += opts.store.deleteByPath(indexedPath);
    }
  }

  return {
    filesProcessed: processed,
    filesSkipped: skipped,
    filesRemoved: removed,
    symbolsIndexed: symbolsAdded,
    durationMs: Date.now() - start,
  };
}
