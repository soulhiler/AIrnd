/**
 * LLM rerank for asp/retrieve Stage 2.
 *
 * Per ADR 0009 the integration is provider-pluggable:
 *  - `anthropic` — direct LLM via @anthropic-ai/sdk (requires ANTHROPIC_API_KEY).
 *  - `sampling` — TODO, will use MCP sampling once we can detect client support.
 *  - `disabled` — current default, returns null and surfaces a degradation
 *    entry to the caller.
 *
 * The retrieve operation calls `maybeRerank` regardless of provider; nothing
 * happens (and no degradation is added beyond the existing `rerank` entry)
 * when the provider is `disabled`.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { DegradationEntry, Symbol as AspSymbol } from "../types.js";

export type RerankProvider = "anthropic" | "sampling" | "disabled";

export interface RerankInput {
  query: string;
  candidates: Array<AspSymbol & { score: number }>;
  nFinal: number;
}

export interface RerankOutput {
  ordering: string[] | null;
  degradation: DegradationEntry[];
}

let cachedClient: Anthropic | null = null;
let mcpServerRef: Server | null = null;

/**
 * Server bootstrap wires its MCP server instance here so the sampling
 * provider can issue `sampling/createMessage` requests back to the client.
 */
export function setMcpServer(server: Server | null): void {
  mcpServerRef = server;
}

export function resolveProvider(): RerankProvider {
  const explicit = process.env["ASP_RERANK_PROVIDER"];
  if (explicit === "anthropic" || explicit === "sampling") return explicit;
  if (process.env["ANTHROPIC_API_KEY"] !== undefined) return "anthropic";
  return "disabled";
}

export async function maybeRerank(input: RerankInput): Promise<RerankOutput> {
  const provider = resolveProvider();
  if (provider === "disabled") {
    return {
      ordering: null,
      degradation: [
        {
          feature: "rerank",
          reason:
            "No rerank provider configured (set ASP_RERANK_PROVIDER=anthropic with ANTHROPIC_API_KEY, or enable sampling)",
          impact:
            "Results are ordered by first-stage ranking only (vector / keyword similarity)",
          severity: "info",
        },
      ],
    };
  }
  if (provider === "sampling") {
    return tryMcpSampling(input);
  }
  // provider === 'anthropic'
  try {
    return await rerankWithAnthropic(input);
  } catch (e) {
    return {
      ordering: null,
      degradation: [
        {
          feature: "rerank",
          reason: `Anthropic rerank failed: ${(e as Error).message}`,
          impact:
            "Results are ordered by first-stage ranking only (vector / keyword similarity)",
          severity: "warning",
        },
      ],
    };
  }
}

async function rerankWithAnthropic(input: RerankInput): Promise<RerankOutput> {
  const client = await getAnthropicClient();
  if (client === null) {
    return {
      ordering: null,
      degradation: [
        {
          feature: "rerank",
          reason: "Failed to load @anthropic-ai/sdk",
          impact:
            "Results are ordered by first-stage ranking only",
          severity: "warning",
        },
      ],
    };
  }

  const promptCandidates = input.candidates
    .map((c, i) => {
      const tags = (c.tags ?? []).slice(0, 6).join(", ");
      const snippet = (c.snippet ?? "").replace(/\s+/g, " ").slice(0, 240);
      return `[${i}] id=${c.id} tags=${tags} snippet=${snippet}`;
    })
    .join("\n");

  const prompt = [
    "You are reranking code-intelligence search results for a user query.",
    `Query: ${input.query}`,
    "",
    "Candidates (indexed [0]..[N-1]):",
    promptCandidates,
    "",
    `Return the top ${input.nFinal} candidate IDs in order of relevance.`,
    "Reply with ONE id per line, no prose, no explanation.",
  ].join("\n");

  const response = await client.messages.create({
    model: process.env["ASP_RERANK_MODEL"] ?? "claude-haiku-4-5-20251001",
    max_tokens: Math.min(2048, input.nFinal * 256),
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .map((block) => {
      if (block.type === "text") {
        return (block as { text: string }).text;
      }
      return "";
    })
    .join("\n");

  const ids = parseIdOrdering(text, input.candidates).slice(0, input.nFinal);
  if (ids.length === 0) {
    return {
      ordering: null,
      degradation: [
        {
          feature: "rerank",
          reason: "Anthropic returned no parseable IDs",
          impact: "Falling back to first-stage ranking",
          severity: "warning",
        },
      ],
    };
  }

  return { ordering: ids, degradation: [] };
}

function parseIdOrdering(
  text: string,
  candidates: Array<{ id: string }>,
): string[] {
  const known = new Set(candidates.map((c) => c.id));
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    // Allow lines like `[0] id=...` or `claude-haiku-4-5-20251001 chose ...`.
    // Find the first known ID anywhere on the line.
    let matched: string | null = null;
    for (const id of known) {
      if (line.includes(id)) {
        matched = id;
        break;
      }
    }
    if (matched !== null && !out.includes(matched)) {
      out.push(matched);
    }
  }
  return out;
}

async function getAnthropicClient(): Promise<Anthropic | null> {
  if (cachedClient !== null) return cachedClient;
  try {
    const mod = await import("@anthropic-ai/sdk");
    const Anthropic = (mod as unknown as { default: new (opts?: { apiKey?: string }) => Anthropic }).default;
    cachedClient = new Anthropic();
    return cachedClient;
  } catch {
    return null;
  }
}

/**
 * MCP sampling: server requests the client (which holds the LLM) to do the
 * rerank for us. Cleanest fit with ADR 0002 (OSS-agent scope) — no API key
 * on the server side. Falls back gracefully if the client doesn't advertise
 * the sampling capability.
 */
async function tryMcpSampling(input: RerankInput): Promise<RerankOutput> {
  if (mcpServerRef === null) {
    return {
      ordering: null,
      degradation: [
        {
          feature: "rerank",
          reason:
            "MCP sampling requested but server reference is not wired (internal init order)",
          impact:
            "Results are ordered by first-stage ranking only",
          severity: "warning",
        },
      ],
    };
  }

  const prompt = buildRerankPrompt(input);

  try {
    // Untyped `as any` for the SDK helper: createMessage isn't on every SDK
    // surface; we feature-detect at call time.
    type ServerWithCreate = Server & {
      createMessage?: (req: {
        messages: Array<{ role: "user"; content: { type: "text"; text: string } }>;
        maxTokens: number;
        modelPreferences?: { hints?: Array<{ name: string }> };
      }) => Promise<{
        content: { type: "text"; text: string } | { type: string };
      }>;
    };
    const helper = (mcpServerRef as ServerWithCreate).createMessage;
    if (typeof helper !== "function") {
      return {
        ordering: null,
        degradation: [
          {
            feature: "rerank",
            reason:
              "Active MCP SDK version does not expose createMessage; cannot use sampling",
            impact:
              "Results are ordered by first-stage ranking only",
            severity: "info",
          },
        ],
      };
    }
    const response = await helper({
      messages: [
        {
          role: "user",
          content: { type: "text", text: prompt },
        },
      ],
      maxTokens: Math.min(2048, input.nFinal * 256),
    });
    const block = response.content;
    const text =
      block.type === "text" ? (block as { text: string }).text : "";
    const ids = parseIdOrdering(text, input.candidates).slice(0, input.nFinal);
    if (ids.length === 0) {
      return {
        ordering: null,
        degradation: [
          {
            feature: "rerank",
            reason: "Sampling response did not contain parseable IDs",
            impact: "Falling back to first-stage ranking",
            severity: "warning",
          },
        ],
      };
    }
    return { ordering: ids, degradation: [] };
  } catch (e) {
    return {
      ordering: null,
      degradation: [
        {
          feature: "rerank",
          reason: `MCP sampling failed: ${(e as Error).message}`,
          impact:
            "Results are ordered by first-stage ranking only (client may not advertise the sampling capability)",
          severity: "info",
        },
      ],
    };
  }
}

function buildRerankPrompt(input: RerankInput): string {
  const promptCandidates = input.candidates
    .map((c, i) => {
      const tags = (c.tags ?? []).slice(0, 6).join(", ");
      const snippet = (c.snippet ?? "").replace(/\s+/g, " ").slice(0, 240);
      return `[${i}] id=${c.id} tags=${tags} snippet=${snippet}`;
    })
    .join("\n");
  return [
    "You are reranking code-intelligence search results for a user query.",
    `Query: ${input.query}`,
    "",
    "Candidates (indexed [0]..[N-1]):",
    promptCandidates,
    "",
    `Return the top ${input.nFinal} candidate IDs in order of relevance.`,
    "Reply with ONE id per line, no prose, no explanation.",
  ].join("\n");
}
