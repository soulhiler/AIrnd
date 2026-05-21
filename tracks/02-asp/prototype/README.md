# ASP Reference Implementation (workname: `asp-ref`)

**Статус:** заморожено до закрытия [Gate 0 → 1](../README.md#gate-0--1) и принятия архитектурных ADR.

## Назначение

Clean-room reference implementation ASP-спецификации (см. [ADR 0001](../decisions/0001-mcp-extension-vs-new-protocol.md), [ADR 0003](../decisions/0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md)).

Цели:

1. **Доказать реализуемость ASP-спеки** — спецификация без working code = бумажка.
2. **Исправить 5 UX-проблем GitNexus** — offline-first FTS, fuzzy lookup, standard query language, opt-in instrumentation, explicit degradation (см. [`lit-review/patwari-2026-gitnexus.md`](../lit-review/patwari-2026-gitnexus.md)).
3. **Стать dogfood-tool** — заменить GitNexus в наших research-репозиториях (AIrnd и будущих).
4. **Достичь GitNexus parity по операциям** — все 16 MCP tools покрыты (см. ADR 0003 stages).

## Что **не** делается здесь

- Не fork GitNexus.
- Не API-compatible с GitNexus (несовместимое API — fix #3 = standard query language).
- Не конкурент для enterprise rollout (см. [ADR 0002](../decisions/0002-asp-scope-opensource-agent-ecosystem-only.md): scope = OSS-агенты).

## Pre-conditions для старта кодинга

1. **Gate 0 → 1 закрыт** — литобзор включает Aider RepoMap, LSIF/SCIP, Continue.dev, Cline (их решения влияют на архитектуру).
2. **Минимум 3 архитектурных ADR приняты:**
   - Язык реализации.
   - Storage backend.
   - Parser strategy.
3. **ASP spec v0.1 sketch существует** — хотя бы черновик типов и операций в [`design/03-asp-spec-draft.md`](../design/03-asp-spec-draft.md) (TBD).

## Stages (см. ADR 0003 § Scope creep risk)

- **Stage 2a (MVP-alpha):** 5 операций (`index`, `query`, `context`, `impact`, `detect_changes`) + 2 fixes (offline-first FTS, fuzzy lookup). Dogfood на AIrnd репо.
- **Stage 2b (MVP-beta):** + 6 операций (`rename`, `cypher`, `api_impact`, `shape_check`, `route_map`, `tool_map`) + 2 fixes (standard query language, opt-in instrumentation). Использование ≥1 внешним OSS-агентом.
- **Stage 2c (parity):** + остальные 5 операций (`group_list`, `group_sync`, `list_repos`, + 2 ASP-specific) + 5-й fix (explicit degradation). Extract в отдельный публичный repo.

## Текущее имя

Workname: `asp-ref`. Финальное имя — выбирается перед extract (Stage 2c). До этого не зацикливаемся.

## Файлы здесь

- `README.md` (этот файл) — pre-conditions и stages.
- Код появится после старта Stage 2a.
