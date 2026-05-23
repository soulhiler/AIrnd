# Integrating `asp-ref` into your project

Step-by-step guide for plugging `asp-ref` into AI coding agents. Tested
against agents supporting MCP stdio transport (Cline, Goose, Continue,
Cursor, Claude Code).

## TL;DR

```bash
git clone https://github.com/soulhiler/AIrnd.git
cd AIrnd/tracks/02-asp/prototype
npm install && npm run build
./scripts/smoke-test.sh /path/to/your/repo
```

If smoke test prints `OK`, you have a working `asp-ref`. Wire it into your
agent's MCP config below.

## Prerequisites

- Node.js **≥ 20** LTS (uses ESM + `node:test`).
- Disk: ~150 MB for `node_modules` (mostly transformers.js + tree-sitter
  WASMs + Anthropic SDK).
- Network: required **only** the first time you enable embeddings or LLM
  rerank. Everything else is offline.
- No native build tools (gcc / make / Python) needed.

## Build

```bash
cd tracks/02-asp/prototype
npm install
npm run build       # → dist/
npm test            # 43 tests, ~2 sec
```

The resulting `dist/server.js` is the MCP server entry point. It expects
to be invoked with the **repository root** as the first argument (or via
`ASP_REPO_ROOT` env var, or defaults to `cwd`).

```bash
# Run directly:
node dist/server.js /path/to/repo

# Test with a one-shot stdio session:
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}' \
  | node dist/server.js /path/to/repo
```

## Configure your agent

### Cline (VS Code extension)

Add to `.cline/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "asp-ref": {
      "command": "node",
      "args": ["/absolute/path/to/asp-ref/dist/server.js"]
    }
  }
}
```

Restart Cline. On first invocation it'll print:

```text
[asp-ref] Index empty; starting background scan (embeddings=off)...
[asp-ref] Stage 2a scaffold listening on stdio. Repo root: /your/repo
[asp-ref] Initial scan complete: N files, M symbols, X ms.
```

Then in Cline chat: "find all ADRs" / "what breaks if I change function
X" — Cline picks up our tools automatically.

### Goose (CLI / desktop)

`~/.config/goose/config.yaml`:

```yaml
extensions:
  asp-ref:
    type: stdio
    cmd: node
    args:
      - /absolute/path/to/asp-ref/dist/server.js
```

### Continue.dev (VS Code)

`~/.continue/config.json`:

```jsonc
{
  "mcpServers": [
    {
      "name": "asp-ref",
      "command": "node",
      "args": ["/absolute/path/to/asp-ref/dist/server.js"]
    }
  ]
}
```

### Claude Code (this very tool you may be using)

`.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "asp-ref": {
      "command": "node",
      "args": ["tracks/02-asp/prototype/dist/server.js"]
    }
  }
}
```

(See `.mcp.json` in our own repo — exact production config we dogfood
with.)

### Cursor

Cursor's MCP support landed in version 0.45+. Add to settings:

```json
{
  "mcp.servers": {
    "asp-ref": {
      "command": "node",
      "args": ["/absolute/path/to/asp-ref/dist/server.js"]
    }
  }
}
```

## Optional features

### Vector embeddings (semantic search)

Off by default. To enable:

```bash
ASP_ENABLE_EMBEDDINGS=1 node dist/server.js /path/to/repo
```

First run downloads `Xenova/all-MiniLM-L6-v2` (~22 MB) to your user cache
(`~/.cache/huggingface/` on Linux). Subsequent runs are offline.

After this, `asp_retrieve({query: "...", mode: "vector"})` works in your
agent.

To cache the model in a project-local directory instead:

```bash
ASP_MODEL_CACHE=./.asp/models ASP_ENABLE_EMBEDDINGS=1 node dist/server.js .
```

### LLM rerank

Off by default. Two paths:

**Direct Anthropic** (requires API key):

```bash
ASP_ENABLE_EMBEDDINGS=1 \
ASP_RERANK_PROVIDER=anthropic \
ANTHROPIC_API_KEY=sk-ant-... \
node dist/server.js /path/to/repo

# Optional override:
ASP_RERANK_MODEL=claude-sonnet-4-6 node dist/server.js /path/to/repo
```

Then `asp_retrieve({rerank: true})` invokes Claude. Costs ~$0.001-0.01 per
call (Haiku default).

**MCP sampling** (if your agent advertises sampling capability):

```bash
ASP_RERANK_PROVIDER=sampling node dist/server.js /path/to/repo
```

Server requests the LLM call back through the agent — no API key on the
server side. Falls back gracefully if the client doesn't advertise
sampling.

## Smoke test

Quick verification that everything works:

```bash
./scripts/smoke-test.sh /path/to/your/repo
```

Expected output:

```text
1/6  Build artifacts present                  OK
2/6  Initialize handshake                     OK
3/6  tools/list returns N tools               OK (12)
4/6  asp_capabilities returns tier 2          OK
5/6  asp_listFiles returns repo entries       OK (NN entries)
6/6  asp_searchFiles indexes and finds        OK (M matches)

✓ asp-ref smoke test PASSED
```

If a step fails, the script prints the JSON output of the failing call
for debugging.

## Verifying via Claude Code's own MCP wiring

If you run Claude Code inside the AIrnd repo, the `.mcp.json` already
includes asp-ref. After `npm install && npm run build`, restart your
session — Claude Code will load `mcp__asp-ref__*` tools automatically.

Try in chat:

```text
Use asp_capabilities to verify the server is connected.
Then use asp_findByTag with tag "tracks/02-asp/decisions" to list all ADRs.
```

## Security

After the v0.1.1 hardening pass:

### Default-off mutations

`asp_writeFile` and `asp_applyPatch` return `MutationsDisabledError`
(JSON-RPC code `-32109`) unless `ASP_ENABLE_MUTATIONS=1` is set in the
server's environment. This prevents agents that auto-approve tool
calls from clobbering your worktree.

To enable:

```json
{
  "mcpServers": {
    "asp-ref": {
      "command": "node",
      "args": ["/path/to/dist/server.js"],
      "env": { "ASP_ENABLE_MUTATIONS": "1" }
    }
  }
}
```

`asp_applyPatch({dryRun: true})` is also gated — uniformity of policy
trumps the convenience of dry-running without opting in.

### Secret denylist

These filenames are never indexed, listed, or read, even if the user
asks for them by full path:

- `.env`, `.env.*`, `*.env`
- `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`, `id_dsa*`, `id_ecdsa*`
- `credentials.json`, `service-account*.json`
- `.netrc`, `.htpasswd`, `.pgpass`, `kubeconfig`, `aws_credentials`
- `*.kdbx`, `*.gpg`, `*.p12`

These directories are never descended into: `.ssh`, `.aws`, `.gnupg`,
`.gpg`, `.kube`.

This list lives in `src/security.ts` and is shared between the
indexer, the file walker, and the `asp_readFile` / `asp_listFiles`
operations — no asymmetry.

### Symlink containment

Path resolution uses `realpath`, not just `normalize`. If a path
inside your repo is a symlink pointing outside the repo root (or to a
sensitive file), the server rejects with `PathForbiddenError`
(`-32104`) and message `"Path resolves outside repo root via symlink"`.

### Auto-gitignore

On startup the server appends `.asp/` to your `.gitignore` so the
local SQLite index doesn't pollute git status. It will not create a
`.gitignore` outside of a git repo. To disable:
`ASP_SKIP_GITIGNORE=1`.

### npm audit footprint

`npm audit` reports 4 vulnerabilities (3 high + 1 critical) transitive
through `@xenova/transformers → onnxruntime-web → onnx-proto →
protobufjs`. The CVE concern is DoS via malformed protobuf during
deserialisation.

How this affects asp-ref:

- The server is local. Embedding model is hardcoded to
  `Xenova/all-MiniLM-L6-v2` and is not user-configurable through the
  public API, so the trust boundary is "the Xenova HF account is not
  compromised" rather than "the HF hub at large is trusted" (the hub
  is a public CDN with anonymous uploads).
- Embeddings are off by default (`ASP_ENABLE_EMBEDDINGS` unset) — the
  vulnerable code path isn't loaded at all in baseline operation.
- Network egress is limited to the first-time model download from
  Hugging Face Hub and optional Anthropic API calls for LLM rerank.

We have **not** run `npm audit fix --force` because it would upgrade
`@xenova/transformers` to a major version that's ABI-incompatible
with our pinned `tree-sitter-wasms`. We're tracking the migration to
`@huggingface/transformers` (rebrand) which fixes the dep chain.

If you'd rather not have these warnings at all, run with embeddings
disabled (the default) and disable LLM rerank — the vulnerable
package never gets loaded.

### What we did NOT add

- **No approval prompt loop.** ASP relies on the agent's own approval
  UX. Server-side prompt would require MCP elicitation, which most
  clients don't yet support.
- **No sandboxed execution.** Server runs as your user with your
  permissions. If you don't trust the agent, run asp-ref under a
  restricted user account.
- **No automated secret scanning of file contents.** We block by
  filename, not by content. A `notes.txt` containing an API key is
  still readable. PRs welcome.

## Troubleshooting

### "Index empty; starting background scan" hangs

`npm run build` failed. Check `dist/server.js` exists. If not, re-run
`npm run build` and watch for TS errors.

### `asp_searchFiles` returns `degradation: ["partial-index"]`

The background scan hasn't finished yet. Wait a few seconds and retry, or
call `asp_refresh({wait: true})` to force synchronous completion.

### `asp_retrieve` with `mode: "vector"` returns `degradation: ["embeddings"]`

Either:

1. You didn't set `ASP_ENABLE_EMBEDDINGS=1` (embeddings not indexed).
2. Network was blocked on first run and model couldn't download. Check
   `~/.cache/huggingface/` for the model files.

### `asp_retrieve` with `rerank: true` returns `degradation: ["rerank"]`

Provider isn't configured. Set `ANTHROPIC_API_KEY` for direct path, or
`ASP_RERANK_PROVIDER=sampling` for MCP sampling.

### `Index schema version mismatch`

You upgraded `asp-ref` and the existing `.asp/index.db` is from an older
schema. Delete it:

```bash
rm -rf /path/to/repo/.asp
```

Next run will rebuild from scratch.

### `tree-sitter init failed for <lang>`

The WASM grammar for that language isn't bundled (currently 12 langs:
Python, TS/TSX, JS, Rust, Go, Java, C#, Ruby, Bash, C, C++). Other
language files in your repo are silently skipped.

### High memory usage

For repos > ~10k symbols with embeddings enabled, in-memory vector ops
will use ~50 MB per 10k symbols (Float32Array of 384 dims). Disable
embeddings (`ASP_ENABLE_EMBEDDINGS` unset) for smaller memory footprint.

## What to report back

Even minimal feedback is valuable:

- **"It installed"** vs "Step X failed with error Y".
- **Which operations** did your agent actually call? Server logs them to
  stderr; redirect to a file if useful: `node dist/server.js /path 2> asp.log`.
- **Which degradation entries** showed up? Each one is a "Z doesn't work,
  here's why" signal for our roadmap.
- **What was missing?** Operations you expected but didn't find.

Open an issue: <https://github.com/soulhiler/AIrnd/issues>
