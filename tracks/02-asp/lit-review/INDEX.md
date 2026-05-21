# Литературный обзор — Трек 2 (ASP)

Индекс обработанных работ. Обновляется автоматически скриптом `tools/lit-add.sh`, либо вручную.

**Начни с:** [`_prior-art-survey.md`](_prior-art-survey.md) — обзорный survey существующих решений (ретроспективный для Трека 2; для будущих треков должен быть первым шагом).

## Must-read (Фаза 0)

Список из ТЗ — то, что должно быть обработано до Gate 0 → 1:

- [x] LSP specification (Microsoft, microsoft.github.io/language-server-protocol) → [`microsoft-2022-lsp-spec.md`](microsoft-2022-lsp-spec.md)
- [x] Model Context Protocol (Anthropic, modelcontextprotocol.io) → [`anthropic-2024-mcp-spec.md`](anthropic-2024-mcp-spec.md)
- [x] Tree-sitter — incremental parsing (tree-sitter.github.io) → [`brunsfeld-2018-tree-sitter.md`](brunsfeld-2018-tree-sitter.md)
- [x] Aider — открытая архитектура агента (github.com/Aider-AI/aider) → [`gauthier-2024-aider-repomap.md`](gauthier-2024-aider-repomap.md)
- [ ] Continue — JS/TS открытый агент (github.com/continuedev/continue)
- [ ] Cline — TypeScript агент (github.com/cline/cline)
- [ ] Codex CLI (если открыт) — TypeScript
- [ ] arXiv: «agent code protocol» — поиск + триаж
- [ ] arXiv: «MCP for code» / «AI-native LSP» — поиск + триаж
- [ ] arXiv: «code context retrieval LLM» — поиск + триаж

## Обработанные работы

| Slug | Title | Year | Relevance | Tags |
|---|---|---|---|---|
| [microsoft-2022-lsp-spec](microsoft-2022-lsp-spec.md) | Language Server Protocol 3.17 Specification | 2022 | 5 | lsp, protocol, primary-source |
| [anthropic-2024-mcp-spec](anthropic-2024-mcp-spec.md) | Model Context Protocol Specification | 2024–2025 | 5 | mcp, protocol, primary-source, agent-integration |
| [brunsfeld-2018-tree-sitter](brunsfeld-2018-tree-sitter.md) | Tree-sitter — Incremental Parsing System | 2018 | 4 | parsing, ast, tool, foundation |
| [patwari-2026-gitnexus](patwari-2026-gitnexus.md) | GitNexus — MCP-Native Knowledge Graph | 2024–2026 | 5 | mcp, code-intelligence, prior-art, **critical** |
| [gauthier-2024-aider-repomap](gauthier-2024-aider-repomap.md) | Aider RepoMap — PageRank-based token-budget-aware code context selection | 2023–2026 | 5 | code-intelligence, tree-sitter, pagerank, token-budget, oss-agent, prior-art |

## Не релевантные (помечены, чтобы не возвращаться)

| Slug | Title | Year | Причина |
|---|---|---|---|
| _нет записей_ | | | |
