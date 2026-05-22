import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { resolveSafe } from "../repo-root.js";
import type { DegradationEntry } from "../types.js";

/**
 * `asp/writeFile` — spec Section 6.4.1.
 *
 * Safety: destructive. Caller MUST gate on user approval.
 * Path traversal is enforced by `resolveSafe`.
 *
 * Returns degradation entries when the caller asked for a mode we don't fully
 * support (e.g., creating parents was disabled).
 */

const WriteFileParamsSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  createDirs: z.boolean().optional(),
  ifExists: z.enum(["overwrite", "fail", "skip"]).optional(),
});

export type WriteFileParams = z.infer<typeof WriteFileParamsSchema>;

export interface WriteFileResult {
  path: string;
  bytesWritten: number;
  created: boolean;
  skipped: boolean;
  degradation: DegradationEntry[];
}

export class FileExistsError extends Error {
  public override readonly name = "FileExistsError";
}

export async function writeFileOp(
  rawParams: unknown,
): Promise<WriteFileResult> {
  const params = WriteFileParamsSchema.parse(rawParams);
  const absPath = resolveSafe(params.path);
  const ifExists = params.ifExists ?? "fail";
  const createDirs = params.createDirs ?? false;
  const degradation: DegradationEntry[] = [];

  // Check existence.
  let alreadyExists = false;
  try {
    await stat(absPath);
    alreadyExists = true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  if (alreadyExists) {
    if (ifExists === "fail") {
      throw new FileExistsError(`File already exists: ${params.path}`);
    }
    if (ifExists === "skip") {
      return {
        path: params.path,
        bytesWritten: 0,
        created: false,
        skipped: true,
        degradation,
      };
    }
  }

  if (createDirs) {
    await mkdir(dirname(absPath), { recursive: true });
  }

  const bytes = Buffer.byteLength(params.content, "utf-8");
  await writeFile(absPath, params.content, "utf-8");

  return {
    path: params.path,
    bytesWritten: bytes,
    created: !alreadyExists,
    skipped: false,
    degradation,
  };
}
