# Трек 2 — Agent Server Protocol (ASP)

LSP стандартизировал общение между редактором и компилятором. Гипотеза трека: стандартизированный протокол для **агентов** (Cursor, Claude Code, Aider, Continue, Cline) даст экосистеме то, что LSP дал IDE-индустрии.

**Артефакт трека:** RFC-спецификация ASP + reference implementation (clean-room, GitNexus parity + 5 UX-исправлений) + test suite. Reference implementation — dogfood-tool, активно используемый в наших проектах. См. [ADR 0001](decisions/0001-mcp-extension-vs-new-protocol.md), [ADR 0002](decisions/0002-asp-scope-opensource-agent-ecosystem-only.md), [ADR 0003](decisions/0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md).

Полная постановка — в `docs/TZ/RD_PROGRAM_TZ.md`, секция «ТРЕК 2».

## Текущая фаза

**Фаза 0 — Подготовка (литобзор)**

- Старт: 2026-05-21
- Целевая длительность: 3–4 недели
- Цель: понять текущее положение дел (LSP, MCP, open-source агенты), сформулировать gap, выбрать «расширение MCP vs отдельный протокол».

## Карта артефактов

| Папка | Что внутри |
|---|---|
| [`lit-review/`](lit-review/) | Один файл = одна работа; начни с [`_prior-art-survey.md`](lit-review/_prior-art-survey.md) |
| [`notebook/`](notebook/) | Ежедневный лабораторный журнал |
| [`decisions/`](decisions/) | ADR — архитектурные решения |
| [`design/`](design/) | Дизайн-документы (спецификации, обзоры) |
| [`prototype/`](prototype/) | Код прототипа (появится на Фазе 2) |
| [`experiments/`](experiments/) | Pre-registration + результаты экспериментов |
| [`deliverables/`](deliverables/) | Препринт, артефакты для конференций |

## Lessons learned (для будущих треков)

**Урок 2026-05-21:** глубокий разбор GitNexus (39.5k★, 16 MCP tools) после foundational литобзора показал, что точная engineering задача уже решена. Это привело к [переопределению направления](decisions/0001-mcp-extension-vs-new-protocol.md) с «строить ASP» на «формализовать GitNexus API как open RFC». В будущих треках — **prior art search до foundational литобзора** ([workflow](../../docs/workflows/prior-art-search.md)). Это сэкономило бы день; в более сложных случаях могло бы сэкономить недели.

## Gate 0 → 1

Переход к Фазе 1 (Дизайн) — только когда выполнено всё:

- [x] Литобзор написан в [`design/01-literature-review.md`](design/01-literature-review.md) (5–10 страниц)
- [ ] Обработано не менее 10 ключевых работ в [`lit-review/`](lit-review/) (5 из 10: LSP, MCP, tree-sitter, GitNexus, **Aider RepoMap**). План оставшихся 5: Continue.dev → Cline → agentic-codebase/Goose → LSIF/SCIP → SWE-bench (см. [ADR 0002](decisions/0002-asp-scope-opensource-agent-ecosystem-only.md))
- [x] Подтверждено, что точная идея не дублирует существующие публикации (GitNexus решает engineering часть; ASP позиционируется как open RFC поверх — см. [ADR 0001](decisions/0001-mcp-extension-vs-new-protocol.md))
- [x] Сформулирован gap: чего конкретно не хватает в MCP / LSP / существующих агентах ([§ 7 в литобзоре](design/01-literature-review.md))
- [x] Принято решение: ASP = open RFC, formalizing GitNexus-style API ([ADR 0001](decisions/0001-mcp-extension-vs-new-protocol.md), accepted 2026-05-21)
- [x] Scope зафиксирован: **open-source agent ecosystem only** ([ADR 0002](decisions/0002-asp-scope-opensource-agent-ecosystem-only.md), accepted 2026-05-21)
- [ ] Минимум 3 экспериментальных пользователя из open-source agent maintainers готовы попробовать (candidates: Aider, Continue.dev, Cline, GitNexus, Goose — см. ADR 0002)

---

## Gate 1 → 2 (для справки, активируется после Gate 0 → 1)

- [ ] Spec v0.1 опубликована (GitHub Pages / ReadTheDocs)
- [ ] Архитектурные ADR для reference implementation приняты: язык, storage, parser, search, MCP packaging (см. [ADR 0003 § Necessary follow-ups](decisions/0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md#necessary-follow-ups))
- [ ] Формат сообщений специфицирован через JSON Schema
- [ ] Минимум 3 экспериментальных пользователя (OSS agent maintainers) подтвердили готовность

---

## Gate 2 → 3

Reference implementation проходит три stages (см. [ADR 0003 § Negative.Scope creep](decisions/0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md#negative)):

- [ ] **Stage 2a (MVP-alpha):** 5 операций (index/query/context/impact/detect_changes) + 2 fixes (offline-first FTS, fuzzy lookup); dogfood на нашем репо
- [ ] **Stage 2b (MVP-beta):** +6 операций (rename/cypher/api_impact/shape_check/route_map/tool_map) + 2 fixes; ≥1 внешний OSS-агент использует
- [ ] **Stage 2c (parity):** все 16 операций GitNexus + 5-й fix (explicit degradation); готов к extract в отдельный repo
- [ ] Reference client (Claude Code / Cline) решает задачи end-to-end через ASP
- [ ] На одной задаче метрики говорят о выигрыше vs GitNexus или ripgrep+AST

---

## Gate 3 → 4

- [ ] Данные собраны по SWE-bench Lite
- [ ] Сравнение с ripgrep+AST и embeddings проведено
- [ ] Статистически значимая разница хотя бы по одной метрике

---

## Gate 4 → 5

- [ ] Spec stable enough для версии 1.0
- [ ] Reference implementation production-ready
- [ ] Хотя бы один external user реально использует

---

## Связь с публикацией

Цель публикации Трека 2:
- **Препринт** на arXiv (cs.SE).
- **Workshop:** LLM4Code (ICSE), AIware (FSE).
- **Adoption:** хотя бы один крупный агент.

Полная стратегия — в ТЗ, секция «Трек 2, Фаза 5».
