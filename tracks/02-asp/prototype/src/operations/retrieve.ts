import { z } from "zod";
import type { IndexStore } from "../index/store.js";
import {
  DEFAULT_MODEL,
  blobToVector,
  cosineSimilarity,
  embed,
  embeddingsAvailable,
  ensureEmbeddingsReady,
  makeUnavailableDegradation,
} from "../index/embeddings.js";
import { escapeFtsPhrase } from "../index/store.js";
import { symbolRowToAsp } from "./find-by-tag.js";
import type { DegradationEntry, Symbol as AspSymbol } from "../types.js";

/**
 * `asp/retrieve` — spec Section 6.3.2.
 *
 * Two-stage retrieval (Continue.dev-style nRetrieve → nFinal):
 *  - Stage 1: candidates from the selected retrieval `mode`
 *    (`vector` | `keyword` | `hybrid`).
 *  - Stage 2: optional LLM rerank (not implemented in Stage 2b → returns
 *    `rerank` degradation when requested).
 *
 * If embeddings are unavailable (model not loaded, no network/cache), we
 * fall back to keyword search and emit an `embeddings` degradation entry.
 */

const RetrieveParamsSchema = z.object({
  query: z.string().min(1),
  mode: z.enum(["vector", "keyword", "hybrid"]).optional(),
  nRetrieve: z.number().int().positive().max(500).optional(),
  nFinal: z.number().int().positive().max(500).optional(),
  rerank: z.boolean().optional(),
  filter: z
    .object({
      tags: z.array(z.string()).optional(),
      kind: z.string().optional(),
      pathPrefix: z.string().optional(),
    })
    .optional(),
  tokenBudget: z.number().int().positive().optional(),
});

export type RetrieveParams = z.infer<typeof RetrieveParamsSchema>;

export interface RetrievedSymbol extends AspSymbol {
  score: number;
}

export interface RetrieveResult {
  symbols: RetrievedSymbol[];
  truncated: boolean;
  modeUsed: "vector" | "keyword" | "hybrid";
  rerankApplied: boolean;
  degradation: DegradationEntry[];
}

export interface RetrieveDeps {
  store: IndexStore;
  indexBuilt: () => boolean;
}

export function makeRetrieveOp(deps: RetrieveDeps) {
  return async function retrieveOp(rawParams: unknown): Promise<RetrieveResult> {
    const params = RetrieveParamsSchema.parse(rawParams);
    const requestedMode = params.mode ?? "hybrid";
    const nRetrieve = params.nRetrieve ?? 50;
    const nFinal = params.nFinal ?? 10;
    const wantsRerank = params.rerank === true;
    const degradation: DegradationEntry[] = [];

    if (!deps.indexBuilt()) {
      degradation.push({
        feature: "partial-index",
        reason: "Initial repository scan has not completed",
        impact: "Some matches may be missing",
        severity: "warning",
      });
    }

    // Mode resolution: requested → actual based on availability.
    let actualMode: "vector" | "keyword" | "hybrid" = requestedMode;
    if (requestedMode === "vector" || requestedMode === "hybrid") {
      await ensureEmbeddingsReady();
      if (!embeddingsAvailable()) {
        degradation.push(makeUnavailableDegradation());
        actualMode = "keyword";
      }
    }

    // Stage 1: gather candidates.
    let candidates: Array<{ symbolId: string; score: number }>;
    if (actualMode === "vector") {
      candidates = await vectorSearch(deps.store, params.query, nRetrieve);
    } else if (actualMode === "keyword") {
      candidates = keywordSearch(deps.store, params.query, nRetrieve);
    } else {
      // hybrid: reciprocal rank fusion of keyword + vector
      const [k, v] = await Promise.all([
        Promise.resolve(keywordSearch(deps.store, params.query, nRetrieve)),
        vectorSearch(deps.store, params.query, nRetrieve),
      ]);
      candidates = reciprocalRankFusion(k, v).slice(0, nRetrieve);
    }

    // Stage 2: rerank — not implemented in Stage 2b. Honour the request by
    // tagging the response with a clear degradation entry.
    let rerankApplied = false;
    if (wantsRerank) {
      degradation.push({
        feature: "rerank",
        reason:
          "LLM-based rerank is not implemented in Stage 2b (planned: ADR follow-up)",
        impact:
          "Results are ordered by first-stage ranking only (vector / keyword similarity)",
        severity: "info",
      });
    }

    // Hydrate symbols and apply filters.
    const filter = params.filter;
    const out: RetrievedSymbol[] = [];
    for (const c of candidates) {
      if (out.length >= nFinal) break;
      const row = deps.store.getSymbolById(c.symbolId);
      if (row === null) continue;
      if (filter !== undefined) {
        if (filter.kind !== undefined && row.kind !== filter.kind) continue;
        if (
          filter.pathPrefix !== undefined &&
          !row.path.startsWith(filter.pathPrefix)
        ) {
          continue;
        }
        if (filter.tags !== undefined) {
          const tagSet = new Set(row.tags);
          const ok = filter.tags.every((t) => tagSet.has(t));
          if (!ok) continue;
        }
      }
      const sym = symbolRowToAsp(row) as RetrievedSymbol;
      sym.score = c.score;
      out.push(sym);
    }

    // Token-budget enforcement (apply after Stage 2 placeholder).
    let truncated = false;
    let final = out;
    if (params.tokenBudget !== undefined) {
      const kept: RetrievedSymbol[] = [];
      let used = 0;
      for (const s of out) {
        const cost = approxTokenCost(s);
        if (used + cost > params.tokenBudget && kept.length > 0) {
          truncated = true;
          break;
        }
        used += cost;
        kept.push(s);
      }
      final = kept;
    }

    return {
      symbols: final,
      truncated,
      modeUsed: actualMode,
      rerankApplied,
      degradation,
    };
  };
}

async function vectorSearch(
  store: IndexStore,
  query: string,
  k: number,
): Promise<Array<{ symbolId: string; score: number }>> {
  const queryVec = await embed(query);
  if (queryVec === null) return [];
  const scored: Array<{ symbolId: string; score: number }> = [];
  for (const row of store.iterEmbeddings(DEFAULT_MODEL)) {
    const v = blobToVector(row.vector);
    const sim = cosineSimilarity(queryVec, v);
    scored.push({ symbolId: row.symbolId, score: sim });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

function keywordSearch(
  store: IndexStore,
  query: string,
  k: number,
): Array<{ symbolId: string; score: number }> {
  try {
    const hits = store.search(escapeFtsPhrase(query), k);
    return hits.map((h) => ({ symbolId: h.id, score: h.bm25 }));
  } catch {
    return [];
  }
}

/**
 * Reciprocal Rank Fusion (k=60 by tradition). Combines two ranked lists by
 * summing `1 / (rank + 60)` across both. Robust, doesn't require score
 * calibration between disparate signals (BM25 vs cosine).
 */
function reciprocalRankFusion(
  a: Array<{ symbolId: string; score: number }>,
  b: Array<{ symbolId: string; score: number }>,
): Array<{ symbolId: string; score: number }> {
  const K = 60;
  const accum = new Map<string, number>();
  a.forEach((item, idx) => {
    const r = 1 / (idx + 1 + K);
    accum.set(item.symbolId, (accum.get(item.symbolId) ?? 0) + r);
  });
  b.forEach((item, idx) => {
    const r = 1 / (idx + 1 + K);
    accum.set(item.symbolId, (accum.get(item.symbolId) ?? 0) + r);
  });
  return [...accum.entries()]
    .map(([symbolId, score]) => ({ symbolId, score }))
    .sort((x, y) => y.score - x.score);
}

function approxTokenCost(s: AspSymbol): number {
  const idLen = s.id.length;
  const snippetLen = s.snippet?.length ?? 0;
  const tagsLen = (s.tags ?? []).reduce((n, t) => n + t.length + 2, 0);
  return Math.ceil((idLen + snippetLen + tagsLen) / 3.5);
}
