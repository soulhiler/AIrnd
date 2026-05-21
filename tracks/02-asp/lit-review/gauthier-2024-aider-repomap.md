# Aider RepoMap — PageRank-based token-budget-aware code context selection

## Metadata

- **Authors:** Paul Gauthier (Aider-AI organization)
- **Year:** 2023 (initial blog post), активная разработка по 2026
- **Venue:** Blog post (<https://aider.chat/2023/10/22/repomap.html>) + open-source реализация в [Aider-AI/aider](https://github.com/Aider-AI/aider) (Apache 2.0, 45.1k★ на 2026-05)
- **arXiv / DOI:** —
- **Citation key:** gauthier-2024-aider-repomap
- **Дата прочтения:** 2026-05-21
- **Relevance (1–5):** **5** — прямая prior art для нашего MVP, особенно для Stage 2a (context / query operations). Подход «PageRank на graph code references + token budget» — кандидат на core architecture нашего reference impl.
- **Tags:** code-intelligence, tree-sitter, pagerank, token-budget, oss-agent, prior-art

## TL;DR

LLM-агенты для редактирования больших кодобаз сталкиваются с проблемой context window: код не помещается в prompt, а наивный отбор (BM25 / embeddings / «top N файлов по similarity») даёт нерелевантные результаты. RepoMap решает это, строя **граф ссылок между определениями и упоминаниями символов** (через tree-sitter parsing 100+ языков) и применяя **personalized PageRank**, чтобы ранжировать символы по relevance к текущему запросу/чату. Результат — компактное **token-budget-aware** представление кодобазы (по умолчанию 1024 токена), которое включает только наиболее «центральные» определения, render-нутые с tree-sitter scope context.

## Key claims

- **Claim 1 — «Файлы как узлы PageRank-графа».** Edges = ссылки между файлами через shared symbol references. Quote (из reverse-engineered кода `repomap.py`): «*builds a NetworkX MultiDiGraph where nodes are files and weighted edges represent symbol usage*». Это **отличается от GitNexus**, где основные узлы — символы и их типы (Class, Function, Method), а отношения — типизированные (CALLS, REFERENCES, IMPLEMENTS).
- **Claim 2 — «Token budget — first-class constraint».** Через binary search подбирается максимальное подмножество ranked tags, которое укладывается в `map_tokens` (default 1024) с допуском 15%. Никакой operation **не возвращает результат больше budget** — это структурный invariant. У GitNexus и LSIF такого нет; результаты могут переполнять context.
- **Claim 3 — «Personalization вес — простое управление focus».** Edge weights умножаются на multipliers: 10× для symbols, явно упомянутых пользователем; 10× для «well-named» identifiers (snake/kebab/camel, ≥8 символов); 50× если referencer в chat files (текущий focus); 0.1× для symbols с underscore prefix или >5 definitions; √(num_refs) для нормализации. Это даёт **контролируемую relevance**, а не black-box embeddings.
- **Claim 4 — «Tree-sitter — universal extraction backbone».** 100+ языков поддержано через единый интерфейс tag queries (`name.definition.*`, `name.reference.*`). Если для языка нет references query — fallback на Pygments tokenization для `Name` tokens. Pragmatic degradation.
- **Claim 5 — «Caching по mtime + version».** Disk cache с CACHE_VERSION bump на breaking changes + threshold 0.95 (расхождение менее 5% между cache и actual — cache valid). Минимизирует re-parse cost.

## Methodology

Эмпирическая методология блог-поста — **anecdotal**, не systematic. Gauthier описывает development journey: «*tried embeddings, didn't work well; tried BM25, also limited; arrived at PageRank as graph-based alternative*». Метрики не приведены — нет benchmark vs embeddings, нет hit rate на SWE-bench. **Эмпирическая валидация — через user adoption**: 45.1k★ на GitHub, активное community обсуждение, регулярные релизы (последний v0.86.0 на 2025-08). User reports («for surgical changes», «works well in large projects») — основной signal качества.

Tunable parameters (из кода):

| Параметр | Default | Назначение |
|---|---|---|
| `map_tokens` | 1024 | Target token budget для repo map в prompt |
| `cache_threshold` | 0.95 | Disk cache validity |
| `map_mul_no_files` | 8 | Multiplier когда chat пуст (даём больше repo overview) |
| `padding` | 4096 | Safety margin от context window limit |
| Mention multiplier | 10× | Symbols явно упомянутые в conversation |
| Chat file multiplier | 50× | Source file в active chat |
| Acceptable error | 15% | Budget overshoot tolerance в binary search |

## Gap (для нашего трека)

### Что Aider RepoMap **НЕ покрывает**

- **Не MCP server.** RepoMap — internal Aider Python class, не standalone server. Не используется агентами вне Aider. Это **самый большой gap** относительно нашего ASP positioning: универсального протокола нет, есть internal API.
- **Не поддерживает impact analysis.** PageRank ранжирует символы по «общей центральности», но не отвечает на «что сломается, если я изменю X». Нет explicit upstream/downstream traversal.
- **Не индексирует markdown / docs.** Только source code (хотя tree-sitter поддерживает markdown). У GitNexus это сильная сторона; у нас на dogfood-цикле — критично (мы видели 411 Section nodes в нашем репо).
- **Не возвращает structured data.** Output — formatted string (tree representation для LLM prompt), не JSON. Невозможно программно использовать; невозможно постпроцессить.
- **Нет persistent graph.** Граф пересчитывается на каждое обращение (с disk cache на per-file tags). Нет «снэпшота для запросов».
- **Нет rename / refactoring operations.** RepoMap — read-only.
- **Нет fuzzy symbol lookup.** Operations принимают строгие имена.
- **Нет explicit degradation signals.** Если tree-sitter parser для языка отсутствует — silent fallback на Pygments, без уведомления.
- **Нет execution flow tracking** (cluster / process abstraction GitNexus).

### Где наш потенциальный contribution

1. **Аппроксимация PageRank-as-MCP-tool.** Поднять RepoMap-подобное ранжирование как ASP-operation (например, `asp/rankRelevant({query, budget})`) — это даёт **token-budget-aware** аналог GitNexus's `query`. **Это сильный кандидат для Stage 2a fix #5 «explicit degradation»**: вместо silent FTS fallback — explicit `degradation: ["no-fts", "tree-sitter-fallback"]` в response.
2. **Token budget как first-class в спецификации.** ASP-спека должна включать `tokenBudget?: number` в каждую operation, возвращающую narrative content. Default fallback (например, 4096) — но advertised в capability negotiation. GitNexus и LSIF этого не имеют — мы можем стать **первой спекой с budget-aware semantics**.
3. **Hybrid graph: символы + файлы.** Aider — file-level edges, GitNexus — symbol-level typed edges. Спецификация может включать **обе абстракции** (файлы для quick ranking, символы для precise impact) с capability negotiation.
4. **Markdown как first-class** (наследие от GitNexus dogfooding) + **PageRank-style ranking** (от Aider) = unique combination, которой нет нигде.
5. **Multipliers как декларативные** (config, не hard-coded в коде). Пользователь / агент может задавать веса через ASP parameter `personalization`.

### Что из их методологии стоит переиспользовать

- **Binary search для token budget** — алгоритм elegant, переиспользовать прямо.
- **Multipliers approach** — компактное, прозрачное, отлаживаемое (vs embeddings).
- **Tree-sitter + Pygments fallback** — pragmatic; не требуем 100% parser coverage.
- **Disk cache с version + mtime** — стандартный пёттерн, но хорошо реализован.
- **CACHE_VERSION bump на breaking changes** — pattern для эволюции index формата.

## Open questions

- **Q1: Как RepoMap scales на 1M+ LOC?** Документация говорит «works well in larger projects», но конкретных benchmarks нет. PageRank на NetworkX MultiDiGraph с миллионом nodes — может занимать секунды, не миллисекунды.
- **Q2: Эффект multipliers на edge cases?** 10× для well-named (≥8 chars) — это эвристика без обоснования. Не ясно, валидно ли в non-English кодобазах (русские, китайские, Hebrew identifiers).
- **Q3: Стабильность под churn.** При активном редактировании — PageRank может «прыгать» (новые edges смещают ranking). У Aider RepoMap нет smoothing — каждый вызов re-rank from scratch. Это OK для agent-driven workflow (один call per query), но не для real-time IDE-like usage.
- **Q4: Сравнение с embeddings на SWE-bench?** Нет publicly published numbers. У нас будет шанс измерить (Gate 3 → 4 metrics).
- **Q5: Token budget vs precision tradeoff** — есть ли точка, после которой увеличение budget не улучшает результат? Это критично для **default value в нашей спецификации**.

## Related work cited

- **Tree-sitter** (Brunsfeld 2018) — уже в нашем lit-review.
- **NetworkX PageRank** — Brin & Page 1998 (foundational); Haveliwala 2002 (personalized PageRank).
- **Pygments tokenization** — fallback parser, упоминается в коде.
- (Косвенно) **GitNexus** — Patwari 2026 — solves similar problem с другим подходом (symbol-typed graph + Cypher).
- **Cocoindex / Continue.dev codebase indexing** — будут в наших следующих lit-review.
- **DeepWiki «Repository Understanding and Context»** — secondary source, рекомендуется для алгоритмических деталей: <https://deepwiki.com/Aider-AI/aider/4-repository-understanding-and-context>.

## Личные заметки

### Что зацепило

- **«Token budget — first-class invariant»** — это, возможно, главное упущение в дизайне GitNexus и LSIF. Они возвращают «всё что есть», и агент должен сам обрезать. Aider сделал это **частью контракта** — operation **никогда** не возвращает больше N токенов. Это **сильный кандидат на core principle ASP-спеки**.
- **Простота multipliers vs embeddings**. 10× / 50× / 0.1× — три hardcoded числа, и работает достаточно хорошо для adoption на 45k★. Это **anti-overkill argument** против сложной neural ranking. Для ASP MVP — embeddings можно отложить.
- **PageRank — известный 28-летний алгоритм** применённый к новой задаче. **Не нужен ML stack**, NetworkX 100% покрывает. Это **drastically снижает реализационную сложность** Stage 2a.

### С чем не согласен / что бы сделал иначе

- **Output string, а не JSON.** Это решение конкретно для Aider's LLM prompt pipeline, но **враждебно к multi-client сценарию**. ASP-спека обязана возвращать structured data (JSON), оставив render строки клиенту.
- **File-level граф упрощает, но теряет precision.** Aider не различает «функция A вызывает функцию B» vs «файл A импортирует файл B». ASP-спека должна поддерживать **symbol-level edges** as capability (с opt-in для лёгких реализаций — file-only).
- **No degradation signals.** Silent fallback на Pygments или skip-file при missing parser — это наш **fix #5** в чистом виде. ASP **должна** требовать `degradation` массив в response для любой operation.
- **Hard-coded multipliers** в Python коде — не configurable. Спецификация должна декларировать их как **named knobs** (например, `personalization.chatBoost`, `personalization.mentionBoost`) с default-ами в спеке.

### Идеи на будущее (Stage 2a influence)

1. **Адаптировать binary search algorithm прямо.** Можно лицензировать (Apache 2.0 — совместимо с нашим планом Apache 2.0). Алгоритмическая идея — re-implement без копирования кода.
2. **ASP operation `asp/rankRelevant({query, budget, personalization?})`** — кандидат №1 для Stage 2a. Возвращает symbols + token-count estimate. Default budget = 4096 (более щедрый, чем 1024 у Aider, но это design choice).
3. **Capability `tokenBudget`** в server's capabilities — заявляет default budget, max budget, granularity. Server без этой capability — не возвращает narrative output больше bare minimum.
4. **Storage backend choice** — для Stage 2a достаточно in-memory NetworkX-equivalent (если Python) или JGraphT (если JVM). Не нужен graph DB в alpha. Это влияет на будущий ADR «storage».
5. **Outreach к Paul Gauthier** — он отличный stakeholder. Если Aider RepoMap станет early adopter ASP — это серьёзный сигнал. Подход: предложить, что ASP операция `rankRelevant` напрямую вдохновлена RepoMap; попросить feedback на спеке черновика.

### Cross-references к нашим ADR

- **ADR 0001:** Aider RepoMap — file-level подход; GitNexus — symbol-level. ASP-спека должна решить, поддерживает ли обе абстракции (capability negotiation) или выбирает одну.
- **ADR 0002:** Paul Gauthier — приоритетный кандидат в «3 OSS agent maintainers» (gate criterion).
- **ADR 0003:** Stage 2a операции — `query` и `context` могут напрямую следовать RepoMap архитектуре (NetworkX + tree-sitter + token budget). Это **снижает risk** Stage 2a.
