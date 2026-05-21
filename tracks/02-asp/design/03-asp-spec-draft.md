# ASP — Agent Server Protocol Specification, Draft v0.1

- **Status:** Draft v0.1 (in progress)
- **Date:** 2026-05-21
- **Editors:** AIrnd track 02-asp
- **License:** Apache 2.0
- **Repository:** [soulhiler/AIrnd](https://github.com/soulhiler/AIrnd) (track 02-asp)

## Простыми словами

Этот документ — **черновик стандарта** для AI-помощников, которые работают с кодом. Сейчас каждый помощник (Cline, Aider, Continue, Cursor, и т.д.) сам решает, как ему искать файлы, понимать структуру проекта, находить связи между функциями. Из-за этого: (1) каждый изобретает велосипед, (2) полезный сервер для одного помощника не работает с другим, (3) пользователю нужно настраивать всё заново для каждого помощника.

Этот стандарт **ASP** (Agent Server Protocol) — как «розетка»: единый формат, в который любой помощник может «воткнуться» и получить услуги (читать файлы, искать по тегам, понимать связи, и т.д.). Стандарт построен **поверх существующего стандарта MCP** (Model Context Protocol), не вместо него — то есть, любой ASP-сервер автоматически совместим с любым MCP-клиентом.

**В этой версии (v0.1) — только структура** (главы и placeholders для деталей). Контент будет добавлен в Phase 1.

## Abstract

ASP (Agent Server Protocol) is an open specification for code intelligence servers that AI coding agents query to navigate, understand, and modify codebases. ASP inherits transport, lifecycle, and message framing from MCP (Model Context Protocol), and standardizes a set of typed operations and capabilities specific to code-aware agent workflows: symbol lookup, hierarchical tag-based retrieval, structural impact analysis, token-budget-aware context selection, and on-demand file operations.

The specification is designed for the open-source agent ecosystem (Cline, Aider, Continue.dev, Goose, GitNexus, and others). Implementations are expected under permissive licenses (Apache 2.0, MIT). ASP MAY be adopted by commercial agents but does not impose requirements on them.

## 1. Introduction

### 1.1 Motivation

The OSS coding agent ecosystem in 2026 includes several mature projects (Cline 62k★, Goose 45k★, Aider 45k★, Continue.dev 33k★, GitNexus 39k★) that each implement their own code intelligence subsystems. This creates an N×M problem: every agent re-implements file navigation, symbol search, and context selection; tools written for one agent cannot be reused with another. AI agents cannot share code intelligence infrastructure, leading to duplicated effort and inconsistent UX.

ASP closes this gap by standardizing a **typed query interface** that any code intelligence server may expose, and any agent may consume. ASP-compliant servers and clients become interchangeable.

### 1.2 Relationship to MCP

ASP **builds on top of** MCP. Specifically:

- **Transport:** ASP inherits MCP's stdio / SSE / WebSocket transports.
- **Lifecycle:** ASP inherits MCP's initialize / shutdown handshake.
- **Message framing:** JSON-RPC 2.0 messages, same as MCP.
- **Capability advertising:** ASP capabilities are advertised through MCP's `initialize` response, in a dedicated `asp` namespace.

ASP does NOT redefine these. An ASP server is a valid MCP server. An ASP-aware MCP client is a valid MCP client.

ASP adds:

- A namespace of code-specific operations (`asp/readFile`, `asp/findByTag`, etc.).
- A capability schema for advertising what code intelligence the server provides.
- Symbol identification conventions (string-based, human-readable, inspired by SCIP).
- Error and degradation signals specific to code intelligence.

### 1.3 Out of scope

ASP does **not** specify:

- How servers generate or maintain their indexes (path-based, manual, LLM-inferred, hybrid — implementation choice).
- Storage backend (graph DB, vector DB, SQLite, in-memory — implementation choice).
- Specific programming languages a server must support.
- Authentication or authorization beyond what MCP provides.
- Real-time IDE integration (that's LSP's domain).

### 1.4 Conformance language

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, MAY, and OPTIONAL in this document are to be interpreted as described in RFC 2119.

## 2. Conformance

### 2.1 Conformance levels

An ASP server MUST implement **at minimum** the [Baseline operations](#62-baseline-operations) (Section 6.2). All other operations are optional capabilities.

Two conformance tiers are defined:

- **Tier 1 (Baseline):** Server implements baseline operations (`asp/readFile`, `asp/listFiles`, `asp/searchFiles`). Sufficient for tool-driven agents (Cline-style).
- **Tier 2 (Indexed):** Server implements baseline + ≥1 indexed capability (`asp/findByTag`, `asp/retrieve`, `asp/impact`, `asp/context`). Sufficient for indexed agents (Aider-style, Continue-style).

A server MUST advertise its tier and capabilities via `initialize` response (see Section 5).

### 2.2 Versioning

This specification version is `0.1`. Servers and clients MUST advertise their supported ASP version in `initialize`. Version negotiation follows semver: same major + ≥ minor required for compatibility.

Breaking changes between minor versions of `0.x` are permitted (this is a draft). Version `1.0` will commit to backward-compatible evolution.

## 3. Concepts

### 3.1 Symbol

A **symbol** is any identifiable unit in the codebase: a file, a section in a markdown document, a function, a class, a method. Symbols have stable, human-readable string identifiers.

Symbol ID format:

```text
<scheme>:<path>[#<anchor>]
```

Examples:

- `file:src/main.py` — a file symbol.
- `section:docs/README.md#Getting Started` — a markdown section.
- `python:django.contrib.auth.User` — a Python class.
- `typescript:src/utils.ts#parseDate` — a TypeScript function.

The `scheme` is server-defined (e.g., `file`, `section`, `python`, `typescript`, `markdown`). The spec reserves the `file` and `section` schemes for filesystem and markdown navigation. Other schemes are language- or implementation-specific.

[FULL FORMAL SCHEMA — TBD in subsequent revision.]

### 3.2 Tag

A **tag** is a slash-separated string labeling a symbol. Tags MAY be hierarchical (`tests/unit/auth`) or flat (`important`). See [Section 5.2 hierarchical tag capability](#52-standard-capabilities) and [ADR 0004](../decisions/0004-hierarchical-tag-schema-as-asp-capability.md).

Tag format: `^[\w-]+(/[\w-]+)*$` (Unicode word characters and hyphens, slash-separated).

Reserved tag namespaces:

- `kind/...` — symbol kind hierarchy (`kind/callable/function`).
- `heading/level-N` — markdown heading level.
- `section/{parent_heading}` — structural parent in markdown.
- `lang/{language}` — programming language.

All other namespaces are implementation-defined.

### 3.3 Operation

An **operation** is a typed query or command exposed by the server. Operations are namespaced under `asp/`. Each operation has:

- A signature (parameters + response type).
- A **safety class** (Section 3.5).
- An optional **token budget** parameter (Section 3.6).
- A list of capabilities required for support.

Full operation catalog in Section 6.

### 3.4 Capability

A **capability** is a server-advertised feature. Capabilities are:

- Boolean (server supports X or not).
- Enum (server supports X with one of several behaviors).
- Object (server supports X with detailed configuration).

Capabilities are advertised via the `initialize` response in the `asp` namespace.

Full capability catalog in Section 5.

### 3.5 Safety class

Each operation declares a `safetyClass`:

- `read-only` — does not modify state, no side effects. Clients MAY auto-execute.
- `side-effecting` — modifies server-internal state (e.g., triggers re-index). Client SHOULD ask user.
- `destructive` — modifies user's filesystem or external state. Client MUST ask user before execution.

This concept is inspired by Cline's Plan/Act mode separation (see [Cline lit-review](../lit-review/rizwan-2026-cline.md)).

### 3.6 Token budget

Each operation that returns variable-length content (file contents, search results, retrieval results) MAY accept a `tokenBudget: number` parameter. When provided, the server MUST NOT return content exceeding the budget; the server returns partial content with `truncated: true` flag.

Default budgets, granularity of truncation, and behavior when budget = 0 are implementation-defined but SHOULD be documented in server capabilities.

This concept is inspired by Aider's RepoMap binary search budget enforcement (see [Aider lit-review](../lit-review/gauthier-2024-aider-repomap.md)).

## 4. Wire format

ASP messages are JSON-RPC 2.0 over MCP transport. Inherited from MCP:

- Request: `{"jsonrpc": "2.0", "method": "asp/<operation>", "params": {...}, "id": <number>}`.
- Response: `{"jsonrpc": "2.0", "result": {...}, "id": <number>}` or `{"jsonrpc": "2.0", "error": {...}, "id": <number>}`.

ASP-specific:

- Method namespace: `asp/<operation_name>` for operations.
- Capability advertising: `asp` key in `initialize` response capabilities.
- Streaming support: TBD (likely MCP's resource update notifications, to be specified).

## 5. Capabilities

### 5.1 Capability negotiation

Server advertises capabilities in `initialize` response:

```jsonc
{
  "capabilities": {
    "asp": {
      "version": "0.1",
      "tier": 2,
      "tagSchema": "hierarchical",
      "tagSources": ["path", "markdown-headings"],
      "retrievalModes": ["vector", "keyword", "graph"],
      "impactAnalysis": true,
      "streaming": false,
      "tokenBudget": {
        "default": 4096,
        "max": 32768
      }
      // ... more capabilities
    }
  }
}
```

### 5.2 Standard capabilities

| Capability | Type | Values | Default |
|---|---|---|---|
| `version` | string | semver | required |
| `tier` | integer | 1, 2 | required |
| `tagSchema` | enum | `hierarchical`, `flat`, `none` | `none` |
| `tagSources` | array | `path`, `manual`, `markdown-headings`, `llm-inferred` | `[]` |
| `retrievalModes` | array | `vector`, `keyword`, `graph`, `hybrid` | `[]` |
| `impactAnalysis` | boolean | true/false | false |
| `streaming` | boolean | true/false | false |
| `tokenBudget.default` | integer | tokens | 4096 |
| `tokenBudget.max` | integer | tokens | implementation-defined |

[ADDITIONAL CAPABILITIES — TBD in subsequent revisions. See ADR 0006+ for storage / parser / language backend negotiations.]

## 6. Operations

### 6.1 Operation summary

| Operation | Tier | Safety | Token budget | Capabilities required |
|---|---|---|---|---|
| `asp/readFile` | 1 | read-only | yes | — |
| `asp/listFiles` | 1 | read-only | yes | — |
| `asp/searchFiles` | 1 | read-only | yes | — |
| `asp/findByTag` | 2 | read-only | yes | `tagSchema: hierarchical \| flat` |
| `asp/retrieve` | 2 | read-only | yes | `retrievalModes: ≥1` |
| `asp/context` | 2 | read-only | yes | — |
| `asp/impact` | 2 | read-only | yes | `impactAnalysis: true` |
| `asp/writeFile` | 2 | destructive | no | — |
| `asp/applyPatch` | 2 | destructive | no | — |
| `asp/refresh` | — | side-effecting | no | — |

### 6.2 Baseline operations

#### 6.2.1 `asp/readFile`

Read the contents of a file (or part of it).

**Parameters:**

```jsonc
{
  "path": "string",            // relative path from repo root
  "lineRange": {               // optional
    "start": 1,
    "end": 100
  },
  "tokenBudget": 4096          // optional
}
```

**Response:**

```jsonc
{
  "content": "string",
  "truncated": false,
  "totalLines": 234,
  "encoding": "utf-8"
}
```

**Errors:** `not_found`, `permission_denied`, `binary_file`.

#### 6.2.2 `asp/listFiles`

List files in a directory.

**Parameters:**

```jsonc
{
  "path": "string",            // relative path; default "."
  "recursive": false,
  "include": ["*.py"],         // glob filters
  "exclude": ["__pycache__"],
  "respectGitignore": true
}
```

**Response:**

```jsonc
{
  "files": [
    {"path": "src/main.py", "kind": "file", "sizeBytes": 1234},
    {"path": "src/utils/", "kind": "directory"}
  ],
  "truncated": false
}
```

#### 6.2.3 `asp/searchFiles`

Search file contents (ripgrep-style).

**Parameters:**

```jsonc
{
  "query": "string",           // regex or literal
  "regex": true,
  "include": ["*.py"],
  "tokenBudget": 4096
}
```

**Response:**

```jsonc
{
  "matches": [
    {
      "path": "src/main.py",
      "line": 42,
      "content": "    def foo():"
    }
  ],
  "truncated": false
}
```

### 6.3 Indexed operations

[FULL DEFINITIONS — TBD in subsequent revisions.]

#### 6.3.1 `asp/findByTag`

See [ADR 0004](../decisions/0004-hierarchical-tag-schema-as-asp-capability.md) for design. Skeleton:

```jsonc
{
  "tag": "tests/unit/auth",
  "hierarchical": true,
  "kind": "file",
  "limit": 100
}
```

Returns array of symbols matching the tag.

#### 6.3.2 `asp/retrieve`

[TBD: combines query + ranking + filtering. Inspired by Continue.dev's `nRetrieve/nFinal` pattern + Aider's token budget.]

#### 6.3.3 `asp/context`

[TBD: get context for a symbol — its tags, parent, children, references.]

#### 6.3.4 `asp/impact`

[TBD: GitNexus-style — given a symbol, return upstream/downstream affected symbols.]

### 6.4 Side-effecting and destructive operations

[TBD: `asp/writeFile`, `asp/applyPatch`, `asp/refresh`.]

## 7. Symbol schema

[TBD: formal JSON Schema for symbol objects. Inspired by SCIP's `SymbolInformation` but simpler.]

## 8. Error model

### 8.1 Standard error codes

JSON-RPC error codes are reused. ASP defines additional codes in the range -32100 to -32199:

| Code | Name | Description |
|---|---|---|
| -32100 | `asp_capability_required` | Operation requires a capability the server doesn't advertise |
| -32101 | `asp_symbol_not_found` | Symbol identifier not found |
| -32102 | `asp_path_not_found` | File path doesn't exist |
| -32103 | `asp_token_budget_too_small` | Cannot return any meaningful content within the budget |

### 8.2 Degradation signals

When a server is operating in a degraded mode (e.g., full-text search unavailable, embedding model not loaded), it MUST include a `degradation` array in the response:

```jsonc
{
  "result": {...},
  "degradation": [
    {
      "feature": "fts",
      "reason": "FTS extension not installed",
      "impact": "Keyword search may miss results"
    }
  ]
}
```

This is **mandatory** when degradation occurs. Silent degradation is a conformance violation.

This concept is fix #5 from GitNexus dogfooding (see [GitNexus lit-review](../lit-review/patwari-2026-gitnexus.md)).

## 9. Security considerations

[TBD. Brief topics:]

- Path traversal protection in `asp/readFile`.
- Authentication inheritance from MCP.
- Sensitive content filtering.
- Rate limiting hints.

## 10. Future work

Items deferred to v0.2+:

- Streaming responses for long operations.
- Cross-repo queries (one server, multiple repos).
- Incremental indexing notifications.
- Tag conflict resolution between sources.
- Multilingual tag content (non-ASCII).

## A. Examples

[TBD: concrete request/response examples for all operations.]

## B. JSON Schemas

[TBD: machine-readable JSON Schemas for all types.]

## C. Changelog

- **2026-05-21:** Draft v0.1 skeleton created. Sections 1-3, 5-6 with structure and key paragraphs; 4, 7-10 with TBDs.

## References

### Foundational

- [LSP Specification 3.17](../lit-review/microsoft-2022-lsp-spec.md) — relationship: adjacent (real-time IDE protocol, different layer).
- [MCP Specification 2024-2025](../lit-review/anthropic-2024-mcp-spec.md) — relationship: parent (ASP inherits transport, lifecycle, message framing).
- [tree-sitter (Brunsfeld 2018)](../lit-review/brunsfeld-2018-tree-sitter.md) — relationship: tooling (implementations MAY use tree-sitter for AST parsing).

### Prior art (OSS code intelligence)

- [GitNexus (Patwari 2026)](../lit-review/patwari-2026-gitnexus.md) — typed graph approach; informs `asp/impact`.
- [Aider RepoMap (Gauthier 2023-26)](../lit-review/gauthier-2024-aider-repomap.md) — PageRank ranking + token budget; informs `tokenBudget` concept (Section 3.6).
- [Continue.dev (2023-26)](../lit-review/continuedev-2026-codebase-indexing.md) — embeddings + hybrid retrieval; informs `retrievalModes` capability (Section 5.2).
- [Cline (Rizwan 2023-26)](../lit-review/rizwan-2026-cline.md) — on-demand tool-driven approach; informs Tier 1 baseline (Section 2.1) and `safetyClass` (Section 3.5).
- [Goose (Block / Linux Foundation 2025-26)](../lit-review/block-2026-goose.md) — extension framework; relationship: MCP-native client, downstream consumer.
- [SCIP (Sourcegraph 2023)](../lit-review/sourcegraph-2023-scip.md) — code intelligence indexing format; informs symbol ID format (Section 3.1). Complementary, not competing.

### Evaluation

- [SWE-bench (Jimenez et al. 2023)](../lit-review/jimenez-2023-swebench.md) — future evaluation harness for reference implementation.

### Architectural decisions

- [ADR 0001](../decisions/0001-mcp-extension-vs-new-protocol.md) — ASP as open RFC, formalizing GitNexus-style API.
- [ADR 0002](../decisions/0002-asp-scope-opensource-agent-ecosystem-only.md) — scope: OSS agent ecosystem only.
- [ADR 0003](../decisions/0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md) — reference implementation as dogfood tool.
- [ADR 0004](../decisions/0004-hierarchical-tag-schema-as-asp-capability.md) — hierarchical tags as capability.
- [ADR 0005](../decisions/0005-outreach-deferred-gate-0-to-1-closes-without-user-commitments.md) — outreach deferred to Gate 1 → 2.
- ADR 0006 (forthcoming) — implementation language choice for `asp-ref`.
