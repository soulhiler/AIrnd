# Литературный обзор — Трек 2 (ASP)

Индекс обработанных работ. Обновляется автоматически скриптом `tools/lit-add.sh`, либо вручную.

**Начни с:** [`_prior-art-survey.md`](_prior-art-survey.md) — обзорный survey существующих решений (ретроспективный для Трека 2; для будущих треков должен быть первым шагом).

## Must-read (Фаза 0)

Список из ТЗ — то, что должно быть обработано до Gate 0 → 1:

- [x] LSP specification (Microsoft, microsoft.github.io/language-server-protocol) → [`microsoft-2022-lsp-spec.md`](microsoft-2022-lsp-spec.md)
- [x] Model Context Protocol (Anthropic, modelcontextprotocol.io) → [`anthropic-2024-mcp-spec.md`](anthropic-2024-mcp-spec.md)
- [x] Tree-sitter — incremental parsing (tree-sitter.github.io) → [`brunsfeld-2018-tree-sitter.md`](brunsfeld-2018-tree-sitter.md)
- [x] Aider — открытая архитектура агента (github.com/Aider-AI/aider) → [`gauthier-2024-aider-repomap.md`](gauthier-2024-aider-repomap.md)
- [x] Continue — JS/TS открытый агент (github.com/continuedev/continue) → [`continuedev-2026-codebase-indexing.md`](continuedev-2026-codebase-indexing.md)
- [x] Cline — TypeScript агент (github.com/cline/cline) → [`rizwan-2026-cline.md`](rizwan-2026-cline.md)
- [x] Goose — Rust OSS-агент (block/goose → Linux Foundation AAIF) → [`block-2026-goose.md`](block-2026-goose.md)
- [x] SCIP — индустриальный open spec для code indexing (Sourcegraph) → [`sourcegraph-2023-scip.md`](sourcegraph-2023-scip.md)
- [x] SWE-bench — evaluation benchmark (Princeton NLP) → [`jimenez-2023-swebench.md`](jimenez-2023-swebench.md)
- [ ] Codex CLI (если открыт) — отложено (commercial-adjacent, out of OSS scope ADR 0002)
- [ ] arXiv: «agent code protocol» — отложено (3 ключевых OSS-агента + SCIP + SWE-bench покрывают ландшафт)
- [ ] arXiv: «MCP for code» / «AI-native LSP» — отложено (MCP уже глубоко покрыт)
- [ ] arXiv: «code context retrieval LLM» — отложено (Aider RepoMap + Continue.dev покрывают подход)

## Обработанные работы

| Slug | Title | Year | Relevance | Tags |
|---|---|---|---|---|
| [microsoft-2022-lsp-spec](microsoft-2022-lsp-spec.md) | Language Server Protocol 3.17 Specification | 2022 | 5 | lsp, protocol, primary-source |
| [anthropic-2024-mcp-spec](anthropic-2024-mcp-spec.md) | Model Context Protocol Specification | 2024–2025 | 5 | mcp, protocol, primary-source, agent-integration |
| [brunsfeld-2018-tree-sitter](brunsfeld-2018-tree-sitter.md) | Tree-sitter — Incremental Parsing System | 2018 | 4 | parsing, ast, tool, foundation |
| [patwari-2026-gitnexus](patwari-2026-gitnexus.md) | GitNexus — MCP-Native Knowledge Graph | 2024–2026 | 5 | mcp, code-intelligence, prior-art, **critical** |
| [gauthier-2024-aider-repomap](gauthier-2024-aider-repomap.md) | Aider RepoMap — PageRank-based token-budget-aware code context selection | 2023–2026 | 5 | code-intelligence, tree-sitter, pagerank, token-budget, oss-agent, prior-art |
| [continuedev-2026-codebase-indexing](continuedev-2026-codebase-indexing.md) | Continue.dev — Embeddings + LanceDB + Tree-sitter Hybrid Codebase Indexing | 2023–2026 | 5 | code-intelligence, embeddings, vector-db, lancedb, hybrid-retrieval, oss-agent, prior-art |
| [rizwan-2026-cline](rizwan-2026-cline.md) | Cline — Tool-driven autonomous coding agent (on-demand reading) | 2023–2026 | 5 | code-intelligence, oss-agent, mcp-client, tool-use, on-demand-reading, plan-act-modes, prior-art, **critical** |
| [block-2026-goose](block-2026-goose.md) | Goose — Open-source AI agent с extension framework на MCP (Block → Linux Foundation AAIF) | 2025–2026 | 4 | code-intelligence, oss-agent, mcp-client, extension-framework, rust, linux-foundation, prior-art |
| [sourcegraph-2023-scip](sourcegraph-2023-scip.md) | SCIP — Code Intelligence Protocol (Sourcegraph, преемник LSIF) | 2023 | 5 | code-intelligence, indexing-format, sourcegraph, protobuf, lsif, open-spec, industry-standard, prior-art, **critical** |
| [jimenez-2023-swebench](jimenez-2023-swebench.md) | SWE-bench — Evaluation Benchmark для AI-помощников на реальных GitHub issues (Princeton NLP) | 2023 | 5 | evaluation, benchmark, llm-coding, github-issues, swe-bench, princeton-nlp, must-use |

## Не релевантные (помечены, чтобы не возвращаться)

| Slug | Title | Year | Причина |
|---|---|---|---|
| _нет записей_ | | | |
