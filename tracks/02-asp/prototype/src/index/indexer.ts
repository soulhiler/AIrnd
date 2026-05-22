import type { IndexStore } from "./store.js";
import { walkRepo } from "./walker.js";
import { indexMarkdownFile, isMarkdownPath } from "./markdown-indexer.js";
import {
  indexCodeFile,
  isCodePath,
  type PendingEdge,
} from "./code-indexer.js";
import {
  DEFAULT_DIM,
  DEFAULT_MODEL,
  embed,
  embeddingsAvailable,
  ensureEmbeddingsReady,
  vectorToBlob,
} from "./embeddings.js";

export interface IndexStats {
  filesProcessed: number;
  filesSkipped: number;
  filesRemoved: number;
  symbolsIndexed: number;
  edgesResolved: number;
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
  /**
   * If true, compute and store embeddings for every freshly-indexed symbol.
   * When the embedding model fails to load (offline + no cache), indexing
   * proceeds without embeddings and the failure surfaces through
   * `retrieve` degradation. Defaults to false to keep scans fast and
   * dependency-light; the server flips it on when configured for Stage 2b.
   */
  embed?: boolean;
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
  const wantsEmbeddings = opts.embed === true;
  let processed = 0;
  let skipped = 0;
  let symbolsAdded = 0;

  if (wantsEmbeddings) {
    await ensureEmbeddingsReady();
  }

  // Track which paths we observed on disk so we can prune the rest.
  const seenPaths = new Set<string>();
  const pendingEdges: PendingEdge[] = [];

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
      const codeResult = await indexCodeFile(
        entry.absPath,
        entry.relPath,
        entry.mtimeMs,
      );
      syms = codeResult.symbols;
      for (const edge of codeResult.edges) {
        pendingEdges.push(edge);
      }
    }
    opts.store.upsertMany(syms);
    processed++;
    symbolsAdded += syms.length;

    if (wantsEmbeddings && embeddingsAvailable()) {
      for (const sym of syms) {
        const text = sym.snippet ?? "";
        if (text.length === 0) continue;
        const vec = await embed(text);
        if (vec === null) continue;
        opts.store.upsertEmbedding({
          symbolId: sym.id,
          dim: DEFAULT_DIM,
          model: DEFAULT_MODEL,
          vector: vectorToBlob(vec),
        });
      }
    }

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

  // Resolve pending edges. Group by src symbol so we can reset its outgoing
  // edges once before inserting, which keeps incremental scans correct.
  const edgesBySrc = new Map<string, PendingEdge[]>();
  for (const edge of pendingEdges) {
    const bucket = edgesBySrc.get(edge.srcSymbolId);
    if (bucket === undefined) {
      edgesBySrc.set(edge.srcSymbolId, [edge]);
    } else {
      bucket.push(edge);
    }
  }

  let edgesResolved = 0;
  for (const [srcId, batch] of edgesBySrc) {
    opts.store.resetEdgesFor(srcId);
    for (const edge of batch) {
      const candidates = opts.store.findSymbolsByName(edge.dstName);
      for (const dstId of candidates) {
        if (dstId === srcId) continue; // skip self-loops
        opts.store.upsertEdge(srcId, dstId, edge.kind);
        edgesResolved++;
      }
    }
  }

  return {
    filesProcessed: processed,
    filesSkipped: skipped,
    filesRemoved: removed,
    symbolsIndexed: symbolsAdded,
    edgesResolved,
    durationMs: Date.now() - start,
  };
}
