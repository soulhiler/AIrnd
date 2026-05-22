import { z } from "zod";
import type { IndexStore, SymbolRow } from "../index/store.js";
import type { DegradationEntry, Symbol as AspSymbol } from "../types.js";

/**
 * `asp/findByTag` — spec Section 6.3.1.
 *
 * Hierarchical prefix matching backed by the `tags` table. Per ADR 0004:
 * `hierarchical: true` (default) finds all symbols whose tag equals OR begins
 * with `tag + "/"`.
 */

const FindByTagParamsSchema = z.object({
  tag: z.string().min(1).regex(/^[\w-]+(\/[\w-]+)*$/u, "Invalid tag format"),
  hierarchical: z.boolean().optional(),
  kind: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
  tokenBudget: z.number().int().positive().optional(),
});

export type FindByTagParams = z.infer<typeof FindByTagParamsSchema>;

export interface FindByTagResult {
  symbols: AspSymbol[];
  totalMatches: number;
  truncated: boolean;
  degradation: DegradationEntry[];
}

export interface FindByTagDeps {
  store: IndexStore;
  indexBuilt: () => boolean;
}

export function makeFindByTagOp(deps: FindByTagDeps) {
  return async function findByTagOp(
    rawParams: unknown,
  ): Promise<FindByTagResult> {
    const params = FindByTagParamsSchema.parse(rawParams);
    const limit = params.limit ?? 100;
    const hierarchical = params.hierarchical ?? true;
    const degradation: DegradationEntry[] = [];

    if (!deps.indexBuilt()) {
      degradation.push({
        feature: "partial-index",
        reason: "Initial repository scan has not completed",
        impact: "Some matches may be missing",
        severity: "warning",
      });
    }

    const rows = deps.store.findByTag({
      tag: params.tag,
      hierarchical,
      ...(params.kind !== undefined && { kind: params.kind }),
      limit,
    });

    const symbols: AspSymbol[] = rows.map(symbolRowToAsp);
    const totalMatches = symbols.length; // limit-bounded; full count would need a separate query

    let truncated = false;
    let final = symbols;
    if (params.tokenBudget !== undefined) {
      const out: AspSymbol[] = [];
      let used = 0;
      for (const s of symbols) {
        const cost = approxTokenCost(s);
        if (used + cost > params.tokenBudget && out.length > 0) {
          truncated = true;
          break;
        }
        used += cost;
        out.push(s);
      }
      final = out;
    }

    return {
      symbols: final,
      totalMatches,
      truncated,
      degradation,
    };
  };
}

export function symbolRowToAsp(row: SymbolRow): AspSymbol {
  const sym: AspSymbol = {
    id: row.id,
    kind: row.kind,
  };
  if (row.tags.length > 0) sym.tags = row.tags;
  if (row.path) {
    const loc: AspSymbol["location"] = { path: row.path };
    if (row.line !== null) loc!.line = row.line;
    if (row.endLine !== null) loc!.endLine = row.endLine;
    sym.location = loc;
  }
  if (row.parentId !== null) sym.parent = row.parentId;
  if (row.tokenSize !== null) sym.tokenSize = row.tokenSize;
  if (row.snippet !== null && row.snippet.length > 0) {
    sym.snippet = row.snippet;
  }
  return sym;
}

function approxTokenCost(s: AspSymbol): number {
  const idLen = s.id.length;
  const snippetLen = s.snippet?.length ?? 0;
  const tagsLen = (s.tags ?? []).reduce((n, t) => n + t.length + 2, 0);
  return Math.ceil((idLen + snippetLen + tagsLen) / 3.5);
}
