/**
 * ASP type definitions, mirror Section 7 of the spec
 * (tracks/02-asp/design/03-asp-spec-draft.md).
 */

export type SymbolKind =
  | "file"
  | "directory"
  | "section"
  | "function"
  | "method"
  | "class"
  | "interface"
  | "variable"
  | "constant"
  | "module"
  | "package"
  | "type"
  | "enum";

export interface Location {
  path: string;
  line?: number;
  endLine?: number;
  column?: number;
  endColumn?: number;
}

export interface Symbol {
  id: string;
  kind: SymbolKind;
  tags?: string[];
  location?: Location;
  parent?: string;
  tokenSize?: number;
  docstring?: string;
  score?: number;
  snippet?: string;
  depth?: number;
  edgeKind?: string;
}

export type TagSchema = "hierarchical" | "flat" | "none";
export type RetrievalMode = "vector" | "keyword" | "graph" | "hybrid";
export type TagSource = "path" | "manual" | "markdown-headings" | "llm-inferred";
export type MutationOp = "writeFile" | "applyPatch";

export interface AspCapabilities {
  version: string;
  tier: 1 | 2;
  tagSchema: TagSchema;
  tagSources: TagSource[];
  retrievalModes: RetrievalMode[];
  impactAnalysis: boolean;
  streaming: boolean;
  tokenBudget: {
    default: number;
    max: number;
  };
  mutations: MutationOp[];
}

export interface DegradationEntry {
  feature: string;
  reason: string;
  impact: string;
  severity?: "info" | "warning" | "error";
  since?: string;
}

/**
 * Standard response envelope. All operations include `degradation` array
 * (empty when operating normally — per Section 8.2 of spec).
 */
export interface ResponseEnvelope {
  degradation: DegradationEntry[];
  truncated?: boolean;
}

export const ASP_VERSION = "0.1";

export const SERVER_INFO = {
  name: "asp-ref",
  version: "0.1.0-alpha.0",
} as const;
