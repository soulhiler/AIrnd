# Toy implementation: hierarchical tags на AIrnd-репо

## Простыми словами

Это **первая дешёвая проверка** идеи [001 (иерархические теги)](../001-hierarchical-tags.md): можно ли вообще автоматически генерировать иерархические метки из путей файлов, и работает ли поиск по ним лучше, чем обычные команды `find` и `grep`. Получасовой эксперимент. Результат — **да, работает**, дальше можно формализовывать.

## Что сделано

1. **Скрипт-генератор** [`generate_tags.py`](generate_tags.py) — читает все markdown-файлы в репо, генерирует иерархические теги:
   - **Из пути файла:** `tracks/02-asp/lit-review/foo.md` → теги `["tracks", "tracks/02-asp", "tracks/02-asp/lit-review"]`.
   - **Из заголовков markdown:** каждый `## Heading` становится отдельным символом с тегами `heading/level-2` + `section/{parent}` + наследует path-теги файла.
2. **Output** [`tags.jsonl`](tags.jsonl) — один JSON-объект на строку, грепаемый и jq-парсаемый.
3. **5 тестовых запросов** в [`queries.md`](queries.md) — сравнение с `find` и `grep` baselines.

## Результаты

- **482 символа** сгенерировано на нашем (на момент запуска) репо: 25 файлов + 457 секций.
- **20 самых частых тегов** (топ-5):

  | Тег | Количество |
  |---|---|
  | `tracks` | 380 |
  | `tracks/02-asp` | 380 |
  | `heading/level-2` | 233 |
  | `heading/level-3` | 178 |
  | `tracks/02-asp/lit-review` | 134 |

- **15 секций «Простыми словами»** найдено в 11 разных файлах — точное соответствие нашей новой конвенции (введена в этой сессии).

## Сравнение с baseline (5 запросов в [`queries.md`](queries.md))

| Запрос | `find` / `grep` | Hierarchical tags |
|---|---|---|
| Все ADR в треке 2 | `find tracks/02-asp/decisions -name *.md` → **4 файла** | tag `tracks/02-asp/decisions` (kind=file) → **4 файла** (совпадает) |
| Все секции «Простыми словами» | `grep -rl "Простыми словами"` → **12 файлов** (без локализации внутри файла) | **15 точных секций** в 11 файлах с указанием `файл#секция` |
| Все главные заголовки документов | `grep '^# '` → много false positives (в комментариях кода) | tag `heading/level-1` → **38 точных** |
| Файлы лит-обзора | `find tracks/02-asp/lit-review` → 9 файлов | tag `tracks/02-asp/lit-review` (kind=file) → **9 файлов** (совпадает) |
| Все символы под `tracks/02-asp/ideas` (любая глубина) | `find tracks/02-asp/ideas` → 3 файла | 3 файла + **их 30+ секций** с указанием иерархии |

## Главные выводы

### Что работает (положительные сигналы)

1. **Convention-based генерация из путей — тривиальна и работает.** 8 строк кода (`path_tags()` функция). Покрывает 100% файлов.
2. **Иерархия из markdown-заголовков извлекается чисто** через regex (`^#{1,6}\s+`). 457 секций распознано корректно.
3. **Hierarchical search даёт точную локализацию** — не только «в каком файле», но «в какой секции». `find` и `grep` это не дают.
4. **Convention с `## Простыми словами` секциями** оказалась **программно проверяемой**: запрос «найди все «Простыми словами» секции» возвращает 15 точных совпадений. Это **proof of concept** для cross-document conventions.
5. **Naследование тегов от файла к секции** работает естественно. Секция в `tracks/02-asp/lit-review/foo.md#Простыми словами` имеет теги `[tracks, tracks/02-asp, tracks/02-asp/lit-review, heading/level-2, section/...]` — можно фильтровать по любому уровню.

### Что НЕ работает (ограничения)

1. **Path-теги ≠ семантические категории.** Из пути `tests/unit/auth/test_login.py` мы получили бы теги `[tests, tests/unit, tests/unit/auth]` — но только если такая директорная структура существует. На нашем репо нет каталога `tests/` — поэтому теги `test/unit`, `feature/login` (из мотивирующего примера) **не материализуются автоматически**.
2. **Дубликаты в notebook** — 5 секций «Простыми словами» в одном файле `2026-05-21.md` (одна на каждый из Updates 9-13). Hierarchical tags их различают **только по line number**, не по семантической принадлежности к Update.
3. **Heading hierarchy не всегда отражает категорийную.** Markdown `## Простыми словами` внутри ADR не значит «эта секция категории X»; это просто convention.
4. **Cyrillic / English mix.** Часть путей и тегов — английские (tracks, decisions), часть секций — русские. Это OK для нашего bilingual scope, но потребует thought в production-grade implementation.
5. **Нет ranking.** Все matches возвращаются с равным весом. Aider's PageRank-style ranking — отдельная задача.

### Что это значит для гипотезы

**H1 (base hypothesis)** — иерархические теги дают precision@10 ≥15% выше плоских — на этом toy эксперименте **не измерена строго** (нет ground truth dataset для precision@10). Но **directional signal сильный**:

- `grep -rl "Простыми словами"` возвращает 12 файлов **без локализации** внутри файла. Если LLM-агенту нужна **конкретная секция**, он должен открыть каждый файл и сам найти heading — это N×работа.
- Hierarchical search возвращает **15 точных секций** с указанием `файл#секция` сразу — агент может скачать только нужный кусок текста.
- **Это и есть precision-выигрыш** на real workflow, хотя без формальной метрики precision@10.

**Рекомендация:** идея пригодна для pre-registration **с одной оговоркой** — нужен ground truth dataset для измерения precision@10. Кандидат: synthetic queries на нашем репо + manual labeling «правильный/неправильный ответ» для ~50-100 запросов. **Это next step после Cline lit-review.**

## Как запустить

```bash
# Сгенерировать tags.jsonl
python3 tracks/02-asp/ideas/001-toy/generate_tags.py

# Пример запроса: все ADR (только файлы)
python3 -c "
import json
with open('tracks/02-asp/ideas/001-toy/tags.jsonl') as f:
    for line in f:
        s = json.loads(line)
        if s['kind'] == 'file' and 'tracks/02-asp/decisions' in s['tags']:
            print(s['symbol'])
"
```

Полные примеры запросов — [`queries.md`](queries.md).

## Что НЕ сделано (намеренно)

- **Нет ranking** — hierarchical filter возвращает все matches с равным весом. Combining с PageRank / embeddings — отдельная задача.
- **Нет manual annotations.** Только convention-based из путей и markdown headings. Manual tags в frontmatter / комментариях — отдельный source.
- **Нет LLM-inferred tags.** Дорого, шумно, требует API. Out of scope toy.
- **Нет performance benchmarks.** На 25 файлах — мгновенно. На 10М LOC — TBD.
- **Нет formal precision@10 measurement.** Требует ground truth dataset.

## Связь с трек-артефактами

- **Идея:** [`../001-hierarchical-tags.md`](../001-hierarchical-tags.md) (статус `under-investigation`).
- **Прямой prior art:** Semgrep rules namespace `<language>/<framework>/<category>/$MORE`.
- **Academic foundation:** Hearst et al. CHI 2002 «Hierarchical Faceted Metadata in Site Search Interfaces».
- **Контраст с lit-review:**
  - [Aider RepoMap](../../lit-review/gauthier-2024-aider-repomap.md) — PageRank без тегов вообще.
  - [GitNexus](../../lit-review/patwari-2026-gitnexus.md) — typed edges (semantic graph), но плоские.
  - [Continue.dev](../../lit-review/continuedev-2026-codebase-indexing.md) — embeddings, без structural tags.
- **Будущее:** если pre-reg → конвертируется в `experiments/exp-002-hierarchical-tags-precision/` с ground truth dataset.
