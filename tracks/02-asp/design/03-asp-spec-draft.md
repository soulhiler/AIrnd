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

These operations require server-side indexing. Servers MUST advertise the relevant capability to support them. See [Section 5.2](#52-standard-capabilities).

#### 6.3.1 `asp/findByTag`

Find symbols matching a tag. Supports hierarchical prefix matching when the server advertises `tagSchema: "hierarchical"`. Full design: [ADR 0004](../decisions/0004-hierarchical-tag-schema-as-asp-capability.md).

**Required capability:** `tagSchema: "hierarchical"` (for prefix matching) OR `"flat"` (for exact match only). If `tagSchema: "none"`, this operation MUST NOT be advertised.

**Parameters:**

```jsonc
{
  "tag": "tests/unit",           // required: the tag to search for
  "hierarchical": true,          // optional, default true; false = exact match
  "kind": "file",                // optional: filter by symbol kind
  "limit": 100,                  // optional, default 100, max server-defined
  "tokenBudget": 4096            // optional
}
```

**Response:**

```jsonc
{
  "symbols": [
    {
      "id": "file:tests/unit/test_auth.py",
      "kind": "file",
      "tags": ["tests", "tests/unit", "tests/unit/auth", "lang/python"],
      "line": null,
      "tokenSize": 850
    }
  ],
  "totalMatches": 42,
  "truncated": false,
  "degradation": []
}
```

**Errors:**

- `asp_capability_required` if server advertises `tagSchema: "none"`.
- `asp_token_budget_too_small` if budget cannot fit even one symbol record.

#### 6.3.2 `asp/retrieve`

Retrieve relevant symbols for a free-form query, using server-side ranking. Supports two-stage retrieval (vector → optional rerank) inspired by Continue.dev.

**Required capability:** `retrievalModes: [≥1 of "vector"|"keyword"|"graph"|"hybrid"]`.

**Parameters:**

```jsonc
{
  "query": "user authentication flow",  // required: free-form query
  "mode": "hybrid",                     // optional, server-defined default
  "nRetrieve": 50,                      // optional, default 50
  "nFinal": 10,                         // optional, default 10
  "rerank": true,                       // optional, default false
  "filter": {                           // optional, AND combined
    "tags": ["lang/python"],
    "kind": "file",
    "pathPrefix": "src/"
  },
  "tokenBudget": 8192                   // optional
}
```

**Response:**

```jsonc
{
  "symbols": [
    {
      "id": "python:myapp.auth.login_user",
      "kind": "function",
      "tags": ["lang/python", "auth"],
      "score": 0.87,
      "snippet": "def login_user(username, password):\n    ...",
      "tokenSize": 120
    }
  ],
  "truncated": false,
  "modeUsed": "hybrid",
  "rerankApplied": true,
  "degradation": []
}
```

**Errors:**

- `asp_capability_required` if no retrieval mode advertised.
- `asp_mode_unsupported` if requested mode not in `retrievalModes`.

**Implementation notes:** Server MAY ignore `rerank: true` if LLM access unavailable; in this case it MUST include a `degradation` entry: `{"feature": "rerank", "reason": "...", "impact": "..."}`.

#### 6.3.3 `asp/context`

Get rich context for a single symbol: its tags, parent, immediate references, and optionally surrounding code.

**Required capability:** None (this is a basic indexed operation — if server has index, it has context).

**Parameters:**

```jsonc
{
  "symbol": "python:myapp.auth.login_user",  // required: symbol ID
  "includeReferences": true,                  // optional, default false
  "includeReferents": true,                   // optional, default false
  "includeBody": true,                        // optional, default true
  "tokenBudget": 4096
}
```

**Response:**

```jsonc
{
  "symbol": {
    "id": "python:myapp.auth.login_user",
    "kind": "function",
    "tags": ["lang/python", "auth", "callable/function"],
    "parent": "python:myapp.auth",
    "location": {"path": "src/auth.py", "line": 42, "endLine": 67}
  },
  "body": "def login_user(username, password):\n    ...",
  "references": [
    {"id": "python:myapp.session.create", "location": {"path": "src/auth.py", "line": 55}}
  ],
  "referents": [
    {"id": "python:myapp.api.login_endpoint", "location": {"path": "src/api.py", "line": 23}}
  ],
  "truncated": false,
  "degradation": []
}
```

**Definitions:**

- `references` — symbols this symbol calls/uses (outgoing edges).
- `referents` — symbols that call/use this symbol (incoming edges).

**Errors:** `asp_symbol_not_found`.

#### 6.3.4 `asp/impact`

Given a symbol, return affected symbols if it were changed (upstream and/or downstream traversal). Inspired by GitNexus's `impact` operation.

**Required capability:** `impactAnalysis: true`.

**Parameters:**

```jsonc
{
  "symbol": "python:myapp.models.User",       // required
  "direction": "downstream",                   // "upstream" | "downstream" | "both"
  "maxDepth": 3,                               // optional, default 3, max server-defined
  "tokenBudget": 4096
}
```

**Response:**

```jsonc
{
  "symbol": "python:myapp.models.User",
  "downstream": [
    {
      "id": "python:myapp.auth.login_user",
      "depth": 1,
      "edgeKind": "uses",
      "tags": ["lang/python", "auth"]
    }
  ],
  "upstream": [],
  "riskLevel": "high",
  "totalAffected": 23,
  "truncated": false,
  "degradation": []
}
```

**Definitions:**

- `direction: downstream` — symbols affected if this one changes (its referents and their referents, transitively).
- `direction: upstream` — symbols this depends on (its references, transitively).
- `riskLevel` — server-computed heuristic: `low` (<5 affected), `medium` (5-20), `high` (>20). Servers MAY use different thresholds and SHOULD document them.

**Errors:**

- `asp_capability_required` if `impactAnalysis: false`.
- `asp_symbol_not_found`.

### 6.4 Side-effecting and destructive operations

These operations modify the user's filesystem or server-internal state. Clients MUST request user approval before invoking `destructive` operations unless explicitly auto-approved by policy.

#### 6.4.1 `asp/writeFile` (destructive)

Write content to a file. Creates the file if it doesn't exist.

**Required capability:** `mutations: ["writeFile"]` (server-advertised). Servers MAY refuse to advertise this for read-only deployments.

**Parameters:**

```jsonc
{
  "path": "string",              // required, relative to repo root
  "content": "string",           // required
  "createDirs": true,            // optional, default false
  "ifExists": "overwrite"        // "overwrite" | "fail" | "skip", default "fail"
}
```

**Response:**

```jsonc
{
  "path": "src/new.py",
  "bytesWritten": 1234,
  "created": true                 // true if file was newly created
}
```

**Errors:** `asp_path_not_found` (parent dir), `permission_denied`, `file_exists` (if `ifExists: fail`).

#### 6.4.2 `asp/applyPatch` (destructive)

Apply a unified-diff patch to one or more files. Preferred over `writeFile` for code modifications (preserves more context).

**Required capability:** `mutations: ["applyPatch"]`.

**Parameters:**

```jsonc
{
  "patch": "string",             // required, unified diff format (git-compatible)
  "dryRun": false                // optional, default false; if true, validate without applying
}
```

**Response:**

```jsonc
{
  "applied": true,
  "filesAffected": ["src/auth.py", "tests/test_auth.py"],
  "linesAdded": 23,
  "linesRemoved": 5,
  "conflicts": []                // populated if dryRun=true and conflicts detected
}
```

**Errors:** `asp_patch_malformed`, `asp_patch_conflict`.

#### 6.4.3 `asp/refresh` (side-effecting)

Trigger re-indexing of the repository or a subset. May take seconds-to-minutes; consider streaming progress in v0.2.

**Required capability:** indexed servers SHOULD support this; baseline servers MAY refuse.

**Parameters:**

```jsonc
{
  "scope": "incremental",        // "incremental" | "full"
  "paths": ["src/"],             // optional, default whole repo
  "wait": true                   // optional, default true; if false, returns immediately with job ID
}
```

**Response (wait=true):**

```jsonc
{
  "completed": true,
  "filesProcessed": 234,
  "symbolsIndexed": 1820,
  "durationMs": 5670
}
```

**Response (wait=false):**

```jsonc
{
  "jobId": "refresh-abc123",
  "completed": false
}
```

(Job-status polling — TBD in v0.2 streaming spec.)

## 7. Symbol schema

Every operation returning symbols uses a consistent schema. Servers MAY include additional fields, but MUST include at minimum `id` and `kind`.

### 7.1 Core fields (REQUIRED)

```jsonc
{
  "id": "string",       // unique symbol ID, format: <scheme>:<path>[#<anchor>]
  "kind": "string"      // one of: "file", "directory", "section", "function",
                        // "method", "class", "interface", "variable", "constant",
                        // "module", "package", "type", "enum"
}
```

### 7.2 Common fields (OPTIONAL but recommended)

```jsonc
{
  "tags": ["string"],          // hierarchical tags; see Section 3.2
  "location": {
    "path": "string",          // file path
    "line": 42,                // 1-indexed start line
    "endLine": 67,             // 1-indexed end line (optional)
    "column": 4,               // 0-indexed column (optional)
    "endColumn": 23            // (optional)
  },
  "parent": "string",          // ID of parent symbol (e.g., class for method)
  "tokenSize": 850,            // approximate token count of this symbol's body
  "docstring": "string"        // extracted from code comments
}
```

### 7.3 Indexed fields (OPTIONAL, indexed servers)

```jsonc
{
  "score": 0.87,               // ranking score (operation-specific)
  "snippet": "string",         // short excerpt for preview
  "depth": 1,                  // for impact analysis (distance from query symbol)
  "edgeKind": "string"         // for impact: "uses" | "extends" | "implements" | "calls"
}
```

### 7.4 Symbol kind hierarchy

Servers MAY use `kind/...` tags to express finer classification beyond the flat `kind` field. Reserved kind tags:

- `kind/callable/function`
- `kind/callable/method`
- `kind/callable/lambda`
- `kind/type/class`
- `kind/type/interface`
- `kind/type/enum`
- `kind/type/typedef`
- `kind/value/variable`
- `kind/value/constant`
- `kind/container/module`
- `kind/container/package`
- `kind/structural/file`
- `kind/structural/directory`
- `kind/structural/section`

Servers MAY define additional `kind/...` tags but MUST NOT conflict with reserved ones.

### 7.5 Symbol ID grammar

```text
<symbol-id>   ::= <scheme> ":" <path> [ "#" <anchor> ]
<scheme>      ::= <ASCII identifier>          ; e.g., "file", "section", "python", "typescript"
<path>        ::= <URL-encoded string>        ; URL-safe, no whitespace
<anchor>      ::= <URL-encoded string>        ; URL-safe, may contain Unicode
```

Reserved schemes:

- `file` — filesystem path; anchor optional.
- `section` — markdown section; anchor REQUIRED (the heading text).
- `dir` — directory.

Language-specific schemes (`python`, `typescript`, `rust`, etc.) — implementation-defined, but SHOULD use dotted notation matching the language's namespace conventions.

Examples:

- `file:src/main.py`
- `file:src/main.py#L42` (anchor as line number — extension)
- `dir:src/utils/`
- `section:docs/README.md#Getting Started`
- `python:myapp.auth.login_user`
- `typescript:src/utils.ts#parseDate`
- `rust:my_crate::auth::login_user`

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

When a server is operating in a degraded mode (e.g., full-text search unavailable, embedding model not loaded, partial index), it MUST include a `degradation` array in the response. This is **fix #5 from GitNexus dogfooding** (see [GitNexus lit-review](../lit-review/patwari-2026-gitnexus.md)) — silent degradation is a conformance violation.

#### Degradation entry schema

```jsonc
{
  "feature": "string",        // required: short identifier (kebab-case)
  "reason": "string",         // required: human-readable cause
  "impact": "string",         // required: human-readable consequence
  "severity": "warning",      // optional: "info" | "warning" | "error"
  "since": "2026-05-21T10:30:00Z"  // optional: when degradation started
}
```

#### Standard `feature` identifiers (reserved)

| Identifier | Meaning |
|---|---|
| `fts` | Full-text search unavailable; keyword search degraded to substring match |
| `embeddings` | Embedding model not loaded; vector retrieval unavailable |
| `graph-index` | Symbol graph not built; impact analysis unavailable |
| `partial-index` | Some files not yet indexed; results incomplete |
| `rerank` | LLM-based re-ranking unavailable; results use first-stage ranking only |
| `rate-limit` | External service (embedding API, etc.) rate-limited |
| `language-parser-missing` | Tree-sitter parser for one or more languages not loaded |

Implementations MAY define additional identifiers but MUST NOT conflict with reserved ones.

#### Examples

**Example 1: FTS unavailable in keyword search**

```jsonc
{
  "matches": [...],
  "truncated": false,
  "degradation": [
    {
      "feature": "fts",
      "reason": "SQLite FTS5 extension not loaded",
      "impact": "Search results use substring matching; ranking quality reduced",
      "severity": "warning"
    }
  ]
}
```

**Example 2: Rerank requested but model unavailable**

```jsonc
{
  "symbols": [...],
  "modeUsed": "hybrid",
  "rerankApplied": false,
  "degradation": [
    {
      "feature": "rerank",
      "reason": "OpenAI API key not configured; LLM rerank skipped",
      "impact": "Results ordered by first-stage embedding similarity only",
      "severity": "info"
    }
  ]
}
```

**Example 3: Partial index during initial scan**

```jsonc
{
  "symbols": [...],
  "totalMatches": 42,
  "degradation": [
    {
      "feature": "partial-index",
      "reason": "Initial scan in progress: 67% complete",
      "impact": "Some matches may be missing; results will be more complete after refresh",
      "severity": "warning"
    }
  ]
}
```

#### Empty degradation

When operating normally, servers MUST return `degradation: []` (not omit the field). Clients MAY rely on its presence to confirm conformance.

## 9. Security considerations

ASP servers operate on potentially sensitive repositories and execute file-modifying operations. Implementations MUST address the following.

### 9.1 Path traversal protection

`asp/readFile`, `asp/listFiles`, `asp/writeFile`, and `asp/applyPatch` MUST reject paths that escape the configured repository root via `../` traversal or absolute paths.

Conformant servers MUST:

- Normalize all paths relative to a single repo root configured at startup.
- Reject paths resolving outside that root with error `-32104 asp_path_forbidden`.
- Reject paths matching server-configured deny patterns (e.g., `.env`, `.git/`, `node_modules/`).

### 9.2 Authentication and authorization

ASP inherits MCP's transport-level authentication. The spec does not define additional auth schemes.

Servers SHOULD operate with the **least privilege** filesystem permissions sufficient for their declared capabilities. A read-only server (no `mutations` capability) SHOULD run as a user without write access to the repo.

### 9.3 Sensitive content filtering

Servers MUST honor `.gitignore` by default unless `respectGitignore: false` is explicitly set (which itself SHOULD require a privileged client).

Servers SHOULD additionally filter files matching common secret patterns:

- `.env`, `.env.*`, `*.env`
- `*.pem`, `*.key`, `id_rsa*`
- `credentials.json`, `service-account.json`
- Implementation-specific patterns (e.g., `.aspignore`)

When a sensitive file is encountered during indexing or listing, servers MUST either skip it silently or include it without contents — but MUST NOT leak the contents through any operation.

### 9.4 Rate limiting

Servers MAY apply rate limits to expensive operations (`asp/refresh`, `asp/retrieve` with `rerank: true`). When rate-limited, servers MUST:

- Return error `-32105 asp_rate_limited` with a `data.retryAfterSeconds` hint.
- Include `degradation: [{"feature": "rate-limit", ...}]` in subsequent partial responses if the client retries with reduced parameters.

### 9.5 Audit logging (recommendation)

Servers SHOULD log destructive operations (`asp/writeFile`, `asp/applyPatch`) with at least:

- Timestamp.
- Operation name.
- Affected path(s).
- Client identity (from MCP `initialize.clientInfo`).

This is a recommendation, not a requirement; sensitive deployments may need additional logging.

### 9.6 Token budget as a security boundary

`tokenBudget` MAY be used to limit information exposure in shared environments. Servers MAY enforce a maximum `tokenBudget` per request that is smaller than what the client requests, returning a degraded response with `degradation: [{"feature": "budget-clamped", ...}]`.

### 9.7 Network egress (for hybrid implementations)

Servers using external services (embedding APIs, LLM rerank, etc.) MUST:

- Advertise external dependencies in capabilities (TBD: `externalServices` field in v0.2).
- Provide configuration to disable external calls (run fully offline).
- Honor enterprise proxy / firewall configurations.

This is **fix #1 from GitNexus dogfooding** — make external dependencies explicit and disable-able.

## 10. Future work

Items deferred to v0.2+:

- Streaming responses for long operations.
- Cross-repo queries (one server, multiple repos).
- Incremental indexing notifications.
- Tag conflict resolution between sources.
- Multilingual tag content (non-ASCII).

## A. Examples

End-to-end JSON-RPC examples for each operation. All examples assume server capabilities advertised in [Section 5.1](#51-capability-negotiation).

### A.1 Initialize handshake

**Request:**

```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "asp": {"version": "0.1"}
    },
    "clientInfo": {"name": "my-agent", "version": "1.0.0"}
  },
  "id": 1
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "asp": {
        "version": "0.1",
        "tier": 2,
        "tagSchema": "hierarchical",
        "tagSources": ["path", "markdown-headings"],
        "retrievalModes": ["keyword", "graph"],
        "impactAnalysis": true,
        "streaming": false,
        "tokenBudget": {"default": 4096, "max": 32768},
        "mutations": []
      }
    },
    "serverInfo": {"name": "asp-ref", "version": "0.1.0"}
  },
  "id": 1
}
```

### A.2 `asp/readFile`

**Request:**

```json
{
  "jsonrpc": "2.0",
  "method": "asp/readFile",
  "params": {
    "path": "src/auth.py",
    "lineRange": {"start": 40, "end": 70},
    "tokenBudget": 2048
  },
  "id": 2
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": "def login_user(username, password):\n    user = User.objects.get(username=username)\n    ...",
    "truncated": false,
    "totalLines": 234,
    "encoding": "utf-8",
    "degradation": []
  },
  "id": 2
}
```

### A.3 `asp/findByTag` (hierarchical)

**Request:** Find all symbols under `tests/unit`.

```json
{
  "jsonrpc": "2.0",
  "method": "asp/findByTag",
  "params": {
    "tag": "tests/unit",
    "hierarchical": true,
    "tokenBudget": 4096
  },
  "id": 3
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "symbols": [
      {
        "id": "file:tests/unit/test_auth.py",
        "kind": "file",
        "tags": ["tests", "tests/unit", "tests/unit/auth", "lang/python"],
        "tokenSize": 850
      },
      {
        "id": "file:tests/unit/test_session.py",
        "kind": "file",
        "tags": ["tests", "tests/unit", "tests/unit/session", "lang/python"],
        "tokenSize": 620
      }
    ],
    "totalMatches": 2,
    "truncated": false,
    "degradation": []
  },
  "id": 3
}
```

### A.4 `asp/retrieve` (hybrid mode with rerank)

**Request:**

```json
{
  "jsonrpc": "2.0",
  "method": "asp/retrieve",
  "params": {
    "query": "user authentication flow",
    "mode": "hybrid",
    "nRetrieve": 50,
    "nFinal": 5,
    "rerank": true,
    "filter": {"tags": ["lang/python"], "pathPrefix": "src/"},
    "tokenBudget": 8192
  },
  "id": 4
}
```

**Response (with rerank failure degradation):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "symbols": [
      {
        "id": "python:myapp.auth.login_user",
        "kind": "function",
        "tags": ["lang/python", "auth"],
        "score": 0.87,
        "snippet": "def login_user(username, password):\n    user = User.objects.get(...)",
        "tokenSize": 120,
        "location": {"path": "src/auth.py", "line": 42, "endLine": 67}
      }
    ],
    "truncated": false,
    "modeUsed": "hybrid",
    "rerankApplied": false,
    "degradation": [
      {
        "feature": "rerank",
        "reason": "OpenAI API key not configured",
        "impact": "Results ordered by first-stage similarity only",
        "severity": "info"
      }
    ]
  },
  "id": 4
}
```

### A.5 `asp/impact` (downstream)

**Request:** What breaks if I change `User` model?

```json
{
  "jsonrpc": "2.0",
  "method": "asp/impact",
  "params": {
    "symbol": "python:myapp.models.User",
    "direction": "downstream",
    "maxDepth": 3
  },
  "id": 5
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "symbol": "python:myapp.models.User",
    "downstream": [
      {
        "id": "python:myapp.auth.login_user",
        "kind": "function",
        "depth": 1,
        "edgeKind": "uses",
        "tags": ["lang/python", "auth"]
      },
      {
        "id": "python:myapp.api.login_endpoint",
        "kind": "function",
        "depth": 2,
        "edgeKind": "calls",
        "tags": ["lang/python", "api"]
      }
    ],
    "upstream": [],
    "riskLevel": "medium",
    "totalAffected": 11,
    "truncated": false,
    "degradation": []
  },
  "id": 5
}
```

### A.6 Error response

**Request:** Call `asp/impact` on a server that doesn't support it.

**Response:**

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32100,
    "message": "Operation requires capability `impactAnalysis: true`, server advertises `impactAnalysis: false`",
    "data": {
      "operation": "asp/impact",
      "missingCapability": "impactAnalysis"
    }
  },
  "id": 5
}
```

## B. JSON Schemas

Machine-readable schemas for core types. Operation parameter/response schemas — TBD in v0.2 (will be auto-generated from TypeScript types in `asp-ref`).

### B.1 Symbol

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://asp.dev/schema/v0.1/Symbol.json",
  "title": "Symbol",
  "type": "object",
  "required": ["id", "kind"],
  "additionalProperties": true,
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-zA-Z][a-zA-Z0-9_-]*:[^#]*(#.*)?$",
      "description": "Symbol ID: <scheme>:<path>[#<anchor>]"
    },
    "kind": {
      "type": "string",
      "enum": [
        "file", "directory", "section", "function", "method",
        "class", "interface", "variable", "constant", "module",
        "package", "type", "enum"
      ]
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[\\w-]+(/[\\w-]+)*$"
      }
    },
    "location": {"$ref": "#/$defs/Location"},
    "parent": {"type": "string"},
    "tokenSize": {"type": "integer", "minimum": 0},
    "docstring": {"type": "string"},
    "score": {"type": "number"},
    "snippet": {"type": "string"},
    "depth": {"type": "integer", "minimum": 0},
    "edgeKind": {"type": "string"}
  },
  "$defs": {
    "Location": {
      "type": "object",
      "required": ["path"],
      "properties": {
        "path": {"type": "string"},
        "line": {"type": "integer", "minimum": 1},
        "endLine": {"type": "integer", "minimum": 1},
        "column": {"type": "integer", "minimum": 0},
        "endColumn": {"type": "integer", "minimum": 0}
      }
    }
  }
}
```

### B.2 Capability negotiation (server advertised)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://asp.dev/schema/v0.1/AspCapabilities.json",
  "title": "AspCapabilities",
  "type": "object",
  "required": ["version", "tier"],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+$"
    },
    "tier": {"type": "integer", "enum": [1, 2]},
    "tagSchema": {
      "type": "string",
      "enum": ["hierarchical", "flat", "none"],
      "default": "none"
    },
    "tagSources": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["path", "manual", "markdown-headings", "llm-inferred"]
      }
    },
    "retrievalModes": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["vector", "keyword", "graph", "hybrid"]
      }
    },
    "impactAnalysis": {"type": "boolean", "default": false},
    "streaming": {"type": "boolean", "default": false},
    "tokenBudget": {
      "type": "object",
      "properties": {
        "default": {"type": "integer", "minimum": 1},
        "max": {"type": "integer", "minimum": 1}
      }
    },
    "mutations": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["writeFile", "applyPatch"]
      }
    }
  }
}
```

### B.3 DegradationEntry

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://asp.dev/schema/v0.1/DegradationEntry.json",
  "title": "DegradationEntry",
  "type": "object",
  "required": ["feature", "reason", "impact"],
  "properties": {
    "feature": {
      "type": "string",
      "description": "Short kebab-case identifier"
    },
    "reason": {"type": "string"},
    "impact": {"type": "string"},
    "severity": {
      "type": "string",
      "enum": ["info", "warning", "error"],
      "default": "warning"
    },
    "since": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

### B.4 Future schemas

- All `asp/*` operation parameter and response schemas — to be auto-generated from `asp-ref` TypeScript source (ADR 0006).
- Composite types (e.g., `ImpactResult`, `RetrieveResult`) — defined inline in operation sections for now; will be factored out in v0.2.

## C. Changelog

- **2026-05-21 (initial):** Draft v0.1 skeleton created. Sections 1-3, 5-6 with structure and key paragraphs; 4, 7-10 with TBDs.
- **2026-05-21 (expansion 1):** Filled Section 6.3 (indexed operations: findByTag, retrieve, context, impact — all with full request/response schemas), Section 6.4 (writeFile, applyPatch, refresh), Section 7 (Symbol schema with required/optional fields + ID grammar + 14 reserved kind tags), Section 8.2 (degradation signals with 7 reserved feature identifiers + 3 worked examples), Section A (6 end-to-end JSON-RPC examples). Still TBD: Section 9 (security), Section B (formal JSON Schemas).

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
