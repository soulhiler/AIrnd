# 0003. Reference implementation: clean-room build with GitNexus parity + 5 fixes

- **Дата:** 2026-05-21
- **Статус:** accepted
- **Связанные ADR:** [0001](0001-mcp-extension-vs-new-protocol.md), [0002](0002-asp-scope-opensource-agent-ecosystem-only.md)

## Простыми словами

Раньше мы хотели сделать так: написать **только правила** для AI-помощников (что-то вроде инструкции «как должна быть устроена розетка»), а саму «розетку» (программу) пусть делают другие.

Теперь меняем: **делаем и правила, и саму программу-помощник**. Зачем нам своя программа:

1. Чтобы пользоваться ей в наших проектах вместо GitNexus (у GitNexus 5 раздражающих проблем).
2. Чтобы проверять, что наши правила вообще работают, а не просто красиво написаны на бумаге.

Важно: программу пишем **с нуля**, GitNexus не копируем — у них лицензия запрещает использовать их код в коммерческих проектах. Сначала **дочитываем** про похожие программы у других (Aider, Continue, Cline), и только потом начинаем кодить. Не наоборот.

Программу будем делать в три этапа (маленький, средний, полный) — чтобы не утонуть в объёме сразу.

## Context

ADR 0001 определил ASP как открытую RFC-спецификацию. ADR 0002 сузил scope до open-source agent ecosystem. В обоих ADR **reference implementation** упоминалась как «минимальная, не конкурирующая с GitNexus» — узкий MCP server, который доказывает, что спецификация реализуема.

После dogfooding GitNexus в нашем репо (см. [`lit-review/patwari-2026-gitnexus.md#hands-on-experience`](../lit-review/patwari-2026-gitnexus.md#hands-on-experience-dogfooding-на-нашем-репо-2026-05-21)) обнаружились конкретные UX-pain points (offline-first, fuzzy lookup, standard query language, opt-in instrumentation, explicit degradation). Эти проблемы **нельзя исправить в GitNexus** без contribution к закрытому PolyForm Noncommercial проекту — license сама по себе создаёт стену между нами и нашими собственными use cases.

Параллельно — мы хотим **пользоваться code intelligence в наших проектах** (не только в `AIrnd`, но и в будущих research-репозиториях). GitNexus покрывает базовый use case, но 5 pain points делают его проблематичным для долгосрочного adoption. Альтернатива «жить с проблемами» означает, что Трек 2 строит спецификацию, которой мы сами не пользуемся — слабая dogfood-петля.

Развилка: расширить scope трека до **полноценной reference implementation**, которая (а) реализует ASP, (б) исправляет 5 проблем GitNexus, (в) активно используется в наших проектах. Это сильнее как research contribution и сильнее как dogfood-цикл, но требует существенно больше maintenance.

## Decision

**Reference implementation расширяется от «минимальной» до полноценной альтернативы GitNexus.** Конкретно:

1. **Independent design.** Не fork, не API-compatible с GitNexus. API определяется ASP-спецификацией. GitNexus — prior art, не базис кода. Clean-room implementation.
2. **MVP scope = full parity + 5 fixes.** Все 16 операций GitNexus (index / context / impact / query / cypher / detect_changes / rename / api_impact / shape_check / route_map / tool_map / group_list / group_sync / list_repos + 2 ещё) **плюс** 5 исправлений: offline-first FTS, fuzzy symbol lookup, standard query language, opt-in instrumentation, explicit degradation.
3. **Sequential timing.** Кодинг **не начинается** до закрытия литобзора Gate 0 → 1 (≥10 работ, особенно Aider RepoMap и LSIF/SCIP). Их results влияют на архитектурные choices. Литобзор остаётся приоритетом 1 в ближайшие недели.
4. **Repo location.** Старт в `tracks/02-asp/prototype/`. Extract в отдельный публичный GitHub repo — позже, когда (а) MVP-альфа работает на нашем репо, (б) ASP-спека достаточно стабильна, чтобы оправдать публичный API. Имя инструмента откладывается до extract — сейчас workname `asp-ref`.
5. **License.** Apache 2.0 для будущего публичного repo. Сейчас, в монорепе, — наследуется от родительского репо.

Это означает **обновление gate-критериев**:

- **Gate 0 → 1:** без изменений (литобзор остаётся блокером).
- **Gate 1 → 2 (Design → Prototype):** добавлен пункт «архитектурные ADR для prototype (язык, storage, parser, search) приняты».
- **Gate 2 → 3 (Prototype → Eval):** изменён с «reference server индексирует средний проект» на «reference server реализует ≥80% GitNexus parity + все 5 исправлений + работает на ≥3 OSS-агентах».

## Consequences

### Positive

- **Сильный dogfood-цикл.** Мы пользуемся тем, что специфицируем. Каждая боль в нашем daily workflow становится спецификационным input.
- **Independent от GitNexus license.** Любой наш проект (включая будущие commercial spin-offs) может использовать без юр. диалога с Patwari.
- **Reference implementation как research contribution.** Working code + RFC сильнее, чем только RFC. Preprint можно подкрепить performance numbers и user testimonials.
- **5 fixes как differentiator.** ASP-спека не просто «формализация существующего» — она явно **улучшает** UX по конкретным measured dimensions.
- **Reference как тест-стенд для спецификации.** Любые дизайн-choices ASP-спеки сначала проверяются на reference impl — это catches ambiguities раньше, чем они идут в публичную RFC.

### Negative

- **Resource split.** Один research-проект теперь делает два больших вещей: спека + impl. Maintenance code intelligence-инструмента не дешёвый.
- **Patwari risk.** Если GitNexus author воспринимает нашу impl как конкурента, его мотивация участвовать в ASP-спеке падает. **Mitigation:** в outreach-сообщениях позиционировать reference как «proof, что спека реализуема», не как «лучший GitNexus». Предложить Patwari co-authorship на спеке. Подчеркнуть, что наш scope = OSS-агенты (ADR 0002), не enterprise-конкуренция.
- **Scope creep risk.** «Full GitNexus parity + 5 fixes» — это 2-3 месяца full-time для одного разработчика. **Mitigation:** жёсткое stage-разделение в Gate 2 → 3:
  - **Stage 2a (MVP-alpha):** 5 операций (index, query, context, impact, detect_changes) + 2 из 5 fixes (offline-first FTS, fuzzy lookup). Dogfood на нашем репо.
  - **Stage 2b (MVP-beta):** + 6 операций + ещё 2 fixes. Используется в ≥1 внешнем OSS-агенте.
  - **Stage 2c (parity):** + оставшиеся 5 операций + 5-й fix. Готовность к extract в отдельный repo.
- **Premature optimization risk.** Если литобзор (Aider RepoMap, LSIF/SCIP) откроет fundamentally другой подход — мы должны быть готовы переписать архитектурные choices. **Mitigation:** sequential timing (литобзор первым) минимизирует это.

### Necessary follow-ups

- **Обновить `tracks/02-asp/README.md`:**
  - Описание трека — добавить «+ reference implementation».
  - Gate 1 → 2 — пункт об архитектурных ADR.
  - Gate 2 → 3 — заменить «средний проект» на parity + 5 fixes + dogfood.
- **Будущие архитектурные ADR (после литобзора):**
  - ADR 00NN: язык реализации (TypeScript / Python / Rust / Go) — после оценки tree-sitter / LSP bindings в каждом.
  - ADR 00NN: storage (graph DB outright? SQLite + relations? Kùzu? DuckDB?).
  - ADR 00NN: parser strategy (tree-sitter vs LSP integration vs hybrid).
  - ADR 00NN: search architecture (FTS5? embeddings? hybrid? local vs external?).
  - ADR 00NN: MCP server packaging (stdio / SSE / WebSocket).
- **Создать stub `tracks/02-asp/prototype/README.md`** с описанием: «активируется после Gate 0 → 1 + минимум 3 архитектурных ADR».
- **Outreach update:** в письме Patwari (когда литобзор по GitNexus переподтвердится) — упомянуть план reference impl, попросить feedback на 5 fixes (валидны ли они с его точки зрения).

## Alternatives considered

### Alternative A: Минимальный reference (как изначально в ADR 0001)

Reference impl — только для compliance тестов спецификации, никакого dogfood. Отклонено: теряем dogfood-цикл, теряем differentiator (5 fixes), не получаем working code как research contribution.

### Alternative B: Fork GitNexus

Взять GitNexus codebase, исправить 5 fixes, опубликовать как «GitNexus++». Отклонено: PolyForm Noncommercial license блокирует commercial use наших же будущих проектов. Кроме того, fork — слабый signal независимости.

### Alternative C: API-compatible clean-room rebuild

Реализовать те же 16 MCP tools с теми же сигнатурами, что у GitNexus. Пользователи могут переключаться без изменения кода. Отклонено: ограничивает дизайн ASP-спеки — мы обязаны замораживать GitNexus's design choices, включая те, которые мы хотим исправить (например, Cypher dialect). Зависимость от их evolution.

### Alternative D: Parallel timing (литобзор + код одновременно)

Начать MVP-альфа параллельно с дописанием литобзора. Отклонено: Aider RepoMap и LSIF/SCIP — критическая prior art, которая может fundamentally изменить архитектурные choices. Параллельная работа = риск переделок. Sequential — медленнее по календарю, но дешевле по re-work.

## References

- [ADR 0001](0001-mcp-extension-vs-new-protocol.md) — base scope (RFC-only positioning).
- [ADR 0002](0002-asp-scope-opensource-agent-ecosystem-only.md) — OSS-only audience.
- [`lit-review/patwari-2026-gitnexus.md`](../lit-review/patwari-2026-gitnexus.md) — GitNexus prior art, 5 fixes derived from dogfooding experience.
- [`tracks/02-asp/README.md`](../README.md) — gate criteria (обновляются после accept этого ADR).
