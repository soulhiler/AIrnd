import { z } from "zod";
import type { IndexStore } from "../index/store.js";
import { symbolRowToAsp } from "./find-by-tag.js";
import type { DegradationEntry, Symbol as AspSymbol } from "../types.js";

/**
 * `asp/impact` — spec Section 6.3.4.
 *
 * Best-effort blast-radius computation over the edges built by code-indexer.
 *  - `downstream`: who is affected if this symbol changes (BFS over incoming
 *    edges — callers of the target, transitively).
 *  - `upstream`: what the symbol depends on (BFS over outgoing edges).
 *
 * Edge resolution is over-approximating (same-name match), so impact may
 * include false positives. The response advertises this via a degradation
 * entry whenever the result set is non-empty.
 */

const ImpactParamsSchema = z.object({
  symbol: z.string().min(1),
  direction: z.enum(["upstream", "downstream", "both"]).optional(),
  maxDepth: z.number().int().positive().max(10).optional(),
  tokenBudget: z.number().int().positive().optional(),
});

export type ImpactParams = z.infer<typeof ImpactParamsSchema>;

export interface ImpactAffected extends AspSymbol {
  depth: number;
  edgeKind: string;
}

export interface ImpactResult {
  symbol: string;
  upstream: ImpactAffected[];
  downstream: ImpactAffected[];
  riskLevel: "low" | "medium" | "high";
  totalAffected: number;
  truncated: boolean;
  degradation: DegradationEntry[];
}

export interface ImpactDeps {
  store: IndexStore;
  indexBuilt: () => boolean;
}

export function makeImpactOp(deps: ImpactDeps) {
  return async function impactOp(rawParams: unknown): Promise<ImpactResult> {
    const params = ImpactParamsSchema.parse(rawParams);
    const direction = params.direction ?? "downstream";
    const maxDepth = params.maxDepth ?? 3;
    const degradation: DegradationEntry[] = [];

    if (!deps.indexBuilt()) {
      degradation.push({
        feature: "partial-index",
        reason: "Initial repository scan has not completed",
        impact: "Some edges may be missing",
        severity: "warning",
      });
    }

    const root = deps.store.getSymbolById(params.symbol);
    if (root === null) {
      return {
        symbol: params.symbol,
        upstream: [],
        downstream: [],
        riskLevel: "low",
        totalAffected: 0,
        truncated: false,
        degradation,
      };
    }

    let downstream: ImpactAffected[] = [];
    let upstream: ImpactAffected[] = [];

    if (direction === "downstream" || direction === "both") {
      downstream = bfs(deps.store, params.symbol, maxDepth, "incoming");
    }
    if (direction === "upstream" || direction === "both") {
      upstream = bfs(deps.store, params.symbol, maxDepth, "outgoing");
    }

    const total = downstream.length + upstream.length;
    const riskLevel: ImpactResult["riskLevel"] =
      total > 20 ? "high" : total >= 5 ? "medium" : "low";

    if (total > 0) {
      degradation.push({
        feature: "edge-resolution",
        reason:
          "Edges are resolved by anchor name match, which over-approximates when multiple symbols share a name",
        impact:
          "Some affected symbols may be false positives; precise resolution requires LSP-style name resolution (Stage 2c follow-up)",
        severity: "info",
      });
    }

    // Apply token budget to the combined output.
    let truncated = false;
    let truncatedDownstream = downstream;
    let truncatedUpstream = upstream;
    if (params.tokenBudget !== undefined) {
      const cap = params.tokenBudget;
      let used = 0;
      const trimList = (list: ImpactAffected[]): ImpactAffected[] => {
        const out: ImpactAffected[] = [];
        for (const item of list) {
          const cost = approxCost(item);
          if (used + cost > cap && out.length > 0) {
            truncated = true;
            break;
          }
          used += cost;
          out.push(item);
        }
        return out;
      };
      truncatedDownstream = trimList(downstream);
      truncatedUpstream = trimList(upstream);
    }

    return {
      symbol: params.symbol,
      upstream: truncatedUpstream,
      downstream: truncatedDownstream,
      riskLevel,
      totalAffected: total,
      truncated,
      degradation,
    };
  };
}

function bfs(
  store: IndexStore,
  rootId: string,
  maxDepth: number,
  direction: "incoming" | "outgoing",
): ImpactAffected[] {
  const visited = new Set<string>([rootId]);
  const queue: Array<{ id: string; depth: number; edgeKind: string }> = [];
  // Seed with neighbours of root.
  const seedEdges =
    direction === "incoming"
      ? store.edgesToSymbol(rootId).map((e) => ({ id: e.src, kind: e.kind }))
      : store.edgesFromSymbol(rootId).map((e) => ({ id: e.dst, kind: e.kind }));
  for (const e of seedEdges) {
    if (visited.has(e.id)) continue;
    queue.push({ id: e.id, depth: 1, edgeKind: e.kind });
    visited.add(e.id);
  }

  const out: ImpactAffected[] = [];
  while (queue.length > 0) {
    const next = queue.shift()!;
    const row = store.getSymbolById(next.id);
    if (row === null) continue;
    const sym = symbolRowToAsp(row) as ImpactAffected;
    sym.depth = next.depth;
    sym.edgeKind = next.edgeKind;
    out.push(sym);

    if (next.depth >= maxDepth) continue;
    const nextEdges =
      direction === "incoming"
        ? store.edgesToSymbol(next.id).map((e) => ({ id: e.src, kind: e.kind }))
        : store.edgesFromSymbol(next.id).map((e) => ({
            id: e.dst,
            kind: e.kind,
          }));
    for (const e of nextEdges) {
      if (visited.has(e.id)) continue;
      visited.add(e.id);
      queue.push({ id: e.id, depth: next.depth + 1, edgeKind: e.kind });
    }
  }
  return out;
}

function approxCost(s: AspSymbol): number {
  const idLen = s.id.length;
  const snippetLen = s.snippet?.length ?? 0;
  const tagsLen = (s.tags ?? []).reduce((n, t) => n + t.length + 2, 0);
  return Math.ceil((idLen + snippetLen + tagsLen) / 3.5);
}
