import { z } from "zod";
import type { IndexStore } from "../index/store.js";
import { symbolRowToAsp } from "./find-by-tag.js";
import type { DegradationEntry, Symbol as AspSymbol } from "../types.js";

/**
 * `asp/context` — spec Section 6.3.3.
 *
 * Returns rich context for a single symbol: its full record (with tags and
 * location), its parent, and its direct children (sections within a section,
 * etc.). True reference/referent edges land in Stage 2c (graph indexing).
 */

const ContextParamsSchema = z.object({
  symbol: z.string().min(1),
  includeReferences: z.boolean().optional(),
  includeReferents: z.boolean().optional(),
  includeBody: z.boolean().optional(),
  tokenBudget: z.number().int().positive().optional(),
});

export type ContextParams = z.infer<typeof ContextParamsSchema>;

export interface ContextResult {
  symbol: AspSymbol | null;
  parent: AspSymbol | null;
  children: AspSymbol[];
  body: string | null;
  references: AspSymbol[];
  referents: AspSymbol[];
  truncated: boolean;
  degradation: DegradationEntry[];
}

export interface ContextDeps {
  store: IndexStore;
  indexBuilt: () => boolean;
}

export function makeContextOp(deps: ContextDeps) {
  return async function contextOp(rawParams: unknown): Promise<ContextResult> {
    const params = ContextParamsSchema.parse(rawParams);
    const degradation: DegradationEntry[] = [];

    if (!deps.indexBuilt()) {
      degradation.push({
        feature: "partial-index",
        reason: "Initial repository scan has not completed",
        impact: "Symbol may not be indexed yet",
        severity: "warning",
      });
    }

    const includeBody = params.includeBody ?? true;
    const wantsReferences = params.includeReferences === true;
    const wantsReferents = params.includeReferents === true;

    // References / referents need a graph index (Stage 2c). Advertise as
    // a degradation if the caller requested them.
    if (wantsReferences || wantsReferents) {
      degradation.push({
        feature: "graph-index",
        reason:
          "Symbol graph (references / referents) is not built in Stage 2a",
        impact:
          "References and referents are returned empty; available in Stage 2c",
        severity: "info",
      });
    }

    const row = deps.store.getSymbolById(params.symbol);
    if (row === null) {
      return {
        symbol: null,
        parent: null,
        children: [],
        body: null,
        references: [],
        referents: [],
        truncated: false,
        degradation,
      };
    }

    const symbol = symbolRowToAsp(row);
    const parent =
      row.parentId !== null
        ? (() => {
            const p = deps.store.getSymbolById(row.parentId!);
            return p === null ? null : symbolRowToAsp(p);
          })()
        : null;
    const children = deps.store.childrenOf(row.id).map(symbolRowToAsp);

    let body: string | null = null;
    if (includeBody) {
      body = row.snippet ?? null;
      if (
        body !== null &&
        params.tokenBudget !== undefined
      ) {
        const maxChars = Math.floor(params.tokenBudget * 3.5);
        if (body.length > maxChars) {
          body = body.slice(0, maxChars);
        }
      }
    }

    return {
      symbol,
      parent,
      children,
      body,
      references: [],
      referents: [],
      truncated: false,
      degradation,
    };
  };
}
