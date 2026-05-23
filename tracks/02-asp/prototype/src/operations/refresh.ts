import { z } from "zod";
import { fullScan, type IndexStats } from "../index/indexer.js";
import { globalJobs } from "../index/jobs.js";
import type { IndexStore } from "../index/store.js";
import type { DegradationEntry } from "../types.js";

/**
 * `asp/refresh` — spec Section 6.4.3.
 *
 * Stage 2c (full support):
 *  - scope: "full" | "incremental"
 *  - paths: optional scope to specific subtrees
 *  - wait: false → returns a jobId immediately, scan runs in background
 *  - asp/refreshStatus(jobId) polls completion
 */

const RefreshParamsSchema = z.object({
  scope: z.enum(["incremental", "full"]).optional(),
  paths: z.array(z.string()).optional(),
  wait: z.boolean().optional(),
  embed: z.boolean().optional(),
});

export type RefreshParams = z.infer<typeof RefreshParamsSchema>;

export interface RefreshResult {
  completed: boolean;
  jobId?: string;
  filesProcessed?: number;
  filesSkipped?: number;
  filesRemoved?: number;
  symbolsIndexed?: number;
  edgesResolved?: number;
  durationMs?: number;
  truncated: boolean;
  degradation: DegradationEntry[];
}

export interface RefreshDeps {
  store: IndexStore;
  repoRoot: string;
  /** Default whether to compute embeddings; overridable per call. */
  embedByDefault?: boolean;
  onComplete?: () => void;
}

export function makeRefreshOp(deps: RefreshDeps) {
  return async function refreshOp(rawParams: unknown): Promise<RefreshResult> {
    const params = RefreshParamsSchema.parse(rawParams);
    const wait = params.wait ?? true;
    const scope = params.scope ?? "full";
    const degradation: DegradationEntry[] = [];

    const embedRequested = params.embed ?? deps.embedByDefault ?? false;
    const scanOpts = {
      root: deps.repoRoot,
      store: deps.store,
      incremental: scope === "incremental",
      embed: embedRequested,
      ...(params.paths !== undefined && { paths: params.paths }),
    };

    if (wait) {
      const stats = await fullScan(scanOpts);
      if (deps.onComplete !== undefined) deps.onComplete();
      return {
        completed: true,
        filesProcessed: stats.filesProcessed,
        filesSkipped: stats.filesSkipped,
        filesRemoved: stats.filesRemoved,
        symbolsIndexed: stats.symbolsIndexed,
        edgesResolved: stats.edgesResolved,
        durationMs: stats.durationMs,
        truncated: false,
        degradation,
      };
    }

    // Async path: queue the job, return immediately.
    const job = globalJobs.create<IndexStats>("refresh");
    void runJob(job.jobId, scanOpts, deps.onComplete);
    return {
      completed: false,
      jobId: job.jobId,
      truncated: false,
      degradation,
    };
  };
}

async function runJob(
  jobId: string,
  scanOpts: Parameters<typeof fullScan>[0],
  onComplete?: () => void,
): Promise<void> {
  globalJobs.start(jobId);
  try {
    const stats = await fullScan(scanOpts);
    globalJobs.complete(jobId, stats);
    if (onComplete !== undefined) onComplete();
  } catch (e) {
    globalJobs.fail(jobId, (e as Error).message);
  }
}

/* ------------------------ asp/refreshStatus ------------------------ */

const RefreshStatusParamsSchema = z.object({
  jobId: z.string().min(1),
});

export interface RefreshStatusResult {
  jobId: string;
  status: "pending" | "running" | "complete" | "failed";
  stats?: IndexStats;
  error?: string;
  degradation: DegradationEntry[];
}

export async function refreshStatusOp(
  rawParams: unknown,
): Promise<RefreshStatusResult> {
  const params = RefreshStatusParamsSchema.parse(rawParams);
  const job = globalJobs.get<IndexStats>(params.jobId);
  if (job === undefined) {
    return {
      jobId: params.jobId,
      status: "failed",
      error: "Job not found (or evicted by gc)",
      degradation: [],
    };
  }
  return {
    jobId: job.jobId,
    status: job.status,
    ...(job.result !== undefined && { stats: job.result }),
    ...(job.error !== undefined && { error: job.error }),
    degradation: [],
  };
}
