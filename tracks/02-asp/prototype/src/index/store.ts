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
    if (existing !== SCHEMA_VERSION) {
      throw new Error(
        `Index schema version mismatch: db=${existing}, code=${SCHEMA_VERSION}. ` +
          `Delete .asp/index.db and re-index.`,
      );
    }
  }
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
