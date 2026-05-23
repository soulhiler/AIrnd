# Инструкции для Claude Code

Этот репозиторий — R&D-программа по AI-Native Programming Stack. См. [`README.md`](README.md) для контекста и [`docs/TZ/RD_PROGRAM_TZ.md`](docs/TZ/RD_PROGRAM_TZ.md) для полного ТЗ.

## Critical: prior art search first

Перед глубоким литобзором foundational работ **в любом треке** — провести [Prior Art Search](docs/workflows/prior-art-search.md). ТЗ описывает проблемное пространство, не текущее состояние решений. Поле движется быстро, и существующие production-решения могут переопределить позиционирование трека (см. кейс Трек 2 / GitNexus).

Это не опциональный шаг — без survey глубокий литобзор не начинается.

## Critical: правила против overcoding (из трека 4, обязательно)

После двух раундов внешнего аудита трека 2 стало ясно: AI-помощник пишет код быстрее, чем человек способен его проверять. Эти правила сдерживают переусложнение. **Действуют во всех треках.**

1. **Code budget: ≤500 строк нового кода за одну сессию.** Если превышаешь — сначала режь старое, потом добавляй новое. Применяй на каждый Edit/Write диапазон, не только финальный диф.
2. **One feature, one outreach.** Не добавляем следующую крупную фичу, пока не получили внешнюю обратную связь на текущую. Между outreach-раундами — только bug fixes и документация, не новый scope.
3. **Adversarial test required.** Для security-sensitive файлов (path resolution, mutations, secret handling) — обязательно тест, написанный с позиции **«как я это сломаю»**, а не «как пользоваться правильно». Без такого теста файл не считается «сделанным».
4. **Stage gates как hard barriers.** Фаза не закрывается без минимум 1 внешнего пользователя, проверившего артефакт. «Я сам проверил» — не считается. Закрытие фазы за 1 день — red flag, остановись.
5. **Lit-review в параллель, не одним проходом.** Каждое новое design-решение требует свежего поиска prior art (≥10 минут). Одноразовый литобзор в начале трека гарантированно пропускает релевантные работы (см. кейс Atalay's «Harness Problem»).

Все 5 — гипотезы, не аксиомы. Эмпирически валидируются в треке 4 ([`tracks/04-methodology/`](tracks/04-methodology/)).

## Правила работы

### Что делегировать Claude Code

- Boilerplate (тесты, CI, docs scaffolding).
- Имплементация по чёткой спецификации, оформленной как ADR или задача.
- Поиск в литературе через web search → заполнение `lit-review/`.
- Рефакторинг и переименования.
- Черновики прозы (введение, related work, README).
- Помощь с воспроизводимыми скриптами (Makefile, harness).

### Что НЕ делегировать

- **Архитектурные решения** — оформляются как ADR, принимаются человеком.
- **Формулировку гипотез** — H1/H2/H3 фиксирует человек.
- **Интерпретацию результатов** — что значат числа, решает человек.
- **Решение, что публиковать** — выбор venue, scope препринта.
- **Решение «закрыть трек / продолжить»** — gate-review делает человек.

## Структура артефактов

Создавай файлы только в установленных местах:

| Артефакт | Куда |
|---|---|
| Запись литобзора | `tracks/<trk>/lit-review/<slug>.md` (через `make lit-add`) |
| Запись журнала | `tracks/<trk>/notebook/YYYY-MM-DD.md` (через `make notebook`) |
| ADR | `tracks/<trk>/decisions/NNNN-<slug>.md` (через `make adr-new`) |
| Дизайн-док | `tracks/<trk>/design/<NN>-<topic>.md` |
| Эксперимент | `tracks/<trk>/experiments/<exp-id>/` с `PREREG.md` + `results/` |
| Прототип | `tracks/<trk>/prototype/` |

**Используй существующие шаблоны** в `_template.md` каждой папки — не изобретай новый формат.

## Gate-критерии

Перед переходом между фазами:
1. Открой `tracks/<trk>/README.md`.
2. Пройди чеклист Gate N → N+1.
3. Если все галочки — сделай gate-review commit.
4. Обнови README трека: новая фаза, новый чеклист.

**Не пропускай gate** — если критерий не выполнен, итерируй в текущей фазе или предложи закрыть трек.

## Pre-registration

Перед сбором данных эксперимента:
1. Создай `tracks/<trk>/experiments/<exp-id>/PREREG.md` с гипотезами, метриками, методологией, stop conditions.
2. Сделай commit с сообщением `prereg(<exp-id>): <short title>`.
3. Создай git tag `prereg/<exp-id>/<YYYY-MM-DD>`.

После prereg-commit менять PREREG.md нельзя — только дополнять с пометкой «amendment».

## Лабораторный журнал

Ежедневно — короткая запись через `make notebook`:
- **Сделано:** что конкретно.
- **Узнал:** с ссылками на `lit-review/` записи.
- **Заблокировало:** что встало, почему.
- **Next step:** одна конкретная вещь.

Журнал — основа для статьи и retrospective. Не пропускай.

## Стиль

- Markdown везде, кроме кода прототипа.
- Русский в журнале и обсуждениях, английский в коде и публичных артефактах (спецификация, препринт, README будущих репо со спецификацией).
- Без emoji в коммитах и документации, если не запрошены явно.
- Ссылки между документами — относительные.

## Когда сомневаешься

Спрашивай через `AskUserQuestion`. Lean MVP философия: лучше пауза на уточнение, чем неделя работы в неверном направлении.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **AIrnd** (446 symbols, 488 relationships, 0 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/AIrnd/context` | Codebase overview, check index freshness |
| `gitnexus://repo/AIrnd/clusters` | All functional areas |
| `gitnexus://repo/AIrnd/processes` | All execution flows |
| `gitnexus://repo/AIrnd/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
