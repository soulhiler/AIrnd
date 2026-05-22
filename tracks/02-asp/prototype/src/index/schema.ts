/**
 * SQLite schema for Stage 2a indexer (per ADR 0007).
 *
 * - `symbols`: one row per indexed unit (file or markdown section).
 * - `tags`: many-to-many between symbols and tags (slash-separated paths).
 * - `symbols_fts`: external-content FTS5 virtual table over symbols.snippet.
 *
 * Future stages will extend:
 *  - 2a part 2: tree-sitter for code symbols (function/class/method rows).
 *  - 2b: vector embeddings (separate store, likely LanceDB rather than vss).
 *  - 2c: graph edges (references / referents) for asp/impact.
 */
export const SCHEMA_VERSION = 3;

export const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS symbols (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  scheme TEXT NOT NULL,
  path TEXT NOT NULL,
  anchor TEXT,
  line INTEGER,
  end_line INTEGER,
  parent_id TEXT,
  token_size INTEGER,
  snippet TEXT,
  mtime_ms INTEGER,
  FOREIGN KEY (parent_id) REFERENCES symbols(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_symbols_path ON symbols(path);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_symbols_parent ON symbols(parent_id);

CREATE TABLE IF NOT EXISTS tags (
  symbol_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (symbol_id, tag),
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);

-- Stage 2b: per-symbol vector embeddings. Stored as a raw Float32 blob for
-- compactness; cosine similarity is computed in TypeScript via linear scan
-- (acceptable for ≤ ~50k symbols). When repos outgrow that, swap in
-- sqlite-vec or LanceDB.
CREATE TABLE IF NOT EXISTS embeddings (
  symbol_id TEXT PRIMARY KEY,
  dim INTEGER NOT NULL,
  model TEXT NOT NULL,
  vector BLOB NOT NULL,
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
);

-- Stage 2c: symbol relationships (call/extends/uses/imports). Edges are
-- best-effort: code-indexer collects (src_id, dst_name, kind) tuples while
-- walking the AST, then the indexer resolves dst_name to symbol IDs by
-- anchor match (over-approximating when multiple symbols share a name).
-- Precise name resolution belongs in an LSP-style server; this layer trades
-- precision for offline simplicity.
CREATE TABLE IF NOT EXISTS edges (
  src_symbol_id TEXT NOT NULL,
  dst_symbol_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  PRIMARY KEY (src_symbol_id, dst_symbol_id, kind),
  FOREIGN KEY (src_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  FOREIGN KEY (dst_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_edges_src ON edges(src_symbol_id);
CREATE INDEX IF NOT EXISTS idx_edges_dst ON edges(dst_symbol_id);

-- FTS5 over symbol snippets and IDs. We use external-content storage so
-- that updates to the symbols table cascade via triggers below.
CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
  id UNINDEXED,
  path,
  anchor,
  snippet,
  content='symbols',
  content_rowid='rowid'
);

-- Triggers to keep symbols_fts in sync with symbols.
CREATE TRIGGER IF NOT EXISTS symbols_fts_insert
AFTER INSERT ON symbols BEGIN
  INSERT INTO symbols_fts(rowid, id, path, anchor, snippet)
  VALUES (new.rowid, new.id, new.path, COALESCE(new.anchor, ''), COALESCE(new.snippet, ''));
END;

CREATE TRIGGER IF NOT EXISTS symbols_fts_delete
AFTER DELETE ON symbols BEGIN
  INSERT INTO symbols_fts(symbols_fts, rowid, id, path, anchor, snippet)
  VALUES ('delete', old.rowid, old.id, old.path, COALESCE(old.anchor, ''), COALESCE(old.snippet, ''));
END;

CREATE TRIGGER IF NOT EXISTS symbols_fts_update
AFTER UPDATE ON symbols BEGIN
  INSERT INTO symbols_fts(symbols_fts, rowid, id, path, anchor, snippet)
  VALUES ('delete', old.rowid, old.id, old.path, COALESCE(old.anchor, ''), COALESCE(old.snippet, ''));
  INSERT INTO symbols_fts(rowid, id, path, anchor, snippet)
  VALUES (new.rowid, new.id, new.path, COALESCE(new.anchor, ''), COALESCE(new.snippet, ''));
END;
`;
