# 0002. ASP scope: open-source agent ecosystem only

- **Дата:** 2026-05-21
- **Статус:** accepted
- **Связанные ADR:** [0001](0001-mcp-extension-vs-new-protocol.md) (refines scope)

## Context

ADR 0001 закрепил позиционирование ASP как **открытой RFC-спецификации** для code intelligence MCP API. Но **target audience** оставался размытым — упоминались Cursor, Claude Code (commercial), Continue, Aider, Cline (open-source) на одном уровне.

При планировании литобзора Gate 0 → 1 (требование ≥10 ключевых работ + ≥3 экспериментальных пользователя) стало очевидно, что **смешанная аудитория размывает решения**:

- **Commercial-агенты** (Cursor, Claude Code, Windsurf) — закрытые. Адаптация ASP требует business-development цикла, легального согласования, partnership-договоров. Мы — research-программа без юридического лица, без бюджета на B2B-outreach. Реалистичная вероятность adoption на горизонте трека — близко к нулю.
- **Open-source агенты** (Aider, Continue.dev, Cline, agentic-codebase, Goose) — открытые, имеют maintainer-ов, доступных через GitHub. Им нужно общее интерфейсное решение, потому что у каждого свой ad-hoc подход к code navigation (RepoMap у Aider, embeddings у Continue, etc.). Adoption по PR / discussion на горизонте 3-6 месяцев реалистичен.
- **GitNexus** — открытая (хотя и PolyForm Noncommercial). Автор Patwari доступен. По ADR 0001 он — критический stakeholder.

Если ASP пишется «для всех», design-choices начинают компрометироваться. Пример: commercial-агенты могут требовать payment metering hooks в протоколе. OSS-агенты — наоборот, требуют zero-overhead. Невозможно угодить обоим без splittables, которые делают спецификацию слабой.

## Decision

**ASP пишется исключительно для open-source agent ecosystem.** Конкретно:

1. **Target users (Gate 0 → 1):** maintainer-ы open-source агентов и code intelligence серверов. Перечень кандидатов:
   - Paul Gauthier (Aider) — RepoMap, Tree-sitter-based context selection.
   - Continue.dev team — open-source LSP-like agent for VS Code/JetBrains.
   - Cline maintainer (Saoud Rizwan) — open-source agent с продвинутым tool use.
   - Abhigyan Patwari (GitNexus) — author of dominant prior art.
   - Goose team (Block) — Apache-2 licensed agent.
2. **Target prior art в lit-review:** open-source реализации codebase indexing для агентов + смежные open-source standards.
3. **Design constraints:** zero-cost compliance для OSS-сервера (нет payment hooks, нет telemetry-required, нет authentication beyond MCP baseline).
4. **License:** Apache 2.0 для спецификации и reference implementation. Permissive — чтобы commercial-агенты при желании могли добровольно реализовать ASP без юридического диалога с нами.
5. **Outreach стратегия:** publish-and-engage в OSS-каналах (GitHub Discussions, Discord, Reddit r/LocalLLaMA) — не B2B sales.

Commercial-агенты **не исключаются** из потенциальных пользователей — но они **не учитываются** при design-choices и не входят в gate-критерий «3 экспериментальных пользователя».

## Consequences

### Positive

- **Реалистичный target.** Open-source maintainer-ы открыты для PR / discussion — мы можем получить feedback за дни-недели, а не за месяцы B2B-цикла.
- **Дизайн без компромиссов.** Спецификация может быть максимально lean: только то, что нужно OSS-агентам.
- **Чёткий план литобзора.** Список prior art конечен и достижим: Aider RepoMap, Continue indexing, Cline approach, GitNexus, agentic-codebase, Goose, LSIF/SCIP, SWE-bench. 8 работ — gate-критерий «≥10» закрывается с одной строкой контекстных работ (OpenAPI governance, semgrep).
- **Снижает coordination overhead.** Не нужно лоббировать спецификацию через юридические отделы Microsoft/Anthropic/Cursor.
- **Снижает риск scope creep.** Любой запрос «а как насчёт коммерческого фичи X» — outside scope.

### Negative

- **Меньшая «индустриальная» новизна.** Если ASP принимают только OSS-агенты — impact ограничен OSS-долей рынка (значимая, но не вся индустрия). На preprint venue это смещает фокус с «индустриальный стандарт» на «open ecosystem standard».
- **GitNexus как outlier.** PolyForm Noncommercial — не каноническая open-source license. Patwari остаётся stakeholder, но он один из, не центральный target.
- **Возможный реверс при росте.** Если ASP взлетит — commercial-агенты могут позже захотеть его реализовать. Нужно избегать design-choices, которые блокируют будущую совместимость (например, hardcoded telemetry-off — оставить как opt-in flag).

### Necessary follow-ups

- **Обновить `tracks/02-asp/README.md`:** в gate-критерии «3 экспериментальных пользователя» добавить уточнение «open-source agent maintainers».
- **Обновить `design/02-use-cases.md`:** перепроверить use cases — отсеять те, что специфичны для commercial-агентов (если такие есть).
- **План литобзора:** оформить как чек-лист в notebook на 2026-05-21 или в отдельном плане в `design/`. Кандидаты (6 для закрытия gate ≥10):
  1. Aider RepoMap (Gauthier 2024) — приоритет 1.
  2. Continue.dev codebase indexing — приоритет 2.
  3. Cline indexing approach — приоритет 3.
  4. agentic-codebase / Goose codebase API — приоритет 4.
  5. LSIF / SCIP (Sourcegraph) — приоритет 5, общий стандарт code intelligence.
  6. SWE-bench (Princeton) — приоритет 6, для будущей evaluation.
- **Outreach skeleton:** черновик письма maintainer-ам Aider / Continue / Cline — в `deliverables/outreach-draft.md` (создать когда литобзор по их инструментам сделан, не раньше).

## Alternatives considered

### Alternative A: Universal scope (commercial + OSS)

Писать ASP для всех агентов сразу. Отклонено: design compromises (см. Context), B2B-цикл нереалистичен для research-программы без бюджета, диффузный outreach снижает скорость feedback-цикла.

### Alternative B: GitNexus-only

Писать ASP исключительно как формализацию GitNexus API, без расширения на других серверов. Отклонено: ASP теряет смысл как стандарт — становится «документация GitNexus». Multi-implementation — ключевой признак протокола (см. LSP: VS Code + JetBrains + Vim + Emacs LSP-серверы — это сделало LSP стандартом).

### Alternative C: «Wait and see»

Не фиксировать scope сейчас, оставить на потом. Отклонено: gate-критерий «3 пользователя» требует конкретной outreach стратегии. Размытая audience = размытая outreach.

## References

- [ADR 0001](0001-mcp-extension-vs-new-protocol.md) — base scope decision.
- [`lit-review/patwari-2026-gitnexus.md`](../lit-review/patwari-2026-gitnexus.md) — GitNexus как dominant prior art.
- [`design/02-use-cases.md`](../design/02-use-cases.md) — use cases (требуется пересмотр под OSS-scope).
- Aider RepoMap source: <https://github.com/Aider-AI/aider> (для будущего lit-review).
- Continue.dev source: <https://github.com/continuedev/continue> (для будущего lit-review).
