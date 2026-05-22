import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { SCHEMA_DDL, SCHEMA_VERSION } from "./schema.js";
import type { SymbolKind } from "../types.js";

export interface IndexedSymbol {
  id: string;
  kind: SymbolKind;
  scheme: string;
  path: string;
  anchor: string | null;
  line: number | null;
  endLine: number | null;
  parentId: string | null;
  tokenSize: number | null;
  snippet: string | null;
  mtimeMs: number | null;
  tags: string[];
}

export interface SearchHit {
  id: string;
  kind: SymbolKind;
  path: string;
  anchor: string | null;
  line: number | null;
  snippet: string | null;
  tags: string[];
  bm25: number;
}

/**
 * Row returned by getSymbolById / findByTag — full symbol record with tags.
 */
export interface SymbolRow {
  id: string;
  kind: SymbolKind;
  scheme: string;
  path: string;
  anchor: string | null;
  line: number | null;
  endLine: number | null;
  parentId: string | null;
  tokenSize: number | null;
  snippet: string | null;
  tags: string[];
}

/**
 * Wrapper over better-sqlite3 with prepared statements for the indexer.
 * Single-writer assumption (Stage 2a only — see ADR 0007 § cons).
 */
export class IndexStore {
  private readonly db: DatabaseType;
  private readonly stmts: {
    upsertSymbol: Database.Statement;
    deleteTagsFor: Database.Statement;
    insertTag: Database.Statement;
    getMtime: Database.Statement;
    countSymbols: Database.Statement;
    searchFts: Database.Statement;
    tagsForSymbol: Database.Statement;
    getSymbol: Database.Statement;
    findByTagExact: Database.Statement;
    findByTagHierarchical: Database.Statement;
    childrenOfSymbol: Database.Statement;
    getFileMtime: Database.Statement;
    deleteByPath: Database.Statement;
    distinctIndexedPaths: Database.Statement;
    upsertEmbedding: Database.Statement;
    listEmbeddings: Database.Statement;
    countEmbeddings: Database.Statement;
  };

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("foreign_keys = ON");

    this.db.exec(SCHEMA_DDL);
    this.ensureSchemaVersion();

    this.stmts = {
      upsertSymbol: this.db.prepare(`
        INSERT INTO symbols (id, kind, scheme, path, anchor, line, end_line,
                              parent_id, token_size, snippet, mtime_ms)
        VALUES (@id, @kind, @scheme, @path, @anchor, @line, @endLine,
                @parentId, @tokenSize, @snippet, @mtimeMs)
        ON CONFLICT(id) DO UPDATE SET
          kind=excluded.kind,
          path=excluded.path,
          anchor=excluded.anchor,
          line=excluded.line,
          end_line=excluded.end_line,
          parent_id=excluded.parent_id,
          token_size=excluded.token_size,
          snippet=excluded.snippet,
          mtime_ms=excluded.mtime_ms
      `),
      deleteTagsFor: this.db.prepare(`DELETE FROM tags WHERE symbol_id = ?`),
      insertTag: this.db.prepare(
        `INSERT OR IGNORE INTO tags (symbol_id, tag) VALUES (?, ?)`,
      ),
      getMtime: this.db.prepare(
        `SELECT mtime_ms FROM symbols WHERE id = ?`,
      ),
      countSymbols: this.db.prepare(`SELECT COUNT(*) AS c FROM symbols`),
      // bm25() returns lower = better; we negate it to score "higher = better".
      searchFts: this.db.prepare(`
        SELECT s.id, s.kind, s.path, s.anchor, s.line, s.snippet,
               -bm25(symbols_fts) AS score
        FROM symbols_fts
        JOIN symbols s ON s.rowid = symbols_fts.rowid
        WHERE symbols_fts MATCH ?
        ORDER BY score DESC
        LIMIT ?
      `),
      tagsForSymbol: this.db.prepare(
        `SELECT tag FROM tags WHERE symbol_id = ? ORDER BY tag`,
      ),
      getSymbol: this.db.prepare(`
        SELECT id, kind, scheme, path, anchor, line, end_line, parent_id,
               token_size, snippet
        FROM symbols
        WHERE id = ?
      `),
      // Exact tag match. Returns symbols having the tag literally.
      findByTagExact: this.db.prepare(`
        SELECT DISTINCT s.id, s.kind, s.scheme, s.path, s.anchor, s.line,
               s.end_line, s.parent_id, s.token_size, s.snippet
        FROM symbols s
        JOIN tags t ON t.symbol_id = s.id
        WHERE t.tag = ?
        ORDER BY s.path, s.line
        LIMIT ?
      `),
      // Hierarchical prefix match. Returns symbols where any tag equals
      // OR starts with `tag + "/"`.
      findByTagHierarchical: this.db.prepare(`
        SELECT DISTINCT s.id, s.kind, s.scheme, s.path, s.anchor, s.line,
               s.end_line, s.parent_id, s.token_size, s.snippet
        FROM symbols s
        JOIN tags t ON t.symbol_id = s.id
        WHERE t.tag = @tag OR t.tag LIKE @prefix
        ORDER BY s.path, s.line
        LIMIT @limit
      `),
      childrenOfSymbol: this.db.prepare(`
        SELECT id, kind, scheme, path, anchor, line, end_line, parent_id,
               token_size, snippet
        FROM symbols
        WHERE parent_id = ?
        ORDER BY line
      `),
      // Pick the file-kind row (scheme='file') for a given path. We use the
      // file symbol's mtime as the "freshness anchor" for the whole file.
      getFileMtime: this.db.prepare(`
        SELECT mtime_ms FROM symbols
        WHERE path = ? AND scheme = 'file'
        LIMIT 1
      `),
      // Drop all symbols for a path (file + its sections + future code symbols).
      // FK ON DELETE CASCADE handles tags table.
      deleteByPath: this.db.prepare(`DELETE FROM symbols WHERE path = ?`),
      // For stale-file detection: enumerate every path currently in the index.
      distinctIndexedPaths: this.db.prepare(
        `SELECT DISTINCT path FROM symbols`,
      ),
      upsertEmbedding: this.db.prepare(`
        INSERT INTO embeddings (symbol_id, dim, model, vector)
        VALUES (@symbolId, @dim, @model, @vector)
        ON CONFLICT(symbol_id) DO UPDATE SET
          dim=excluded.dim,
          model=excluded.model,
          vector=excluded.vector
      `),
      listEmbeddings: this.db.prepare(`
        SELECT symbol_id, vector FROM embeddings WHERE model = ?
      `),
      countEmbeddings: this.db.prepare(
        `SELECT COUNT(*) AS c FROM embeddings WHERE model = ?`,
      ),
    };
  }

  close(): void {
    this.db.close();
  }

  /**
   * Insert or update a symbol with its tags. Wrapped in a transaction so the
   * symbol and its tags are atomic.
   */
  upsertSymbol = (sym: IndexedSymbol): void => {
    const tx = this.db.transaction((s: IndexedSymbol) => {
      this.stmts.upsertSymbol.run({
        id: s.id,
        kind: s.kind,
        scheme: s.scheme,
        path: s.path,
        anchor: s.anchor,
        line: s.line,
        endLine: s.endLine,
        parentId: s.parentId,
        tokenSize: s.tokenSize,
        snippet: s.snippet,
        mtimeMs: s.mtimeMs,
      });
      this.stmts.deleteTagsFor.run(s.id);
      for (const tag of s.tags) {
        this.stmts.insertTag.run(s.id, tag);
      }
    });
    tx(sym);
  };

  upsertMany(symbols: IndexedSymbol[]): void {
    const tx = this.db.transaction((items: IndexedSymbol[]) => {
      for (const s of items) {
        this.upsertSymbol(s);
      }
    });
    tx(symbols);
  }

  getMtime(symbolId: string): number | null {
    const row = this.stmts.getMtime.get(symbolId) as
      | { mtime_ms: number | null }
      | undefined;
    return row?.mtime_ms ?? null;
  }

  countSymbols(): number {
    const row = this.stmts.countSymbols.get() as { c: number };
    return row.c;
  }

  /**
   * Run an FTS5 MATCH query. Caller is responsible for escaping the query
   * (see escapeFtsQuery below).
   */
  search(ftsQuery: string, limit: number): SearchHit[] {
    const rows = this.stmts.searchFts.all(ftsQuery, limit) as Array<{
      id: string;
      kind: SymbolKind;
      path: string;
      anchor: string | null;
      line: number | null;
      snippet: string | null;
      score: number;
    }>;
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      path: r.path,
      anchor: r.anchor,
      line: r.line,
      snippet: r.snippet,
      tags: (this.stmts.tagsForSymbol.all(r.id) as Array<{ tag: string }>).map(
        (t) => t.tag,
      ),
      bm25: r.score,
    }));
  }

  getSymbolById(id: string): SymbolRow | null {
    const row = this.stmts.getSymbol.get(id) as RawSymbolRow | undefined;
    if (row === undefined) return null;
    return this.hydrateSymbol(row);
  }

  /**
   * Look up symbols by tag.
   *
   * - `hierarchical: true` → matches `tag` exactly OR any tag starting with
   *   `tag + "/"`. So `tracks` finds `tracks/02-asp`, `tracks/02-asp/lit-review`.
   * - `hierarchical: false` → exact match only.
   */
  findByTag(opts: {
    tag: string;
    hierarchical: boolean;
    kind?: string;
    limit: number;
  }): SymbolRow[] {
    const rows =
      opts.hierarchical
        ? (this.stmts.findByTagHierarchical.all({
            tag: opts.tag,
            prefix: opts.tag + "/%",
            limit: opts.limit,
          }) as RawSymbolRow[])
        : (this.stmts.findByTagExact.all(opts.tag, opts.limit) as RawSymbolRow[]);
    const filtered =
      opts.kind === undefined
        ? rows
        : rows.filter((r) => r.kind === opts.kind);
    return filtered.map((r) => this.hydrateSymbol(r));
  }

  childrenOf(parentId: string): SymbolRow[] {
    const rows = this.stmts.childrenOfSymbol.all(parentId) as RawSymbolRow[];
    return rows.map((r) => this.hydrateSymbol(r));
  }

  /**
   * Mtime stored for the file-scheme symbol of `relPath`. Returns null if the
   * file is not indexed yet.
   */
  getFileMtime(relPath: string): number | null {
    const row = this.stmts.getFileMtime.get(relPath) as
      | { mtime_ms: number | null }
      | undefined;
    return row?.mtime_ms ?? null;
  }

  /**
   * Remove all symbols (and their tags via FK cascade) for `relPath`.
   * Returns the number of symbol rows removed.
   */
  deleteByPath(relPath: string): number {
    const info = this.stmts.deleteByPath.run(relPath);
    return Number(info.changes);
  }

  /**
   * All paths currently present in the index. Used to detect files removed
   * from the filesystem since the last scan.
   */
  indexedPaths(): Set<string> {
    const rows = this.stmts.distinctIndexedPaths.all() as Array<{
      path: string;
    }>;
    return new Set(rows.map((r) => r.path));
  }

  /**
   * Store a vector embedding for a symbol. `vector` is a raw Float32 blob.
   */
  upsertEmbedding(opts: {
    symbolId: string;
    dim: number;
    model: string;
    vector: Buffer;
  }): void {
    this.stmts.upsertEmbedding.run(opts);
  }

  /**
   * Stream all embeddings for a given model. Caller decodes the BLOB to a
   * Float32Array. Used by linear-scan retrieve.
   */
  *iterEmbeddings(model: string): Generator<{
    symbolId: string;
    vector: Buffer;
  }> {
    const rows = this.stmts.listEmbeddings.all(model) as Array<{
      symbol_id: string;
      vector: Buffer;
    }>;
    for (const row of rows) {
      yield { symbolId: row.symbol_id, vector: row.vector };
    }
  }

  countEmbeddings(model: string): number {
    const row = this.stmts.countEmbeddings.get(model) as { c: number };
    return row.c;
  }

  private hydrateSymbol(row: RawSymbolRow): SymbolRow {
    const tags = (this.stmts.tagsForSymbol.all(row.id) as Array<{
      tag: string;
    }>).map((t) => t.tag);
    return {
      id: row.id,
      kind: row.kind,
      scheme: row.scheme,
      path: row.path,
      anchor: row.anchor,
      line: row.line,
      endLine: row.end_line,
      parentId: row.parent_id,
      tokenSize: row.token_size,
      snippet: row.snippet,
      tags,
    };
  }

  private ensureSchemaVersion(): void {
    const row = this.db
      .prepare(`SELECT value FROM schema_meta WHERE key = 'schema_version'`)
      .get() as { value: string } | undefined;
    if (row === undefined) {
      this.db
        .prepare(`INSERT INTO schema_meta (key, value) VALUES (?, ?)`)
        .run("schema_version", String(SCHEMA_VERSION));
      return;
    }
    const existing = Number(row.value);
    if (existing === SCHEMA_VERSION) return;

    // Additive upgrade paths. Newer versions add new tables/columns; the
    // SCHEMA_DDL above runs every constructor with `IF NOT EXISTS`, so the
    // physical change is already applied — we only need to bump the meta.
    if (existing === 1 && SCHEMA_VERSION === 2) {
      this.db
        .prepare(`UPDATE schema_meta SET value = ? WHERE key = 'schema_version'`)
        .run(String(SCHEMA_VERSION));
      return;
    }

    throw new Error(
      `Index schema version mismatch: db=${existing}, code=${SCHEMA_VERSION}. ` +
        `Delete .asp/index.db and re-index.`,
    );
  }
}

interface RawSymbolRow {
  id: string;
  kind: SymbolKind;
  scheme: string;
  path: string;
  anchor: string | null;
  line: number | null;
  end_line: number | null;
  parent_id: string | null;
  token_size: number | null;
  snippet: string | null;
}

export const defaultIndexPath = (repoRoot: string): string =>
  join(repoRoot, ".asp", "index.db");

/**
 * Escape FTS5 query string. FTS5 supports a query syntax (AND, OR, NEAR,
 * column filters). For Stage 2a we accept user input as a phrase by default
 * and let users opt into raw FTS syntax via `searchFiles(raw: true)`.
 */
export function escapeFtsPhrase(input: string): string {
  // Wrap in double quotes; double any literal quotes inside.
  return `"${input.replace(/"/g, '""')}"`;
}
