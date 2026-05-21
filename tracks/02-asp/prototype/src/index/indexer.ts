import type { IndexStore } from "./store.js";
import { walkRepo } from "./walker.js";
import { indexMarkdownFile, isMarkdownPath } from "./markdown-indexer.js";

export interface IndexStats {
  filesProcessed: number;
  symbolsIndexed: number;
  durationMs: number;
}

/**
 * Full repository scan. Stage 2a indexes markdown only; tree-sitter for
 * code lands in the next chunk.
 */
export async function fullScan(opts: {
  root: string;
  store: IndexStore;
  onProgress?: (filesProcessed: number) => void;
}): Promise<IndexStats> {
  const start = Date.now();
  let files = 0;
  let symbols = 0;

  for await (const entry of walkRepo({
    root: opts.root,
    respectGitignore: true,
    fileFilter: isMarkdownPath,
  })) {
    const syms = await indexMarkdownFile(
      entry.absPath,
      entry.relPath,
      entry.mtimeMs,
    );
    opts.store.upsertMany(syms);
    files++;
    symbols += syms.length;
    if (opts.onProgress !== undefined && files % 25 === 0) {
      opts.onProgress(files);
    }
  }

  return {
    filesProcessed: files,
    symbolsIndexed: symbols,
    durationMs: Date.now() - start,
  };
}
