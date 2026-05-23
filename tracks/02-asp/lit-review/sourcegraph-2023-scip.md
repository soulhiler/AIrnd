# SCIP — SCIP Code Intelligence Protocol (Sourcegraph, преемник LSIF)

## Простыми словами

**SCIP** (читается «скип») — индустриальный стандарт для **сохранения карты кода** проекта в файл. Эту карту потом загружают разные инструменты (Sourcegraph для поиска по коду, GitLab для подсветки определений, всякие IDE для навигации). SCIP — это **второе поколение** такого формата (первое было LSIF), сделано той же компанией Sourcegraph.

**Главные улучшения по сравнению с LSIF:**

- **В 10 раз быстрее** обрабатывается на сервере непрерывной интеграции (CI).
- **В 4 раза меньше места** занимает после сжатия.
- **Имена символов читаемые** для человека, а не загадочные числа.

**Почему важно для нашего стандарта ASP:**

1. SCIP — это **формат индекса**, не **протокол общения**. Это **другой уровень**: ASP — про живое взаимодействие сервера и клиента, SCIP — про снимок кода, лежащий в файле. Они **не конкурируют**, они **дополняют**.
2. SCIP может быть **внутренним форматом** реализации ASP-сервера. Наш `asp-ref` может построить индекс в формате SCIP, потом обслуживать ASP-запросы поверх него.
3. SCIP — пример **успешной открытой спецификации в области code intelligence**. Он принят Sourcegraph, GitLab. Это **наш образец для подражания** в плане governance и adoption.

## Metadata

- **Authors:** Sourcegraph (Beyang Liu, Quinn Slack, и др.); large contributor community
- **Year:** 2023 (announced; replaces LSIF which was 2019)
- **Venue:** Open-source spec ([sourcegraph/scip](https://github.com/sourcegraph/scip), 633★, Apache 2.0); Protobuf-based schema; production adoption в Sourcegraph 4.5+ (LSIF deprecated); GitLab evaluating native support (issue #412981)
- **arXiv / DOI:** —
- **Citation key:** sourcegraph-2023-scip
- **Дата прочтения:** 2026-05-21
- **Relevance (1–5):** **5** — критическая prior art **для нашего трека**. SCIP — единственный production-grade open spec в области code intelligence. Его design choices (Protobuf, human-readable symbols, language-agnostic) — это **design lessons для нашего ASP**.
- **Tags:** code-intelligence, indexing-format, sourcegraph, protobuf, lsif, open-spec, industry-standard, prior-art, **critical**

## TL;DR

SCIP — language-agnostic open spec для индексирования source code, замена LSIF (Language Server Index Format). Protobuf-based schema, human-readable symbol IDs (вместо opaque numeric monikers в LSIF). Production использование в Sourcegraph (4.5+ exclusive), evaluation в GitLab. Empirical improvements over LSIF: **10× faster CI** (when replacing lsif-node with scip-typescript), **4× smaller compressed indexes**. Language bindings: Go, Rust, TypeScript, Haskell. Indexers shipped: scip-typescript, scip-java, scip-python. **Это **прецедент open spec** в нашей области**, который мы можем использовать как governance reference.

## Key claims

- **Claim 1 — «Human-readable symbol IDs vs opaque numeric monikers».** Quote (Sourcegraph blog): *«SCIP provides more ergonomic debugging thanks to being centered around human-readable symbols instead of opaque numeric IDs, and reduced need to bookkeep unnecessary abstractions like import/export monikers»*. **Это direct UX lesson для ASP** — symbols MUST be human-readable strings, не UUIDs или opaque IDs. **ADR-implication:** ASP symbol format будет string-based (как мы уже планируем).
- **Claim 2 — «10× speedup и 4× smaller indexes vs LSIF».** Quote: *«10x speedup in CI was experienced when replacing lsif-node with scip-typescript»*, *«LSIF indexes are on average 4x larger when gzip compressed compared to equivalent SCIP payloads»*. **Empirical evidence**, что well-designed open spec может быть **dramatically more efficient** than its predecessor. Encourages нас investinto solid initial design.
- **Claim 3 — «Protobuf-based schema».** Не JSON, не plain text. Protobuf — strongly-typed, binary-compact, language-agnostic через generated bindings. **Trade-off для ASP:**
  - **Pros:** size efficiency, type safety, language bindings.
  - **Cons:** less human-debuggable than JSON; requires schema compilation tooling.
  - **Decision pending:** для wire format ASP (поверх MCP) — JSON более natural (MCP uses JSON-RPC). Но для **persistent index format** (если мы вводим что-то типа `.asp/index.scip`) — Protobuf compelling.
- **Claim 4 — «Reused в нескольких products».** Sourcegraph (primary), GitLab (evaluating native support), generic CLI tooling. **Это adoption pattern мы хотим**: multiple consumers, не one-vendor lock.
- **Claim 5 — «Replaced predecessor».** Sourcegraph **dropped LSIF support entirely** in v4.6 — migration forced. Это **bold governance move**: показывает, что **они верят в SCIP enough to break compatibility**. **Lesson:** open specs могут эволюционировать с breaking changes, если value-add clear.

## Methodology

SCIP development methodology — Sourcegraph internal, then open. Validation:

- **Performance benchmarks** опубликованы (10× CI speedup, 4× size reduction).
- **Production deployment** на Sourcegraph (their primary product) — battle-tested.
- **Migration path** clear: LSIF → SCIP в Sourcegraph 4.5; mandatory before 4.6.
- **Language bindings** maintained: Go, Rust, TypeScript, Haskell — sufficient for ecosystem.

## Gap (для нашего трека)

### Что SCIP НЕ покрывает (где ASP добавляет ценность)

- **SCIP — index format (data at rest), не protocol (interactive queries).** SCIP describes «как сохранить index в файл»; ASP describes «как агенту общаться с code intelligence server». Это **разные уровни абстракции**. SCIP может быть **внутренним storage format** ASP-server.
- **No agent-oriented operations.** SCIP defines: Symbol, Document, Occurrence, SymbolInformation, Relationship — все **passive data structures**. Нет operation like «найди символ под бюджетом токенов» или «найди иерархический tag». Эти **agent-needs** именно ASP должен закрыть.
- **No capability negotiation.** SCIP — single fixed schema. ASP introduces capability advertising — два server могут implement different subsets of ASP.
- **No streaming / incremental.** SCIP index — снимок. ASP server может handle real-time updates (file changed → invalidate index entry).
- **Flat Kind enum (86+ values).** Уже обсуждалось в нашем ADR 0004 — SCIP не имеет hierarchical tags. Это **точно gap который ASP закрывает.**
- **Flat SymbolRole bitset.** Definition / Import / WriteAccess / ReadAccess / Generated / Test — useful, но опять плоский. **ASP hierarchical tags** дополняют.

### Что из SCIP стоит переиспользовать в ASP

1. **Human-readable symbol IDs** — **must-have in ASP spec.** UX win.
2. **Language-agnostic design** — schema independent of programming language. ASP **inherits this**.
3. **`Document` / `Occurrence` / `SymbolInformation` triad** — clean separation. ASP может **reuse term-ology**: ASP `Symbol` ≈ SCIP `SymbolInformation`, ASP `Reference` ≈ SCIP `Occurrence`.
4. **Versioning approach** — Sourcegraph showed: bump version, migrate, drop old. ASP должна plan version evolution similarly.
5. **Migration tooling** — `scip` CLI tool. Реализатор может **convert SCIP indexes to ASP symbol stream**, давая existing SCIP indexes immediate value через ASP.
6. **Reserved namespaces** в SCIP symbol format (scheme/package/descriptors) — informs our reserved namespaces decision (см. ADR 0004 — `kind/`, `heading/`, `lang/`).

### Cross-pollination возможности

- **«SCIP for storage, ASP for queries»** — clear design pattern. `asp-ref` Stage 2a-2b может **import SCIP indexes** as storage backend, реализуя ASP operations поверх.
- **Sourcegraph как outreach** — они verkhneie стандартизаторы в области. Их endorsement ASP — huge signal. Outreach: **possible after spec v0.1 is stable.**

## Open questions

- **Q1: Adoption beyond Sourcegraph?** GitLab evaluating (issue #412981), но не production. Other indexers / IDEs? Это measures, насколько SCIP **truly indust ry standard** vs «Sourcegraph internal exposed как open».
- **Q2: Performance ASP-server поверх SCIP storage** — viable approach или overhead? Это **архитектурный choice** для `asp-ref`, который надо experimentally validate в Stage 2a.
- **Q3: SCIP evolution roadmap** — что они planируют для v3? Если planируют capability negotiation — это **direct overlap** with ASP. Coordination needed.
- **Q4: Why SCIP only at 633★?** Format spec с production adoption в multi-billion company — но little attention в community. **Visibility — потенциальный gap, который ASP может закрыть** через better positioning.

## Related work cited

- **SCIP source:** <https://github.com/sourcegraph/scip>.
- **SCIP announcement blog:** <https://sourcegraph.com/blog/announcing-scip>.
- **LSIF spec:** <https://github.com/microsoft/lsif-node> — predecessor, Microsoft-driven.
- **scip-typescript, scip-java, scip-python** — language indexers from Sourcegraph.
- **GitLab evaluation issue:** <https://gitlab.com/gitlab-org/gitlab/-/issues/412981>.
- **LSP spec** (уже в lit-review) — adjacent но different (real-time IDE protocol).

## Личные заметки

### Что зацепило

- **Sourcegraph fully migrated.** Дropping LSIF support entirely в v4.6 — sign of conviction. Когда мы будем эволюционировать ASP — нужна similar political courage.
- **10× / 4× empirical improvements.** Strong reminder, что **первый дизайн редко optimal**. Naш ASP v0.1 будет иметь подобные revisions; не лезть в early optimization.
- **Protobuf choice** — серьёзный architectural commitment. **Cuts against MCP/JSON ecosystem**. Это значит SCIP — index format, не protocol. И **наш ASP должен оставаться JSON-RPC** для compatibility с MCP.
- **Single source of truth (Sourcegraph)** — both pro (focused stewardship) and con (single-vendor risk).

### С чем не согласен

- **No capability negotiation in SCIP** — это omission. Indexers могут produce различные subsets (полная info vs lightweight). Без capability field consumer не знает what to expect.
- **Symbol format complexity** — SCIP symbol format spec нетривиален (scheme + package + descriptors). Это barrier to entry для new languages. **ASP should be simpler** для basic capabilities, опциональный complexity для advanced.

### Идеи для ASP design

1. **Symbol ID format inspired by SCIP** — human-readable string with structured optional parts. **Простейший:** path-based для files / sections (`tracks/02-asp/lit-review/foo.md#Section`), namespace-based для code symbols (`python:django.contrib.auth.User`).
2. **Storage backend choice для `asp-ref` Stage 2:** SCIP может быть compelling — Apache 2.0 spec, production-tested, language bindings exist. **Альтернативы:** custom SQLite schema (lighter, less ecosystem), JSON Lines (simpler, no schema validation). **Решается в архитектурном ADR.**
3. **Outreach Sourcegraph** — possibly после spec v0.1 stable. Они natural partner: SCIP for storage + ASP for queries = full code intelligence stack.
4. **ASP version evolution policy** — заимствовать Sourcegraph's pattern: backward-compatibility for one major version, then drop. **Записать в спеке v0.1 explicitly.**

### Cross-references

- **ADR 0001:** SCIP подтверждает, что open code intelligence specs viable. Reinforces our positioning.
- **ADR 0002:** Sourcegraph — **enterprise**, не OSS-agent. Per ADR 0002 — не в наш target audience for spec adoption. Но **technical partner** для storage backend.
- **ADR 0003:** SCIP — potential storage backend для `asp-ref` Stage 2 (рассмотреть в архитектурном ADR).
- **ADR 0004:** SCIP's flat Kind enum + flat SymbolRole bitset — это **precisely the gap** мы закрываем hierarchical tags. ADR 0004 теперь имеет stronger justification.
- **LSP lit-review:** LSP (real-time IDE protocol) vs SCIP (offline index format) vs ASP (agent-server query protocol) — три complementary, не competing layers.
