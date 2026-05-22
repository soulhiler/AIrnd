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
  tier: 2, // baseline + indexed (FTS5 keyword + tag lookup + context)
  tagSchema: "hierarchical",
  // Now sourced from path + markdown headings AND tree-sitter parsers
  // (which emit `kind/...` tags for code symbols).
  tagSources: ["path", "markdown-headings"],
  // Stage 2b: vector + hybrid available; graph stays for Stage 2c. Vector
  // works whenever the embedding model is loadable; otherwise asp/retrieve
  // returns `degradation: ["embeddings"]` and falls back to keyword.
  retrievalModes: ["keyword", "vector", "hybrid"],
  impactAnalysis: true, // Stage 2c (best-effort, anchor-based resolution)
  streaming: false, // v0.2
  tokenBudget: {
    default: 4096,
    max: 32768,
  },
  mutations: ["writeFile", "applyPatch"],
};

/**
 * Languages whose tree-sitter WASM grammars and extraction rules are bundled.
 * Files in other languages are skipped by the code indexer (markdown still
 * indexes via the markdown indexer for any `.md`/`.mdx`).
 */
export const PARSER_COVERAGE = [
  "python",
  "typescript",
  "tsx",
  "javascript",
  "rust",
  "go",
  "java",
  "c_sharp",
  "ruby",
  "bash",
  "c",
  "cpp",
];
