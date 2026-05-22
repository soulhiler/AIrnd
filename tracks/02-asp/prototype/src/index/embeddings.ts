/**
 * Local embeddings via `@xenova/transformers` (Apache-2.0).
 *
 * Default model: `Xenova/all-MiniLM-L6-v2` (384-dim, ~22 MB). On first use
 * the model is downloaded from the Hugging Face hub and cached on disk.
 *
 * Per ADR 0007 (Stage 2b): embeddings live in the same SQLite file as a
 * BLOB column. Linear scan with cosine similarity is acceptable for the
 * target repo size (≤ ~50k symbols); production-grade ANN search via
 * sqlite-vec or LanceDB is a follow-up.
 *
 * Offline behaviour: if the model can't be loaded (no network, no cache),
 * embeddings are silently skipped during indexing and any retrieve call
 * returns a `degradation: ["embeddings-unavailable"]` entry — per spec
 * Section 8.2.
 */

import type { DegradationEntry } from "../types.js";

export const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";
export const DEFAULT_DIM = 384;

type FeatureExtractionPipeline = (
  text: string | string[],
  opts?: { pooling?: string; normalize?: boolean },
) => Promise<{ data: Float32Array | number[] }>;

let pipelineSingleton: FeatureExtractionPipeline | null = null;
let initFailureReason: string | null = null;
let initPromise: Promise<void> | null = null;

export async function ensureEmbeddingsReady(
  modelName: string = DEFAULT_MODEL,
): Promise<void> {
  if (pipelineSingleton !== null || initFailureReason !== null) return;
  if (initPromise === null) {
    initPromise = (async () => {
      try {
        const mod = await import("@xenova/transformers");
        // env hint: prefer cache dir under the repo root so first download is
        // visible to the user. Falls back to home dir if not writable.
        const xform = mod as unknown as {
          env: { cacheDir?: string };
          pipeline: (
            task: string,
            model: string,
          ) => Promise<FeatureExtractionPipeline>;
        };
        if (process.env["ASP_MODEL_CACHE"] !== undefined) {
          xform.env.cacheDir = process.env["ASP_MODEL_CACHE"];
        }
        const pipe = await xform.pipeline("feature-extraction", modelName);
        pipelineSingleton = pipe;
      } catch (e) {
        initFailureReason = (e as Error).message;
      }
    })();
  }
  await initPromise;
}

export function embeddingsAvailable(): boolean {
  return pipelineSingleton !== null;
}

export function lastInitFailure(): string | null {
  return initFailureReason;
}

export async function embed(text: string): Promise<Float32Array | null> {
  await ensureEmbeddingsReady();
  if (pipelineSingleton === null) return null;
  const out = await pipelineSingleton(text, {
    pooling: "mean",
    normalize: true,
  });
  return out.data instanceof Float32Array
    ? out.data
    : new Float32Array(out.data);
}

export async function embedBatch(
  texts: string[],
): Promise<Array<Float32Array | null>> {
  // Run sequentially for now; transformers.js doesn't get a big win from
  // batching in Node, and serial calls keep memory predictable.
  const out: Array<Float32Array | null> = [];
  for (const t of texts) {
    out.push(await embed(t));
  }
  return out;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    aMag += a[i]! * a[i]!;
    bMag += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(aMag) * Math.sqrt(bMag);
  return denom === 0 ? 0 : dot / denom;
}

export function makeUnavailableDegradation(): DegradationEntry {
  return {
    feature: "embeddings",
    reason:
      initFailureReason ??
      "Embedding model not loaded (no network and no cached weights, or asp-ref started without embeddings enabled)",
    impact:
      "Vector retrieval is unavailable; falling back to keyword (FTS5) ranking",
    severity: "warning",
  };
}

export function vectorToBlob(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

export function blobToVector(blob: Buffer): Float32Array {
  // Buffer slice shares memory; copy to avoid retaining the SQLite buffer.
  const copy = new ArrayBuffer(blob.byteLength);
  new Uint8Array(copy).set(blob);
  return new Float32Array(copy);
}
