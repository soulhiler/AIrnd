import { mutationsEnabled } from "./security.js";
import type { AspCapabilities, MutationOp } from "./types.js";
import { ASP_VERSION } from "./types.js";

/**
 * Capabilities computed once at module load.
 *
 * Mutations are advertised only when `ASP_ENABLE_MUTATIONS=1` is set,
 * per the hardening pass (default-off destructive ops). When the env
 * flag is unset, the server still wires the writeFile/applyPatch tools
 * but they short-circuit with a clear error.
 */
function computeMutations(): MutationOp[] {
  return mutationsEnabled() ? ["writeFile", "applyPatch"] : [];
}

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
  mutations: computeMutations(),
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
