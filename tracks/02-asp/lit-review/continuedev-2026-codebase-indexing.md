# Continue.dev — Embeddings + LanceDB + Tree-sitter Hybrid Codebase Indexing

## Простыми словами

**Continue.dev** — бесплатный AI-помощник для программистов, встраивается в среду разработки (VS Code, JetBrains). Это **третий главный конкурент** GitNexus / Aider в нашем литобзоре, и у него **полностью другой подход** к поиску кода для AI:

- Aider — ранжирует кусочки кода через PageRank (как Google ранжирует сайты), без всякого «семантического понимания».
- GitNexus — строит карту типизированных связей (класс → метод → вызов), запросы через свой язык.
- **Continue.dev** — превращает все кусочки кода в **числовые отпечатки** («embeddings» — векторы из сотен чисел, которые «улавливают смысл»), складывает их в специальную базу данных LanceDB, и потом ищет по «похожести смысла», не по точным словам.

Главное, чему мы научимся у Continue.dev: **гибридный подход** (embeddings + ключевые слова + дерево синтаксиса), **локальная база данных** (всё хранится на компьютере, не в облаке), **двухэтапный отбор** (сначала отобрать 50 лучших, потом AI выбирает 10 самых нужных).

## Metadata

- **Authors:** Continue Dev, Inc. (open-source community + corporate sponsor)
- **Year:** 2023–2026 (активная разработка)
- **Venue:** Open-source project ([continuedev/continue](https://github.com/continuedev/continue), 33.3k★, Apache 2.0); docs at <https://continue.dev/>
- **arXiv / DOI:** —
- **Citation key:** continuedev-2026-codebase-indexing
- **Дата прочтения:** 2026-05-21
- **Relevance (1–5):** **5** — третья критическая prior art после GitNexus и Aider. Контраст подходов (embeddings vs PageRank vs typed graph) задаёт spectrum архитектурных решений, которые ASP должна accommodate через capability negotiation.
- **Tags:** code-intelligence, embeddings, vector-db, lancedb, tree-sitter, ripgrep, oss-agent, prior-art, hybrid-retrieval

## TL;DR

Continue.dev решает ту же задачу, что Aider и GitNexus — выбор релевантного контекста для LLM из большой кодобазы — но через **embedding-based semantic retrieval** + tree-sitter AST + ripgrep keyword search. Indexing pipeline: разбивает код на чанки (10-line blocks по умолчанию), генерирует embeddings (default: transformers.js локально; optional: Voyage AI code embedding model), хранит вектора в LanceDB (in-memory + disk persistence) в `~/.continue/index`. На retrieval — двухстадийный pipeline: top-50 кандидатов из вектор-базы (`nRetrieve=50`), потом LLM-based re-rank до top-10 (`nFinal=10`). 33.3k★, Apache 2.0, поддерживается компанией Continue Dev, Inc.

## Key claims

- **Claim 1 — «Embeddings для семантического поиска по смыслу, а не по словам».** Quote: «*converts code snippets, functions, and documentation into high-dimensional vectors using embedding models, capturing the meaning of code rather than just keywords*». Это **полная противоположность** Aider, который использует только структурный сигнал (граф ссылок). Continue добавляет **семантическое измерение**.
- **Claim 2 — «Local-first + LanceDB как backbone».** Embeddings вычисляются и хранятся локально через transformers.js; вектор-база — LanceDB (in-memory + disk persistence в `~/.continue/index`). Quote: «*LanceDB's in-memory architecture keeps this process fast and resource-efficient, while its disk-based storage keeps data persistent and secure*». **Это валидирует наш fix #1 (offline-first FTS)** — local-first архитектура реалистична и production-ready.
- **Claim 3 — «Двухстадийный retrieval: vector → LLM rerank».** `nRetrieve=50` начальных кандидатов из vector DB, потом `useReranking=true` запускает LLM, который отбирает `nFinal=10` финальных. Quote (config schema): «*will allow initial selection of nRetrieve results, then will use an LLM to select the top nFinal results*». **Это паттерн, который ASP может стандартизировать как capability.**
- **Claim 4 — «Hybrid: embeddings + AST + ripgrep».** Не выбирает один подход — комбинирует. Tree-sitter для AST chunking (по смысловым границам, не по строкам), embeddings для семантической близости, ripgrep для exact keyword fallback. **Quote:** «*indexed using embeddings stored in vector databases, AST parsing via tree-sitter, and fast text search through ripgrep*». Это **anti-bet-on-one-horse архитектура**.
- **Claim 5 — «Chunking как первоклассный параметр».** Code чанкуется в ~10-line blocks по умолчанию; ~1M векторов для 10M LOC. Это даёт **predictable scaling characteristics**, в отличие от Aider's PageRank (который замедляется на больших графах).
- **Claim 6 — «.gitignore + .continueignore as discovery contract».** Respect default `.gitignore`, плюс custom `.continueignore` для дополнительных exclusions. **Convention, которую ASP должна стандартизировать** — иначе каждый сервер делает по-своему.

## Methodology

Continue.dev — production OSS-продукт, **не academic paper**. Validation — через user adoption (33.3k★), DevTools реализация в VS Code/JetBrains, поддержка enterprise-кастомеров. **Нет publicly published benchmarks** vs Aider, GitNexus, embeddings-only baselines. Известные критические issues от users: «@Codebase doesn't include relevant files» (GitHub issue #7072) — указывает, что pure embedding retrieval **сам по себе может miss контекст без structural signals** (что и подтверждает hybrid подход).

Технические параметры (из config schema):

| Параметр | Default | Назначение |
|---|---|---|
| `nRetrieve` | 50 | Top-N кандидатов из vector DB на первой стадии |
| `nFinal` | 10 | Top-N финальных результатов после LLM re-rank |
| `useReranking` | `true` | Включает LLM-based re-rank пайплайн |
| `contextLength` | 2048 | Maximum LLM context window (в токенах) |
| Chunk size | ~10 lines | Размер блока для embedding |
| Vector dimensions | model-dependent | transformers.js default; Voyage AI code model — 1024-dim |
| Storage | `~/.continue/index` | Local LanceDB |
| Discovery filters | `.gitignore` + `.continueignore` | Какие файлы пропустить |

## Gap (для нашего трека)

### Что Continue.dev НЕ покрывает (и где наш потенциальный contribution)

- **Не MCP server.** Continue's indexing — internal API VS Code/JetBrains extensions. Не доступен другим агентам (Aider не может позвать Continue's index). Это **тот же gap**, что у Aider RepoMap. **ASP может стандартизировать MCP-facade поверх такого indexing.**
- **Нет structured graph operations** (impact analysis, rename, references). Embeddings отлично находят «semantically похожее», но не отвечают «что сломается, если я изменю X». GitNexus покрывает это, Continue — нет.
- **Embeddings без structural signals — known limitation** (issue #7072). Это **сильный аргумент**, что pure semantic retrieval недостаточен. ASP должна **требовать гибрид** в спецификации.
- **Нет explicit degradation signals.** Если embedding model не загрузилась — silent fallback на ripgrep, без уведомления. **Наш fix #5** в чистом виде, подтверждено вторым independent product-ом.
- **Output формат не стандартизирован** — Continue возвращает code chunks для своего внутреннего prompt builder. Не JSON, не Markdown-with-metadata. Нет cross-client interop. **ASP должна определить standard structured response.**
- **Re-ranking как scope creep.** LLM re-rank — мощный pattern, но **требует доступа к LLM API внутри indexing server**. Это раздувает реализационную сложность. ASP может предложить re-ranking **как opt-in capability**, с возможностью отключить.

### Что из их методологии стоит переиспользовать

1. **Двухстадийный retrieval как ASP operation** — `asp/retrieve({query, nRetrieve, nFinal, rerank})`. nRetrieve / nFinal — стандартные параметры. Re-rank — opt-in capability.
2. **LanceDB как backend choice** для будущей reference implementation (наш `asp-ref`). Альтернативы: SQLite + sqlite-vec extension, DuckDB + vector. LanceDB более mature, но больше dependency. **Это влияет на будущий ADR «storage backend».**
3. **`.gitignore` + custom-ignore как discovery convention** — ASP **должна стандартизировать** в спецификации.
4. **Chunk size as configurable** — параметр, который заявляется в server capabilities (`maxChunkSize`, `defaultChunkSize`).
5. **transformers.js для local embeddings** — proof, что embeddings работают локально без cloud API. Снимает аргумент «embeddings = vendor lock-in».

## Open questions

- **Q1: Какая ranking метрика лучше — PageRank (Aider) или cosine similarity (Continue)?** Нет publicly published comparison. Это может быть **наш экспериментальный contribution** на Gate 3 → 4: bench обоих на SWE-bench Lite.
- **Q2: Когда LLM re-rank reasonably дешёвый?** На каждый запрос — 10× rerank calls = существенная latency и cost. Continue делает opt-in (можно выключить). ASP capability должна это явно advertise.
- **Q3: Hybrid формула.** Continue использует embeddings + ripgrep + tree-sitter — но **как комбинируются финальные scores**? Из docs неясно, есть ли weighted sum, RRF (Reciprocal Rank Fusion), или sequential filter. Стоит прочитать source code (если позволяет время).
- **Q4: Cold-start cost.** Embedding всех 10M LOC = 1M vectors. На laptop CPU это часы. Continue делает incremental indexing на mtime changes — но первый run всё равно медленный. ASP capability должна сообщать `expectedIndexingTime`.
- **Q5: Markdown indexing.** Continue индексирует source code, **не упоминает явно markdown**. У GitNexus markdown — first-class (411 Section nodes на нашем репо). У Aider tree-sitter поддерживает markdown — но RepoMap по умолчанию его не использует. Это **gap**, который ASP может закрыть.

## Related work cited

- **LanceDB** — Apache 2.0 vector DB, основной storage backend Continue.
- **transformers.js** — Hugging Face's JavaScript transformers — для local embeddings.
- **Voyage AI code embedding model** — optional remote alternative.
- **tree-sitter** (Brunsfeld 2018) — уже в нашем lit-review.
- **ripgrep** (BurntSushi) — fast keyword search backbone.
- **Continue's @Codebase docs:** <https://docs.continue.dev/customize/context/codebase>.
- **DeepWiki «Codebase Indexing»** — secondary source: <https://deepwiki.com/continuedev/continue/3.4-context-providers>.
- **LanceDB blog «Inside Continue's LanceDB-Powered Evolution»** — secondary source: <https://lancedb.com/blog/the-future-of-ai-native-development-is-local-inside-continues-lancedb-powered-evolution/>.

## Личные заметки

### Что зацепило

- **Hybrid retrieval (embeddings + AST + ripgrep) как architectural pattern.** Continue **не выбирает один horse**. Это **сильный signal для ASP-спеки**: не диктовать одну стратегию ranking. **Дать capability negotiation**: server заявляет, какие retrieval modes поддерживает (`vector`, `keyword`, `graph`, `hybrid`); агент выбирает.
- **nRetrieve / nFinal как универсальный паттерн.** Это generalization Aider's «token budget» — Aider жёстко ограничивает финальный output, Continue делает **двухстадийный funnel**. **ASP-спека может включать оба**: `tokenBudget` (max output size) + `nRetrieve` / `nFinal` (retrieval stages).
- **LanceDB как Apache-2.0 storage** — компетентный choice для будущего `asp-ref`. Один dependency, embedded mode, persistent. Альтернатива SQLite-based решений (vec-extensions).
- **`.continueignore` как convention** — простая, прозрачная, легко документируется. **ASP MUST specify** equivalent: `.aspignore` или (более амбициозно) **общий стандарт** для всех agentic tools (по аналогии с `.gitignore`).

### С чем не согласен / что бы сделал иначе

- **Pure embedding focus в early Continue versions** — Continue's docs упоминают, что «@Codebase» был embedding-only first; structural signals добавили позже. Это **valuable lesson**: embedding alone недостаточен. ASP-спека должна **с самого начала требовать** возможность гибрида.
- **LLM re-rank как default-on** — `useReranking=true` по умолчанию. Это **дорого** для длинных interactive sessions. ASP должна сделать re-rank **opt-in capability** (`features.rerank`), а не default behavior.
- **Output не structured** — те же грабли, что у Aider. ASP requires JSON. Render — клиент.
- **No degradation signals** — silent failures (issue #7072: «doesn't include relevant files» — пользователь не знает, почему). Наш **fix #5** ещё раз подтверждён.
- **No graph / impact analysis** — embeddings не отвечают «что сломается». ASP должна поддерживать graph operations через **отдельную capability** — серверы, которые делают только vector retrieval, не обязаны реализовывать impact.

### Идеи на будущее (Stage 2a/2b influence)

1. **ASP operation `asp/retrieve({query, nRetrieve, nFinal, rerank?, modes?})`** — `modes: ["vector", "keyword", "graph"]` advertise какие активны.
2. **Capability `retrievalModes`** — server заявляет, какие из (`vector`, `keyword`, `graph`, `hybrid`) поддерживает.
3. **Capability `reranking`** — заявляет, поддерживает ли LLM re-rank, и если да — какой model bound (chat, embedding, custom).
4. **Storage backend для `asp-ref`:** LanceDB — серьёзный кандидат. Альтернативы — DuckDB + extension, SQLite + sqlite-vec, simple in-memory faiss. **Trade-off:** LanceDB больше dependency, но best-in-class persistence. Решается в будущем ADR.
5. **`.aspignore` как convention** — стандартизировать в ASP-спеке (или, более амбициозно, продвинуть как cross-tool standard в discussion с Aider + Continue + Cline).
6. **Outreach к maintainer-ам Continue.dev** — приоритетный кандидат в «3 OSS agent maintainers» (gate criterion из ADR 0002). Контакт: GitHub issues / Discord.

### Cross-references к нашим артефактам

- **ADR 0001 (ASP scope):** Continue's hybrid retrieval подтверждает, что **no single approach is enough** — ASP должна accommodate множественные.
- **ADR 0002 (OSS scope):** Continue Dev, Inc. — open-source company с Apache 2.0; идеальный target user для нашей спеки.
- **ADR 0003 (reference impl):** LanceDB — кандидат на storage backend для `asp-ref`. Stage 2a может использовать embedded LanceDB.
- **[Idea 001: иерархические теги](../ideas/001-hierarchical-tags.md)** — Continue's embeddings vs GitNexus typed graph дают spectrum, в котором иерархические теги могут найти своё место (например, как hierarchical chunking strategy).

### Контраст трёх изученных prior art

| Аспект | GitNexus | Aider RepoMap | Continue.dev |
|---|---|---|---|
| Главный сигнал | Typed graph (CALLS, REFERENCES) | PageRank на file graph | Embeddings (semantic similarity) |
| Storage | LadybugDB (graph) | NetworkX (in-memory) | LanceDB (vector DB) |
| Query language | Cypher (custom dialect) | — (return string) | Vector search + ripgrep |
| Output | Cypher result rows + JSON tools | Formatted string (LLM prompt) | Code chunks |
| Token budget | ❌ (no enforced limit) | ✅ first-class (binary search) | ⚠️ via `contextLength`, but enforcement в client |
| Local-first | ⚠️ (FTS extension requires download) | ✅ | ✅ (transformers.js + LanceDB local) |
| Re-ranking | — | — | ✅ LLM-based |
| Markdown indexing | ✅ first-class | ⚠️ tree-sitter supports, RepoMap default skips | ❌ no explicit support |
| Impact analysis | ✅ (gitnexus_impact) | ❌ | ❌ |
| License | PolyForm Noncommercial | Apache 2.0 | Apache 2.0 |
| Stars | 39.5k★ | 45.1k★ | 33.3k★ |

**Вывод для ASP-спеки:** должна поддерживать все три абстракции через capability negotiation, а не выбрать одну. **Это сильный аргумент** против минималистичного scope.
