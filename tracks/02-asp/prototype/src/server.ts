#!/usr/bin/env node
/**
 * asp-ref — ASP reference implementation, Stage 2a scaffold.
 *
 * MCP server exposing ASP operations. Currently implemented:
 *  - asp/readFile (Section 6.2.1)
 *  - asp/listFiles (Section 6.2.2)
 *
 * Roadmap (Stage 2a):
 *  - asp/searchFiles with SQLite FTS5 (ADR 0007)
 *  - asp/findByTag with hierarchical tags (ADR 0004)
 *  - asp/context (Stage 2a indexed minimum)
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { STAGE_2A_CAPABILITIES } from "./capabilities.js";
import { fullScan } from "./index/indexer.js";
import { IndexStore, defaultIndexPath } from "./index/store.js";
import { applyPatchOp, PatchConflictError, PatchMalformedError } from "./operations/apply-patch.js";
import { makeContextOp } from "./operations/context.js";
import { makeFindByTagOp } from "./operations/find-by-tag.js";
import { makeImpactOp } from "./operations/impact.js";
import { listFilesOp } from "./operations/list-files.js";
import {
  BinaryFileError,
  NotFoundError,
  readFileOp,
} from "./operations/read-file.js";
import { makeRefreshOp, refreshStatusOp } from "./operations/refresh.js";
import { makeRetrieveOp } from "./operations/retrieve.js";
import { makeSearchFilesOp } from "./operations/search-files.js";
import { FileExistsError, writeFileOp } from "./operations/write-file.js";
import { PathForbiddenError, setRepoRoot } from "./repo-root.js";
import { SERVER_INFO } from "./types.js";

// ASP error codes (spec Section 8.1).
const ERR_CAPABILITY_REQUIRED = -32100;
const ERR_SYMBOL_NOT_FOUND = -32101;
const ERR_PATH_NOT_FOUND = -32102;
const ERR_TOKEN_BUDGET_TOO_SMALL = -32103;
const ERR_PATH_FORBIDDEN = -32104;
const ERR_RATE_LIMITED = -32105;

void ERR_SYMBOL_NOT_FOUND;
void ERR_TOKEN_BUDGET_TOO_SMALL;
void ERR_RATE_LIMITED;

class AspError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

async function main(): Promise<void> {
  // Repo root: argv[2] or env, defaulting to cwd.
  const repoRoot =
    process.argv[2] ?? process.env["ASP_REPO_ROOT"] ?? process.cwd();
  setRepoRoot(repoRoot);

  // Initialize SQLite index store. Schema is created on first run.
  const store = new IndexStore(defaultIndexPath(repoRoot));
  let indexReady = store.countSymbols() > 0;
  const searchFilesOp = makeSearchFilesOp({
    store,
    indexBuilt: () => indexReady,
  });
  const findByTagOp = makeFindByTagOp({
    store,
    indexBuilt: () => indexReady,
  });
  const contextOp = makeContextOp({
    store,
    indexBuilt: () => indexReady,
  });
  const embedByDefault = process.env["ASP_ENABLE_EMBEDDINGS"] === "1";
  const refreshOp = makeRefreshOp({
    store,
    repoRoot,
    embedByDefault,
    onComplete: () => {
      indexReady = true;
    },
  });
  const retrieveOp = makeRetrieveOp({
    store,
    indexBuilt: () => indexReady,
  });
  const impactOp = makeImpactOp({
    store,
    indexBuilt: () => indexReady,
  });

  // Background initial scan if index is empty. We don't block startup; the
  // first search query will report partial-index degradation until done.
  if (!indexReady) {
    console.error(
      `[asp-ref] Index empty; starting background scan ` +
        `(embeddings=${embedByDefault ? "on" : "off"})...`,
    );
    void fullScan({
      root: repoRoot,
      store,
      embed: embedByDefault,
      onProgress: (n) => console.error(`[asp-ref]   ...${n} files processed`),
    }).then((stats) => {
      indexReady = true;
      console.error(
        `[asp-ref] Initial scan complete: ${stats.filesProcessed} files, ` +
          `${stats.symbolsIndexed} symbols, ${stats.durationMs}ms.`,
      );
    });
  } else {
    console.error(
      `[asp-ref] Index ready: ${store.countSymbols()} symbols.`,
    );
  }

  const server = new Server(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Expose ASP capabilities via the MCP `_meta` field on initialize.
  // The MCP SDK doesn't have first-class ASP capability advertising yet;
  // we attach it to the server info object until spec adds a richer hook.
  // TODO(spec): once ASP capability key is finalized in MCP initialize
  // negotiation, move this to the proper place.

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "asp_readFile",
          description:
            "ASP operation `asp/readFile`. Reads a UTF-8 file (or range) with optional token budget.",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Path relative to repo root" },
              lineRange: {
                type: "object",
                properties: {
                  start: { type: "integer", minimum: 1 },
                  end: { type: "integer", minimum: 1 },
                },
                required: ["start", "end"],
              },
              tokenBudget: { type: "integer", minimum: 1 },
            },
            required: ["path"],
          },
        },
        {
          name: "asp_listFiles",
          description:
            "ASP operation `asp/listFiles`. Lists files/directories with glob filters and gitignore respect.",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" },
              recursive: { type: "boolean" },
              include: { type: "array", items: { type: "string" } },
              exclude: { type: "array", items: { type: "string" } },
              respectGitignore: { type: "boolean" },
              tokenBudget: { type: "integer", minimum: 1 },
            },
          },
        },
        {
          name: "asp_searchFiles",
          description:
            "ASP operation `asp/searchFiles`. Full-text search over indexed markdown via SQLite FTS5. Offline-first; no external dependencies.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", minLength: 1 },
              regex: {
                type: "boolean",
                description:
                  "Stage 2a degraded: regex falls back to phrase match with a degradation entry.",
              },
              raw: {
                type: "boolean",
                description:
                  "Pass the query string through to FTS5 unmodified (allows AND, OR, NEAR, column filters).",
              },
              include: { type: "array", items: { type: "string" } },
              limit: { type: "integer", minimum: 1, maximum: 500 },
              tokenBudget: { type: "integer", minimum: 1 },
            },
            required: ["query"],
          },
        },
        {
          name: "asp_findByTag",
          description:
            "ASP operation `asp/findByTag`. Hierarchical (default) or exact tag lookup against the indexed symbol set. Tag format: slash-separated path (e.g. `tracks/02-asp/decisions`).",
          inputSchema: {
            type: "object",
            properties: {
              tag: {
                type: "string",
                pattern: "^[\\w-]+(/[\\w-]+)*$",
                description: "Tag in slash-separated form",
              },
              hierarchical: {
                type: "boolean",
                description:
                  "true (default): prefix match; false: exact match only",
              },
              kind: {
                type: "string",
                description: "Optional symbol kind filter (file / section / ...)",
              },
              limit: { type: "integer", minimum: 1, maximum: 500 },
              tokenBudget: { type: "integer", minimum: 1 },
            },
            required: ["tag"],
          },
        },
        {
          name: "asp_context",
          description:
            "ASP operation `asp/context`. Returns rich context for a single symbol: its full record, parent, direct children, and (in Stage 2c) references/referents.",
          inputSchema: {
            type: "object",
            properties: {
              symbol: {
                type: "string",
                description: "Symbol ID (e.g. `section:README.md#Overview`)",
              },
              includeBody: { type: "boolean" },
              includeReferences: { type: "boolean" },
              includeReferents: { type: "boolean" },
              tokenBudget: { type: "integer", minimum: 1 },
            },
            required: ["symbol"],
          },
        },
        {
          name: "asp_retrieve",
          description:
            "ASP operation `asp/retrieve`. Two-stage retrieval over indexed symbols: vector | keyword | hybrid. Embeddings fall back to keyword search with a `degradation: [\"embeddings\"]` entry if the model is not loaded.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", minLength: 1 },
              mode: { type: "string", enum: ["vector", "keyword", "hybrid"] },
              nRetrieve: { type: "integer", minimum: 1, maximum: 500 },
              nFinal: { type: "integer", minimum: 1, maximum: 500 },
              rerank: { type: "boolean" },
              filter: {
                type: "object",
                properties: {
                  tags: { type: "array", items: { type: "string" } },
                  kind: { type: "string" },
                  pathPrefix: { type: "string" },
                },
              },
              tokenBudget: { type: "integer", minimum: 1 },
            },
            required: ["query"],
          },
        },
        {
          name: "asp_refresh",
          description:
            "ASP operation `asp/refresh`. Trigger a repository re-scan. Supports incremental (mtime-based) + path scoping + async (wait: false → returns jobId). Pair with `asp_refreshStatus` to poll.",
          inputSchema: {
            type: "object",
            properties: {
              scope: { type: "string", enum: ["incremental", "full"] },
              paths: { type: "array", items: { type: "string" } },
              wait: { type: "boolean" },
              embed: { type: "boolean" },
            },
          },
        },
        {
          name: "asp_refreshStatus",
          description:
            "ASP operation `asp/refreshStatus`. Poll a background refresh job created via `asp_refresh({wait: false})`.",
          inputSchema: {
            type: "object",
            properties: { jobId: { type: "string", minLength: 1 } },
            required: ["jobId"],
          },
        },
        {
          name: "asp_impact",
          description:
            "ASP operation `asp/impact`. Best-effort blast-radius traversal over the symbol edge graph. Returns affected symbols with depth and edge kind.",
          inputSchema: {
            type: "object",
            properties: {
              symbol: { type: "string", minLength: 1 },
              direction: {
                type: "string",
                enum: ["upstream", "downstream", "both"],
              },
              maxDepth: { type: "integer", minimum: 1, maximum: 10 },
              tokenBudget: { type: "integer", minimum: 1 },
            },
            required: ["symbol"],
          },
        },
        {
          name: "asp_writeFile",
          description:
            "ASP operation `asp/writeFile` (destructive). Writes UTF-8 content to a file relative to repo root, with path traversal protection. Clients should obtain user approval before invoking.",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", minLength: 1 },
              content: { type: "string" },
              createDirs: { type: "boolean" },
              ifExists: { type: "string", enum: ["overwrite", "fail", "skip"] },
            },
            required: ["path", "content"],
          },
        },
        {
          name: "asp_applyPatch",
          description:
            "ASP operation `asp/applyPatch` (destructive). Applies a unified-diff patch to one or more files. Set `dryRun: true` to validate without writing.",
          inputSchema: {
            type: "object",
            properties: {
              patch: { type: "string", minLength: 1 },
              dryRun: { type: "boolean" },
            },
            required: ["patch"],
          },
        },
        {
          name: "asp_capabilities",
          description:
            "Return advertised ASP capabilities (spec Section 5). Stable across this server lifetime.",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      switch (name) {
        case "asp_readFile": {
          const result = await readFileOp(args ?? {});
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
        case "asp_listFiles": {
          const result = await listFilesOp(args ?? {});
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
        case "asp_searchFiles": {
          const result = await searchFilesOp(args ?? {});
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
        case "asp_findByTag": {
          const result = await findByTagOp(args ?? {});
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
        case "asp_context": {
          const result = await contextOp(args ?? {});
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
        case "asp_refresh": {
          const result = await refreshOp(args ?? {});
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
        case "asp_refreshStatus": {
          const result = await refreshStatusOp(args ?? {});
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
        case "asp_retrieve": {
          const result = await retrieveOp(args ?? {});
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
        case "asp_impact": {
          const result = await impactOp(args ?? {});
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
        case "asp_writeFile": {
          const result = await writeFileOp(args ?? {});
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
        case "asp_applyPatch": {
          const result = await applyPatchOp(args ?? {});
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }
        case "asp_capabilities": {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(STAGE_2A_CAPABILITIES, null, 2),
              },
            ],
          };
        }
        default:
          throw new AspError(
            ERR_CAPABILITY_REQUIRED,
            `Unknown ASP operation: ${name}`,
            { operation: name },
          );
      }
    } catch (e) {
      return handleError(e);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr — stdout is reserved for MCP protocol messages.
  console.error(
    `[asp-ref] Stage 2a scaffold listening on stdio. Repo root: ${repoRoot}`,
  );
}

function handleError(e: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  let code: number;
  let message: string;
  let data: Record<string, unknown> | undefined;

  if (e instanceof AspError) {
    code = e.code;
    message = e.message;
    if (e.data !== undefined) data = e.data;
  } else if (e instanceof PathForbiddenError) {
    code = ERR_PATH_FORBIDDEN;
    message = e.message;
  } else if (e instanceof NotFoundError) {
    code = ERR_PATH_NOT_FOUND;
    message = e.message;
  } else if (e instanceof BinaryFileError) {
    code = ERR_PATH_NOT_FOUND;
    message = e.message;
  } else if (e instanceof FileExistsError) {
    code = -32106; // asp_file_exists
    message = e.message;
  } else if (e instanceof PatchConflictError) {
    code = -32107; // asp_patch_conflict
    message = e.message;
    data = { conflicts: e.conflicts };
  } else if (e instanceof PatchMalformedError) {
    code = -32108; // asp_patch_malformed
    message = e.message;
  } else if (e instanceof z.ZodError) {
    code = -32602; // JSON-RPC invalid params
    message = "Invalid parameters";
    data = { issues: e.issues };
  } else if (e instanceof Error) {
    code = -32603; // JSON-RPC internal error
    message = e.message;
  } else {
    code = -32603;
    message = "Unknown error";
  }

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { error: { code, message, ...(data !== undefined && { data }) } },
          null,
          2,
        ),
      },
    ],
  };
}

main().catch((e) => {
  console.error("[asp-ref] Fatal:", e);
  process.exit(1);
});
