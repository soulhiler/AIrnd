/**
 * Minimal in-process job registry for async operations (Stage 2c+).
 *
 * Jobs are not persistent: if the server restarts, all jobs are lost. This is
 * acceptable for `asp/refresh` because clients can simply re-issue the scan.
 * Persistent jobs land alongside streaming notifications (v0.2 spec).
 */
import { randomUUID } from "node:crypto";

export type JobStatus = "pending" | "running" | "complete" | "failed";

export interface JobRecord<T = unknown> {
  jobId: string;
  status: JobStatus;
  startedAt: number;
  completedAt?: number;
  result?: T;
  error?: string;
}

class JobRegistry {
  private readonly jobs = new Map<string, JobRecord>();

  create<T>(label: string): JobRecord<T> {
    void label;
    const record: JobRecord<T> = {
      jobId: `job-${randomUUID()}`,
      status: "pending",
      startedAt: Date.now(),
    };
    this.jobs.set(record.jobId, record as JobRecord);
    return record;
  }

  start(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job === undefined) return;
    job.status = "running";
  }

  complete<T>(jobId: string, result: T): void {
    const job = this.jobs.get(jobId) as JobRecord<T> | undefined;
    if (job === undefined) return;
    job.status = "complete";
    job.result = result;
    job.completedAt = Date.now();
  }

  fail(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (job === undefined) return;
    job.status = "failed";
    job.error = error;
    job.completedAt = Date.now();
  }

  get<T>(jobId: string): JobRecord<T> | undefined {
    return this.jobs.get(jobId) as JobRecord<T> | undefined;
  }

  /** Trim completed jobs older than `maxAgeMs`. Call periodically. */
  gc(maxAgeMs: number = 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, job] of this.jobs) {
      if (
        (job.status === "complete" || job.status === "failed") &&
        (job.completedAt ?? job.startedAt) < cutoff
      ) {
        this.jobs.delete(id);
      }
    }
  }
}

export const globalJobs = new JobRegistry();
