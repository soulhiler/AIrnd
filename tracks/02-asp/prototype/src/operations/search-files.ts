import { z } from "zod";
import type { IndexStore } from "../index/store.js";
import { escapeFtsPhrase } from "../index/store.js";
import type { DegradationEntry } from "../types.js";

/**
 * `asp/searchFiles` — spec Section 6.2.3.
 *
 * Stage 2a: backed by SQLite FTS5 over indexed symbol snippets (markdown
 * file bodies + section snippets). This is fix #1 (offline-first FTS) per
 * GitNexus dogfooding: no external download required.
 *
 * Query semantics:
 *  - Default: phrase match. Input string wrapped in quotes for FTS5.
 *  - `raw: true`: pass through FTS5 query syntax (AND, OR, NEAR, *, ...).
 *  - `regex: true`: pass through to a degraded substring fallback (Stage 2a
 *    does not implement true regex over the FTS index). Returns a degradation
 *    entry.
 */

const SearchParamsSchema = z.object({
  query: z.string().min(1),
  regex: z.boolean().optional(),
  raw: z.boolean().optional(),
  include: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(500).optional(),
  tokenBudget: z.number().int().positive().optional(),
});

export type SearchFilesParams = z.infer<typeof SearchParamsSchema>;

export interface SearchMatch {
  symbolId: string;
  path: string;
  line: number | null;
  anchor: string | null;
  snippet: string;
  score: number;
  tags: string[];
}

export interface SearchFilesResult {
  matches: SearchMatch[];
  truncated: boolean;
  degradation: DegradationEntry[];
}

export interface SearchFilesDeps {
  store: IndexStore;
  indexBuilt: () => boolean;
}

export function makeSearchFilesOp(deps: SearchFilesDeps) {
  return async function searchFilesOp(
    rawParams: unknown,
  ): Promise<SearchFilesResult> {
    const params = SearchParamsSchema.parse(rawParams);
    const limit = params.limit ?? 25;
    const degradation: DegradationEntry[] = [];

    if (!deps.indexBuilt()) {
      degradation.push({
        feature: "partial-index",
        reason: "Initial repository scan has not completed",
        impact: "Some matches may be missing; results will be more complete after asp/refresh",
        severity: "warning",
      });
    }

    if (params.regex === true) {
      degradation.push({
        feature: "regex-search",
        reason: "Regex search is not supported in Stage 2a (FTS5 only)",
        impact: "Query was treated as a phrase; pattern characters interpreted literally",
        severity: "warning",
      });
    }

    const ftsQuery =
      params.raw === true ? params.query : escapeFtsPhrase(params.query);

    let hits;
    try {
      hits = deps.store.search(ftsQuery, limit);
    } catch (e) {
      // FTS5 raises SQLITE_ERROR on malformed queries (e.g. unbalanced quotes).
      degradation.push({
        feature: "fts",
        reason: `FTS5 query parse error: ${(e as Error).message}`,
        impact: "No results returned for this query; try with raw=false or simpler input",
        severity: "error",
      });
      return { matches: [], truncated: false, degradation };
    }

    // Filter by include globs if provided.
    let filtered = hits;
    if (params.include !== undefined && params.include.length > 0) {
      const regexes = params.include.map(globToRegex);
      filtered = hits.filter((h) => regexes.some((r) => r.test(h.path)));
    }

    const matches: SearchMatch[] = filtered.map((h) => ({
      symbolId: h.id,
      path: h.path,
      line: h.line,
      anchor: h.anchor,
      snippet: h.snippet ?? "",
      score: h.bm25,
      tags: h.tags,
    }));

    // Token-budget enforcement: keep matches until budget exhausted.
    let truncated = false;
    if (params.tokenBudget !== undefined) {
      const out: SearchMatch[] = [];
      let used = 0;
      for (const m of matches) {
        const cost = Math.ceil((m.snippet.length + m.path.length) / 3.5);
        if (used + cost > params.tokenBudget && out.length > 0) {
          truncated = true;
          break;
        }
        used += cost;
        out.push(m);
      }
      return { matches: out, truncated, degradation };
    }

    return { matches, truncated, degradation };
  };
}

function globToRegex(glob: string): RegExp {
  let pattern = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        pattern += ".*";
        i++;
      } else {
        pattern += "[^/]*";
      }
    } else if (c === "?") {
      pattern += "[^/]";
    } else if (c === "." || c === "+" || c === "(" || c === ")" || c === "|") {
      pattern += "\\" + c;
    } else {
      pattern += c;
    }
  }
  return new RegExp(`^${pattern}$`);
}
