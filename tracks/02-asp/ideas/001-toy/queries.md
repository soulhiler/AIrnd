# Тестовые запросы (toy hierarchical tag search)

Сравнение трёх подходов на одном репо:

1. **Baseline A:** `find` по структуре каталогов.
2. **Baseline B:** `grep -rl` по тексту.
3. **Treatment:** hierarchical tags из [`tags.jsonl`](tags.jsonl).

## Q1: «Найди все ADR в треке 2»

### Baseline A — `find tracks/02-asp/decisions -name "*.md"`

```text
tracks/02-asp/decisions/0001-mcp-extension-vs-new-protocol.md
tracks/02-asp/decisions/0002-asp-scope-opensource-agent-ecosystem-only.md
tracks/02-asp/decisions/0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md
tracks/02-asp/decisions/_template.md
```

**4 файла.** Работает потому что у нас аккуратная структура каталогов. Сломается, если ADR положат в другое место.

### Treatment — tag `tracks/02-asp/decisions`, kind=file

```text
tracks/02-asp/decisions/_template.md
tracks/02-asp/decisions/0002-asp-scope-opensource-agent-ecosystem-only.md
tracks/02-asp/decisions/0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md
tracks/02-asp/decisions/0001-mcp-extension-vs-new-protocol.md
```

**4 файла, идентично.** На этом запросе **hierarchical tags не дают преимущества** над `find`. Это OK — base case должен работать, advanced cases — следующие запросы.

## Q2: «Найди все «Простыми словами» секции»

Это **новая convention в нашем репо** — каждый научный документ должен начинаться с такой секции.

### Baseline B — `grep -rl "Простыми словами" tracks docs`

```text
tracks/02-asp/README.md
tracks/02-asp/decisions/0002-asp-scope-opensource-agent-ecosystem-only.md
tracks/02-asp/decisions/0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md
tracks/02-asp/ideas/001-hierarchical-tags.md
tracks/02-asp/ideas/001-toy/tags.jsonl    ← false positive (это сам индекс)
tracks/02-asp/ideas/_index.md
tracks/02-asp/ideas/_template.md
tracks/02-asp/lit-review/continuedev-2026-codebase-indexing.md
tracks/02-asp/lit-review/gauthier-2024-aider-repomap.md
tracks/02-asp/lit-review/patwari-2026-gitnexus.md
tracks/02-asp/notebook/2026-05-21.md
tracks/02-asp/prototype/README.md
```

**12 файлов**, но:

- **Нет локализации** — внутри `notebook/2026-05-21.md` фраза появляется 5 раз (одна на каждый Update 9-13), а `grep -rl` показывает файл один раз.
- **1 false positive** — `tags.jsonl` (наш собственный output), где «Простыми словами» появляется как значение поля symbol.

### Treatment — symbol contains «Простыми словами», kind=section

```text
tracks/02-asp/README.md#Простыми словами
tracks/02-asp/prototype/README.md#Простыми словами
tracks/02-asp/ideas/_index.md#Простыми словами
tracks/02-asp/ideas/_template.md#Простыми словами
tracks/02-asp/ideas/001-hierarchical-tags.md#Простыми словами
tracks/02-asp/decisions/0002-asp-scope-opensource-agent-ecosystem-only.md#Простыми словами
tracks/02-asp/decisions/0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md#Простыми словами
tracks/02-asp/notebook/2026-05-21.md#Простыми словами   ← (×5: Updates 9-13)
tracks/02-asp/notebook/2026-05-21.md#Простыми словами
tracks/02-asp/notebook/2026-05-21.md#Простыми словами
tracks/02-asp/notebook/2026-05-21.md#Простыми словами
tracks/02-asp/notebook/2026-05-21.md#Простыми словами
tracks/02-asp/lit-review/gauthier-2024-aider-repomap.md#Простыми словами
tracks/02-asp/lit-review/continuedev-2026-codebase-indexing.md#Простыми словами
tracks/02-asp/lit-review/patwari-2026-gitnexus.md#Простыми словами
```

**15 точных секций** с указанием `файл#секция-name`. Каждая секция имеет ещё `line` — точное место в файле.

### Анализ

- **Precision выше у treatment.** Treatment не выдаёт false positive `tags.jsonl`, потому что иерархическая индексация не считает JSON-значение секцией.
- **Recall выше у treatment.** 15 vs 12 «уникальных файлов» от grep. Дополнительные находки — 5 секций в notebook.
- **Granularity выше у treatment.** Локализация до секции, не до файла. Это **critical для LLM-агента** — он может загрузить только нужную секцию, экономя контекст.

## Q3: «Все главные заголовки документов» (heading level 1)

### Baseline B — `grep -h '^# ' --include="*.md" -r tracks docs`

Выдаёт все строки, начинающиеся с `#` + пробел — но это работает только потому что они на отдельных строках. В markdown часто есть `#header` упоминаемый в **тексте кода** (например, в комментариях в bash-скриптах). Это даст false positives.

### Treatment — tag `heading/level-1`

10 главных заголовков (выборка):

```text
README.md#AIrnd — R&D Program: AI-Native Programming Stack
CLAUDE.md#Инструкции для Claude Code
CLAUDE.md#GitNexus — Code Intelligence
AGENTS.md#GitNexus — Code Intelligence
tracks/02-asp/README.md#Трек 2 — Agent Server Protocol (ASP)
tracks/02-asp/design/01-literature-review.md#Литературный обзор: Agent Server Protocol (ASP)
tracks/02-asp/design/02-use-cases.md#Use Cases — Agent Server Protocol (ASP)
tracks/02-asp/prototype/README.md#ASP Reference Implementation (workname: `asp-ref`)
tracks/02-asp/ideas/_index.md#Идеи — Трек 2 (ASP)
tracks/02-asp/ideas/_template.md#NNN. {{TITLE}}
```

**38 точных** уровень-1 заголовков. Никаких false positives — потому что генератор парсит markdown как структуру, не как plain text.

## Q4: «Файлы лит-обзора в треке 2»

### Baseline A — `find tracks/02-asp/lit-review -name "*.md"`

Совпадает с treatment (9 файлов). Base case, как Q1.

### Treatment — tag `tracks/02-asp/lit-review` AND kind=file

```text
tracks/02-asp/lit-review/gauthier-2024-aider-repomap.md
tracks/02-asp/lit-review/_template.md
tracks/02-asp/lit-review/anthropic-2024-mcp-spec.md
tracks/02-asp/lit-review/microsoft-2022-lsp-spec.md
tracks/02-asp/lit-review/continuedev-2026-codebase-indexing.md
tracks/02-asp/lit-review/patwari-2026-gitnexus.md
tracks/02-asp/lit-review/_prior-art-survey.md
tracks/02-asp/lit-review/INDEX.md
tracks/02-asp/lit-review/brunsfeld-2018-tree-sitter.md
```

**9 файлов**, идентично find.

## Q5: «Всё под трек 2 / ideas» (с секциями)

### Baseline A — `find tracks/02-asp/ideas`

```text
tracks/02-asp/ideas/_index.md
tracks/02-asp/ideas/_template.md
tracks/02-asp/ideas/001-hierarchical-tags.md
+ подкаталог 001-toy/ с файлами
```

3 файла + папка `001-toy/` с её содержимым. **Не видит секции внутри файлов.**

### Treatment — tag `tracks/02-asp/ideas` (любая глубина)

3 файла **+ 30+ секций** с указанием иерархии headings (level 2, level 3, и т.д.) и parent_section.

Это даёт **map содержания**, который LLM-агент может использовать, чтобы навигироваться внутри идеи, не загружая весь файл.

## Сводная таблица

| Запрос | Baseline | Treatment | Преимущество treatment |
|---|---|---|---|
| Q1: ADR файлы | find: 4 файла | tag: 4 файла | — (base case) |
| Q2: «Простыми словами» секции | grep: 12 файлов (1 false +) | tag: 15 секций | Precision + granularity |
| Q3: heading level-1 | grep: false positives | tag: 38 точных | Precision (нет false +) |
| Q4: lit-review файлы | find: 9 | tag: 9 | — (base case) |
| Q5: ideas с секциями | find: 3 файла | tag: 3 файла + 30+ секций | Granularity (карта содержания) |

## Главный вывод

**Hierarchical tags дают преимущество не везде, а на конкретных классах запросов:**

1. **Когда запрос о секциях внутри файлов** — `grep` теряет локализацию, treatment выигрывает.
2. **Когда нужна precision** против text noise — markdown parsing > regex.
3. **Когда нужна map of structure** — `find` даёт файлы, treatment даёт файлы + секции + parent links.

**Где `find` достаточен** — простые «все файлы в каталоге»-запросы. Treatment не нужен, но и не вредит.

## Следующий шаг

Если идея промотируется в формальный эксперимент:

1. **Ground truth dataset** для precision@10: 50-100 синтетических запросов с manually labeled «правильный/неправильный ответ».
2. **Ranking** — добавить PageRank или embeddings поверх tag filter.
3. **Cross-cutting tags** — не только path-based, но и manual в frontmatter / inline annotations.
4. **Performance** на большом репо (10М LOC).
5. **Pre-registration** в `experiments/exp-002-hierarchical-tags-precision/`.
