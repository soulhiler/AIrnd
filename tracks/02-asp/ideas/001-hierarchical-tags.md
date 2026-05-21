# 001. Иерархические теги для поиска кода

- **Дата:** 2026-05-21
- **Автор:** soulhiler
- **Статус:** **draft** — интерпретация уточнена 2026-05-21, гипотеза сформулирована
- **История статуса:** stub (2026-05-21, утром) → draft (2026-05-21, после уточнения)

## Простыми словами

Каждый кусок кода (функция, класс, файл) получает **метки в виде дорожек**, как папки в файловом дереве. Например:

- Функция `test_user_login()` получает метки `["test/unit", "test/auth", "feature/login"]`.
- Функция `test_api_endpoint()` получает метки `["test/integration", "test/api", "feature/api"]`.

При поиске:

- Запрос «test» — находит **обе** функции (потому что обе под `test/...`).
- Запрос «test/unit» — находит только первую.
- Запрос «feature/login» — находит только первую.

Это похоже на **фасетный поиск в интернет-магазинах** (Amazon: «Электроника → Телефоны → Apple» — каждый уровень сужает результат) или на **расширенные метки в GitHub Issues**, если бы они были вложенными.

**Гипотеза:** такие иерархические метки дадут **более точный поиск** для AI-помощника, чем плоские метки или embedding-поиск, особенно на запросах типа «найти все тесты для функции X» или «найти весь код безопасности».

## Гипотеза (формальная)

**H1:** Иерархические теги дают **precision@10 на ≥15% выше** по сравнению с плоскими тегами на запросах вида «найти все символы, относящиеся к категории X», на тестовом наборе из ≥100 запросов.

**H2 (вторичная):** Иерархические теги дают **comparable precision** с embedding-based retrieval (Continue-style), но при **значительно меньшем cold-start cost** (нет необходимости считать embeddings для миллионов чанков).

**Null hypothesis (H0):** Иерархические теги не дают статистически значимой разницы по сравнению с плоскими.

## Что нужно проверить (план)

### Шаг 1: Mini prior-art search

Прежде чем формализовать эксперимент — нужно найти, делал ли кто-то уже это в коде. Кандидаты для поиска:

- **Semgrep rule taxonomy** — у них есть `category` и `subcategory`. Это уже иерархия.
- **GitHub Issue Labels** — обсуждалось ли иерархических.
- **OpenAPI Tags** — есть ли иерархические extensions.
- **Code categorization in IDEs** — VS Code symbols, JetBrains structural search.
- **Knowledge graph projects** — Sourcegraph code intel categories, ctags-language patterns.
- **Academic literature**: «hierarchical tagging for code search», «faceted code search», «code categorization knowledge graph».

### Шаг 2: Источник тегов (design choice)

**Критический вопрос:** как теги получаются?

| Источник | Pros | Cons |
|---|---|---|
| **Manual** (программист пишет `@tag` в комментарии) | Точно | Никто не пишет |
| **Convention-based** (из пути: `tests/unit/test_x.py` → `test/unit`) | Бесплатно, дисциплина repo | Не покрывает символов без явной структуры |
| **Inferred LLM** (LLM читает код, предлагает теги) | Гибко | Дорого, шум |
| **From config** (`.asp-tags.yml` со списком rules) | Контролируемо | Требует поддержки |

Скорее всего — комбинация: convention-based + manual для исключений.

### Шаг 3: Baseline + treatment

Сравнить precision@10 на одном тестовом наборе:

- **Baseline 1:** ripgrep по тексту имени символа.
- **Baseline 2:** embedding similarity (Continue-style).
- **Baseline 3:** плоские теги (один уровень, без вложенности).
- **Treatment:** иерархические теги (≥2 уровня).

### Шаг 4: Test dataset

| Вариант | Pros | Cons |
|---|---|---|
| Наш AIrnd-репо | Controlled, малый, мы знаем правильные ответы | Не репрезентативен для production кода |
| SWE-bench Lite | Индустриальный стандарт | Требует подготовки + он не про search, про fix |
| Aider's own evals | Публично доступен | Тоже не про search |
| Synthetic queries on большом OSS проекте (django, vscode) | Реалистично, масштабируемо | Нужно создать ground truth |

Скорее всего — **синтетические запросы на нашем репо + один-два средних OSS проекта**.

### Шаг 5: Метрика

- **Главная:** precision@10 на ranked retrieval.
- **Вторичные:** recall, NDCG@10, query latency, cold-start indexing time.

### Шаг 6: Pre-registration

Если решение проводить эксперимент — создать `experiments/exp-002-hierarchical-tags/PREREG.md` с финальной гипотезой, baselines, метриками, stop conditions. Сделать git tag `prereg/exp-002-hierarchical-tags/<date>`.

## Связь с треком

- **Может повлиять на:** Stage 2a операции (`asp/findByTag({tag, hierarchical?})`).
- **Связано с:**
  - [Aider RepoMap](../lit-review/gauthier-2024-aider-repomap.md) — tree-sitter tags (но плоские: `name.definition.function`).
  - [GitNexus](../lit-review/patwari-2026-gitnexus.md) — typed edges (CALLS, REFERENCES). Категоризация по типу — близка, но не иерархична.
  - [Continue.dev](../lit-review/continuedev-2026-codebase-indexing.md) — embedding-based search. **Иерархические теги — структурная альтернатива embeddings.** Может быть **значительно дешевле** при сравнимой precision на категорийных запросах.
- **Стадия:** draft. Если mini prior-art search показывает gap → pre-reg эксперимента. Если кто-то уже сделал — записываем как «изученная prior art», корректируем подход или закрываем.

## Открытые вопросы

- **Q1 (приоритет):** Есть ли existing работы / инструменты, которые уже реализуют hierarchical tags для code search? — нужен mini prior-art search.
- **Q2:** Сколько уровней иерархии оптимально? Гипотеза: 2-3 (test/unit/auth — выше — diminishing returns).
- **Q3:** Как теги получаются? Авто из path? Manual в comments? LLM-inferred? **Это критический design choice.**
- **Q4:** Совместимо ли с embeddings? Можно ли комбинировать (hybrid: embedding similarity + tag filter)?
- **Q5:** Если идея валидна — это **отдельная ASP operation** (`asp/findByTag`) или **параметр существующей** (`asp/retrieve({filter: {tag: "test/unit"}})`)?

## Отклонённые интерпретации (для истории)

Изначально идея «иерархические теги» имела 4 разумных трактовки. После уточнения 2026-05-21 выбрана **интерпретация №3 (метки для поиска)**. Остальные не отбрасываются полностью — могут стать отдельными идеями в backlog:

- **Hierarchical tree-sitter tags** (def > callable > function вместо плоских) — потенциальная идея №002.
- **Hierarchical PageRank** (модули → файлы → функции на разных уровнях) — потенциальная идея №003.
- **Hierarchical token budget** (50% функциям, 30% классам, 20% модулям) — потенциальная идея №004.

Все три остаются как «возможно интересно» — но не активны.
