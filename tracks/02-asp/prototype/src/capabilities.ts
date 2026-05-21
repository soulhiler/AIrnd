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
  tier: 1, // baseline only at scaffold; bumps to 2 when findByTag lands
  tagSchema: "none", // bumps to "hierarchical" when indexer lands
  tagSources: [], // bumps to ["path", "markdown-headings"] when indexer lands
  retrievalModes: [], // Stage 2b
  impactAnalysis: false, // Stage 2c
  streaming: false, // v0.2
  tokenBudget: {
    default: 4096,
    max: 32768,
  },
  mutations: [], // read-only for scaffold; writeFile/applyPatch in Stage 2b
};
