/**
 * Job registry — backed by SQLite for persistence across server restarts
 * (Stage 2c+). Pure in-memory operation is still possible via passing
 * `null` to the constructor, but the default `globalJobs` uses the active
 * IndexStore.
 */
import { randomUUID } from "node:crypto";
import type { IndexStore } from "./store.js";

export type JobStatus = "pending" | "running" | "complete" | "failed";

export interface JobRecord<T = unknown> {
  jobId: string;
  kind: string;
  status: JobStatus;
  startedAt: number;
  completedAt?: number;
  result?: T;
  error?: string;
}

export class JobRegistry {
  // In-memory mirror for fast access; SQLite is source of truth.
  private readonly cache = new Map<string, JobRecord>();
  private store: IndexStore | null = null;

  /** Wire the registry up to a persistent backing store. Idempotent. */
  bind(store: IndexStore): void {
    this.store = store;
  }

  create<T>(kind: string): JobRecord<T> {
    const record: JobRecord<T> = {
      jobId: `job-${randomUUID()}`,
      kind,
      status: "pending",
      startedAt: Date.now(),
    };
    this.cache.set(record.jobId, record as JobRecord);
    this.persist(record);
    return record;
  }

  start(jobId: string): void {
    const job = this.cache.get(jobId);
    if (job === undefined) return;
    job.status = "running";
    this.persist(job);
  }

  complete<T>(jobId: string, result: T): void {
    const job = this.cache.get(jobId) as JobRecord<T> | undefined;
    if (job === undefined) return;
    job.status = "complete";
    job.result = result;
    job.completedAt = Date.now();
    this.persist(job);
  }

  fail(jobId: string, error: string): void {
    const job = this.cache.get(jobId);
    if (job === undefined) return;
    job.status = "failed";
    job.error = error;
    job.completedAt = Date.now();
    this.persist(job);
  }

  get<T>(jobId: string): JobRecord<T> | undefined {
    const cached = this.cache.get(jobId) as JobRecord<T> | undefined;
    if (cached !== undefined) return cached;
    if (this.store === null) return undefined;
    const row = this.store.getJob(jobId);
    if (row === null) return undefined;
    const out: JobRecord<T> = {
      jobId: row.job_id,
      kind: row.kind,
      status: row.status as JobStatus,
      startedAt: row.started_at,
    };
    if (row.completed_at !== null) out.completedAt = row.completed_at;
    if (row.result_json !== null) {
      try {
        out.result = JSON.parse(row.result_json) as T;
      } catch {
        // ignore malformed; the job still surfaces its status/error
      }
    }
    if (row.error !== null) out.error = row.error;
    this.cache.set(jobId, out as JobRecord);
    return out;
  }

  gc(maxAgeMs: number = 60 * 60 * 1000): void {
    // Memory cache
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, job] of this.cache) {
      if (
        (job.status === "complete" || job.status === "failed") &&
        (job.completedAt ?? job.startedAt) < cutoff
      ) {
        this.cache.delete(id);
      }
    }
    if (this.store !== null) this.store.pruneOldJobs(maxAgeMs);
  }

  private persist(job: JobRecord): void {
    if (this.store === null) return;
    this.store.upsertJob({
      jobId: job.jobId,
      kind: job.kind,
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt ?? null,
      resultJson: job.result !== undefined ? JSON.stringify(job.result) : null,
      error: job.error ?? null,
    });
  }
}

export const globalJobs = new JobRegistry();
