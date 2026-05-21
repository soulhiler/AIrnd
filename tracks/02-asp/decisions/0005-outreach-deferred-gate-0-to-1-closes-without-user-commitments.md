# 0005. Outreach deferred — Gate 0 → 1 closes without user commitments

- **Дата:** 2026-05-21
- **Статус:** accepted
- **Связанные ADR:** [0001](0001-mcp-extension-vs-new-protocol.md), [0002](0002-asp-scope-opensource-agent-ecosystem-only.md), [0003](0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md), [0004](0004-hierarchical-tag-schema-as-asp-capability.md)

## Простыми словами

Изначальный план был такой: прежде чем переходить к написанию стандарта, нужно найти минимум 3 OSS-агента (Cline / Aider / Continue / Goose / GitNexus), которые **готовы попробовать** наш стандарт. Это был один из 7 критериев Gate 0 → 1.

Решение: **этот критерий пропускаем**. Outreach **отложен** до момента, когда у нас есть **черновик спецификации** — потому что без конкретного артефакта нечего показать maintainerам. Сейчас это была бы пустая просьба «поверьте нам».

**Что это значит на практике:**

- Gate 0 → 1 формально **закрывается** (6 из 7 пунктов — достаточно, последний waive-нут с обоснованием).
- Трек **переходит в Phase 1 (Design)** — пишем черновик ASP-спеки.
- Outreach перемещается в Gate 1 → 2 — там его можно будет нормально сделать.

## Context

ADR 0002 (OSS-only scope) определил criterion для Gate 0 → 1: «Минимум 3 экспериментальных пользователя из open-source agent maintainers готовы попробовать». Кандидаты: Cline (Saoud Rizwan), Goose (Linux Foundation AAIF), Aider (Paul Gauthier), Continue.dev team, GitNexus (Abhigyan Patwari).

После завершения lit-review (10/10 работ закрыто в этой сессии) стало очевидно:

1. **Outreach без artifact = abstract request.** Писать maintainerам «мы пишем стандарт, хотите попробовать?» без конкретной спеки/реализации — слабо мотивирует. Они получат сотни таких запросов; наш растворится.
2. **Spec sketch — minimum viable conversation starter.** Когда у нас есть хотя бы `design/03-asp-spec-draft.md` с JSON Schema базовых operations, outreach становится substantive: «вот наш draft, что мы упустили из вашего use case?».
3. **Reference implementation Stage 2a — еще сильнее.** Working MCP server, который Cline может install через `.cline/mcp.json` — реальный demo. Это **более сильный outreach trigger**, чем spec на бумаге.
4. **Gate-criterion 3-users был placeholder.** При написании ADR 0002 мы не знали, что у нас будет так много lit-review разнообразия (10/10), что архитектурная картина sufficient без user feedback на этой фазе.
5. **Lean MVP-философия:** не блокировать прогресс на критерии, который можно закрыть позже более effectively.

Альтернатива «не делать outreach вообще» — отклонена: outreach остаётся **необходимым** для adoption и validation, просто **не сейчас**.

## Decision

**Gate 0 → 1 criterion «3 экспериментальных пользователя» переносится в Gate 1 → 2 (Design → Prototype).** Конкретно:

1. **Gate 0 → 1 — формально закрыт** в части criterion «3 users» с rationale «outreach deferred — see ADR 0005». Остальные 6 критериев закрыты.
2. **Gate 1 → 2 получает добавление:** «Outreach к минимум 3 OSS agent maintainers выполнен; spec sketch + reference impl Stage 2a показан; ≥1 maintainer выразил positive interest (verbal commitment, code review, или PR)».
3. **Outreach стратегия меняется:**
   - **Не «найти добровольцев заранее»**, а «show working artifact и собрать feedback».
   - **Targets remain** (Cline / Goose / Aider / Continue / GitNexus per ADR 0002).
   - **Trigger:** когда есть `design/03-asp-spec-draft.md` + (опционально) `prototype/` MVP-alpha работающий.
4. **Track переходит в Phase 1 (Design).** Главный deliverable — ASP-спека.

Это **не отменяет** outreach как часть трек-плана; **отменяет блокировку** перехода в Phase 1.

## Consequences

### Positive

- **Phase 1 не блокирован** на медленной outreach задаче. Можем сразу писать спеку.
- **Outreach будет substantive.** Maintainer-ы получат concrete artifact, не abstract pitch — выше chance positive engagement.
- **Lean MVP fit.** «Сначала прототип, потом валидация» — стандартная research/product методология.
- **Снижается ego-pressure** — нам не нужно «продавать» идею до того, как сами разобрались.

### Negative

- **Risk «designing in vacuum».** Без user feedback в Phase 1 рискуем сделать spec, не соответствующую real use cases. **Mitigation:**
  - Use cases в `design/02-use-cases.md` извлечены из 10 lit-review работ — empirical grounding есть.
  - Spec writing iteration возможна на основе outreach feedback в Gate 1 → 2.
- **Risk «procrastinating outreach indefinitely».** Если spec writing затягивается, outreach может откладываться месяцами. **Mitigation:**
  - Hard gate-criterion: Phase 1 не закрывается без outreach success.
  - Time-box Phase 1 to ~4 недели по ТЗ — outreach должен начаться к концу Phase 1.
- **GitNexus author не получит heads-up.** Patwari — наш critical stakeholder (formalize his work), он может узнать о spec из публичного outreach instead of personal note. **Mitigation:** добавить отдельный private outreach к Patwari **до публичного release** spec sketch — это **exception** к деферралу.

### Necessary follow-ups

- **Обновить `tracks/02-asp/README.md`:**
  - Gate 0 → 1 criterion 7 (3 users) — пометить как «deferred per ADR 0005».
  - Gate 0 → 1 status — поменять на «closed: 2026-05-21».
  - Gate 1 → 2 — добавить outreach criterion с rationale.
  - «Текущая фаза» — поменять с Фазы 0 на **Фазу 1 (Design)**.
- **Создать `design/03-asp-spec-draft.md`** как initial deliverable Фазы 1. Скелет: Capabilities + Operations + Symbol schema + Error model. Заполняется в течение Phase 1.
- **Запланировать private outreach к Patwari** — exception к деферралу, чтобы не потерять critical stakeholder.
- **Gate-review commit** для Gate 0 → 1 closing.

## Alternatives considered

### Alternative A: Hard-block — найти 3 users до Phase 1

Отказ от перехода в Phase 1 до outreach success. Отклонено: outreach без artifact = низкий success rate; track stalls.

### Alternative B: Eliminate outreach permanently

Не делать outreach вообще, публиковать spec и надеяться на organic adoption. Отклонено: спецификации без validation = paper artifacts, не adopted standards. LSP became standard через **active outreach + Microsoft endorsement**, не organic. Нам нужен active engagement.

### Alternative C: Defer to Gate 2 → 3 (после prototype Stage 2a)

Перенести outreach еще дальше — до working prototype. Отклонено: слишком долго ждать; spec sketch достаточен для conversation start.

### Alternative D: Lightweight outreach now (без commitment ask)

Просто notify maintainerов «мы пишем такую штуку, вот ссылка» — без asking commit. Отклонено: noise, не engagement; не закрывает gate criterion в полезном sense.

## References

- [ADR 0002](0002-asp-scope-opensource-agent-ecosystem-only.md) — original outreach target audience (OSS agents).
- [Lit-review INDEX](../lit-review/INDEX.md) — 10/10 работ закрыто этой сессией; provides empirical grounding для Phase 1 design.
- [`tracks/02-asp/README.md`](../README.md) — gate criteria (обновляется этим ADR).
- Аналогия с LSP: <https://github.com/microsoft/language-server-protocol> — LSP получил adoption через Microsoft + VS Code launch, не предварительный outreach.
