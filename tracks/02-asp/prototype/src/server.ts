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
import { listFilesOp } from "./operations/list-files.js";
import {
  BinaryFileError,
  NotFoundError,
  readFileOp,
} from "./operations/read-file.js";
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
