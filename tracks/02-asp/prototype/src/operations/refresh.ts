import { z } from "zod";
import { fullScan } from "../index/indexer.js";
import type { IndexStore } from "../index/store.js";
import type { DegradationEntry } from "../types.js";

/**
 * `asp/refresh` — spec Section 6.4.3.
 *
 * Stage 2a implementation: synchronous full scan (`wait: true` only). Async
 * job mode (`wait: false`) and incremental scope handling land in Stage 2b.
 */

const RefreshParamsSchema = z.object({
  scope: z.enum(["incremental", "full"]).optional(),
  paths: z.array(z.string()).optional(),
  wait: z.boolean().optional(),
});

export type RefreshParams = z.infer<typeof RefreshParamsSchema>;

export interface RefreshResult {
  completed: boolean;
  filesProcessed: number;
  filesSkipped: number;
  filesRemoved: number;
  symbolsIndexed: number;
  durationMs: number;
  truncated: boolean;
  degradation: DegradationEntry[];
}

export interface RefreshDeps {
  store: IndexStore;
  repoRoot: string;
  onComplete?: () => void;
}

export function makeRefreshOp(deps: RefreshDeps) {
  return async function refreshOp(rawParams: unknown): Promise<RefreshResult> {
    const params = RefreshParamsSchema.parse(rawParams);
    const wait = params.wait ?? true;
    const scope = params.scope ?? "full";
    const degradation: DegradationEntry[] = [];

    if (params.paths !== undefined && params.paths.length > 0) {
      degradation.push({
        feature: "scoped-refresh",
        reason: "Path-scoped refresh is not implemented in Stage 2a",
        impact: "Provided paths are ignored; performing a full rescan",
        severity: "info",
      });
    }
    if (!wait) {
      degradation.push({
        feature: "async-refresh",
        reason: "Asynchronous refresh (wait=false) is not implemented in Stage 2a",
        impact: "Operation will block until the rescan completes",
        severity: "info",
      });
    }

    const stats = await fullScan({
      root: deps.repoRoot,
      store: deps.store,
      incremental: scope === "incremental",
    });
    if (deps.onComplete !== undefined) deps.onComplete();

    return {
      completed: true,
      filesProcessed: stats.filesProcessed,
      filesSkipped: stats.filesSkipped,
      filesRemoved: stats.filesRemoved,
      symbolsIndexed: stats.symbolsIndexed,
      durationMs: stats.durationMs,
      truncated: false,
      degradation,
    };
  };
}
