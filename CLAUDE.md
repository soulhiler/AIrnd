# Инструкции для Claude Code

Этот репозиторий — R&D-программа по AI-Native Programming Stack. См. [`README.md`](README.md) для контекста и [`docs/TZ/RD_PROGRAM_TZ.md`](docs/TZ/RD_PROGRAM_TZ.md) для полного ТЗ.

## Critical: prior art search first

Перед глубоким литобзором foundational работ **в любом треке** — провести [Prior Art Search](docs/workflows/prior-art-search.md). ТЗ описывает проблемное пространство, не текущее состояние решений. Поле движется быстро, и существующие production-решения могут переопределить позиционирование трека (см. кейс Трек 2 / GitNexus).

Это не опциональный шаг — без survey глубокий литобзор не начинается.

## Critical: правила против overcoding (из трека 4, обязательно)

После двух раундов внешнего аудита трека 2 стало ясно: AI-помощник пишет код и документы быстрее, чем человек способен их проверять и принимать решения. Эти правила сдерживают переусложнение. **Действуют во всех треках.** Переформулированы в [ADR 0002 трека 4](tracks/04-methodology/decisions/0002-human-as-architect-ai-as-generator-paradigm.md) под парадигму «человек = архитектор + контролёр, AI = генератор» с **адаптивными порогами по классу проекта** (малый / средний / большой / multi-track).

**Сначала определи класс проекта** (в начале трека / фазы). Из ADR 0002 §2:

- **Малый** (1 идея, проверка гипотезы, ≤300 LOC) — мягкие пороги.
- **Средний** (компонент, 300-1500 LOC) — стандартные.
- **Большой** (RFC + impl, 1500-5000 LOC, публичный outreach) — строгие.
- **Multi-track** — самые строгие, ≥2 кросс-трек ревью.

1. **Decisions per session — порог зависит от длительности и сложности.** ≤30 мин: ≤1 решение. 30-60 мин: ≤2. 60-120 мин: ≤3. >120 мин: пересмотри сессию — слишком длинная. Каждое решение требует явного выбора человека из ≥2 вариантов AI. (Старая метрика «500 строк за сессию» устарела — у AI сессия может быть 15 мин / 5000 строк.)
2. **One feature, one outreach.** Не добавляем следующую крупную фичу, пока не получили внешнюю обратную связь на текущую. Между outreach-раундами — только bug fixes и документация, не новый scope. *Для малого класса проектов: «один проект, один outreach в конце» — этого достаточно.*
3. **Adversarial test required для security-sensitive файлов** (path resolution, mutations, secret handling, auth) — **независимо** от класса проекта. Тест пишется с позиции «как я это сломаю», в той же сессии что и production-код, не потом.
4. **Stage gates: ≥N внешних валидаций решения** (не количества кода), где N зависит от класса: малый = 1, средний = 2 (≥1 эксперт + ≥1 пользователь), большой = 3+. «Я сам проверил» — не считается. Закрытие фазы за 1 день большого проекта — red flag, остановись.
5. **Lit-review — количество работ функция класса**. Малый: 3-5 + явное обоснование релевантности. Средний: 8-12. Большой: 15-25. Главное — **обоснование выбора**, не голое число. Lit-review в параллель с design-решениями, не одним проходом в начале.
6. **ADR пишется как явный выбор человека из вариантов AI, не как готовое решение.** AI представляет 2-3 варианта с trade-offs; человек явно выбирает в чате с обоснованием. Без этой точки ADR — черновик, не accepted. Закрывает разрыв «AI пишет ADR + код одновременно, человек кликает делай» (это породило ADR 0010 §1 vs реализация в треке 2).

### Когда правила можно ослабить (явно, с записью в notebook)

- **Exploratory режим** — первые 1-2 сессии нового трека без жёстких правил, открытие пространства задачи.
- **Иссякло время / бюджет** — explicit trade-off в notebook («cut corners on X because Y»), не молчаливо.
- **Малый класс проекта** — outreach между подфичами обычно нерелевантен (см. правило #2).

### Когда правила нужно усилить

- **Внешний релиз** — outreach-цикл усиливается до ≥3 раундов независимо от класса.
- **После пропуска внешним аудитом** — следующая сессия с тем же кодом обязательно начинается с adversarial review.
- **Security-sensitive файл в любом проекте** — adversarial test обязателен (правило #3 это уже фиксирует, но напомним).

Все 6 правил — гипотезы, не аксиомы. Эмпирически валидируются в треке 4 ([`tracks/04-methodology/`](tracks/04-methodology/)).

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
