import type { AspCapabilities } from "./types.js";
import { ASP_VERSION } from "./types.js";

/**
 * Stage 2a capabilities: baseline + minimal indexed.
 *
 * Per ADR 0003 staging:
 * - Stage 2a: readFile, listFiles, searchFiles (baseline) + findByTag,
 *   context (indexed) + 2 of 5 fixes (offline-first FTS, fuzzy lookup).
 * - Stage 2b adds: retrieve (with embeddings), rename, cypher, ...
 * - Stage 2c adds: impact analysis, full GitNexus parity.
 *
 * This scaffold advertises only the baseline (readFile, listFiles) for now.
 * Other capabilities will be enabled as operations land.
 */
export const STAGE_2A_CAPABILITIES: AspCapabilities = {
  version: ASP_VERSION,
  tier: 2, // baseline + indexed (FTS5 keyword retrieval)
  tagSchema: "hierarchical", // populated by markdown-indexer (path + headings)
  tagSources: ["path", "markdown-headings"],
  retrievalModes: ["keyword"], // FTS5 only; vector / graph / hybrid pending
  impactAnalysis: false, // Stage 2c
  streaming: false, // v0.2
  tokenBudget: {
    default: 4096,
    max: 32768,
  },
  mutations: [], // read-only; writeFile/applyPatch in Stage 2b
};
