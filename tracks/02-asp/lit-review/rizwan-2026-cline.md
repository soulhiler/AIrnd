# Cline — Tool-driven autonomous coding agent (on-demand reading, no pre-built index)

## Простыми словами

**Cline** — самый популярный из изученных нами бесплатных AI-помощников (62.1 тыс. звёзд на GitHub, больше чем Aider, Continue и GitNexus). Главное, что отличает Cline от трёх предыдущих: **он не строит карту кода заранее**. Когда ты ему даёшь задачу, он **сам ходит по проекту**, читает нужные файлы один за другим, выполняет команды в терминале и спрашивает у тебя разрешения на каждый шаг.

Аналогия: если GitNexus / Aider / Continue — это **навигатор с заранее загруженной картой города**, то Cline — это **человек, который идёт по городу и спрашивает прохожих**. Подход медленнее, но не требует подготовки и работает даже на коде, который никто раньше не индексировал.

Это **критически важно** для нашего стандарта: значит, ASP должен поддерживать **два совершенно разных типа клиентов** — тех, кто запрашивает «дай мне готовые ответы из индекса», и тех, кто запрашивает «дай мне инструменты, чтобы я сам читал файлы».

## Metadata

- **Authors:** Saoud Rizwan (main creator); cline.bot organization (corporate sponsor); large OSS community
- **Year:** 2023–2026 (активная разработка, последний релиз CLI v3.0.9 — 2026-05-20)
- **Venue:** Open-source project ([cline/cline](https://github.com/cline/cline), 62.1k★, Apache 2.0); marketplace VS Code extension `saoudrizwan.claude-dev`; SDK + CLI + IDE extension
- **arXiv / DOI:** —
- **Citation key:** rizwan-2026-cline
- **Дата прочтения:** 2026-05-21
- **Relevance (1–5):** **5** — четвёртая критическая prior art после GitNexus, Aider, Continue. Cline представляет **другой архитектурный класс** (tool-driven on-demand vs index-driven). Без него спецификация ASP была бы биaсной в сторону «индексированных» подходов.
- **Tags:** code-intelligence, oss-agent, mcp-client, tool-use, on-demand-reading, no-index, plan-act-modes, prior-art, **critical**

## TL;DR

Cline — open-source autonomous coding agent (VS Code extension + SDK + CLI), 62.1k★, Apache 2.0. Принципиально отличается от GitNexus / Aider / Continue: **не строит pre-built index** кодобазы. Вместо этого предоставляет LLM 25+ инструментов (`read_file`, `list_files`, `search_files`, `apply_patch`, `execute_command`, browser automation, MCP integration) и запрашивает разрешение пользователя перед каждым действием. **Two-mode workflow:** Plan mode — read-only exploration для понимания архитектуры; Act mode — destructive operations с approval. **MCP-native** — может использовать external MCP servers (GitNexus, наш будущий `asp-ref` и т.д.) через `.cline/mcp.json`. Maintainer: Saoud Rizwan; significantly more stars than other OSS agents в нашем литобзоре.

## Key claims

- **Claim 1 — «No pre-built index, navigate on-demand».** Quote: «*Cline uses read-only tools to explore the codebase before making changes, including the ability to list files, search for specific code patterns, and analyze project architecture to ensure its modifications are well-informed*». Это **архитектурный антипод** GitNexus / Aider / Continue: zero index, zero embeddings, zero pre-computation. Tradeoff: medленно для каждой задачи, но **бесплатно при cold start** и работает на любом проекте.
- **Claim 2 — «Plan / Act mode separation».** Quote: «*Plan mode is a non-destructive reasoning phase. Plan mode is for read-only exploration and architecture, while Act mode is for actual code changes*». Это **structural safety boundary**, не просто UX. Spec implication: ASP может различать operations по их side effects, и server может advertise per-operation safety class.
- **Claim 3 — «Permission-based execution».** Quote: «*Cline asks for permission before every action, wanting approval to read files, create new ones, or run terminal commands. The auto-approve feature lets you set specific permissions for different types of operations*». Это **finer-grained, чем yes/no toggle** — пользователь может разрешить «безопасные» операции автоматически. **Pattern для ASP:** operation должен advertise свой safety class.
- **Claim 4 — «25+ built-in tools + MCP-native».** Tools include: `read_files`, `apply_patch`, `search`, `editor`, `list_files`, `execute_command`, browser automation (Puppeteer). MCP integration через `.cline/mcp.json` — может использовать любой external MCP server. **Cline — perfect downstream consumer для ASP**: если ASP-server существует, Cline его подключит как один из tools.
- **Claim 5 — «40+ LLM providers + sub-agents + hooks + skills».** Архитектура **открытая и расширяемая**. Quote (из docs): «*Cline's feature set includes 40+ providers, hooks, sub-agents, browser automation, MCP integration, prompt variants, and skills*». **Это model-agnostic** — Cline работает с Claude, GPT, DeepSeek, Llama, local. Спека ASP должна быть тоже model-agnostic (никаких vendor-specific assumptions).

## Methodology

Cline — production OSS-продукт (не academic paper). **No publicly published benchmarks** vs Aider, Continue, GitNexus. Validation — через user adoption (62.1k★ — самый звёздный в нашем списке) + active development cadence (CLI v3.0.9 released 2026-05-20, день перед нашим обзором).

Дизайн-философия (из docs + community discussion):

- **«Tool use as primary primitive»** — следуя Anthropic's tool use pattern в Claude API. Каждая операция = explicit tool call с явным input/output schema.
- **«Approval over autonomy»** — намеренная trade-off: медленнее, но безопаснее для production кода.
- **«Plan separately from Act»** — separation of concerns; reasoning phase isolated.

## Gap (для нашего трека)

### Что Cline НЕ покрывает (и где ASP добавляет ценность)

- **Не предоставляет code intelligence server interface.** Cline — **client** (использует tools), не **server** (предоставляет tools). Не конкурент с GitNexus, не альтернатива нашему `asp-ref`. Это **complement**.
- **Tool definitions ad-hoc.** Cline's tools (`read_file`, `list_files`, etc.) определены внутри codebase Cline. Любой другой agent (Aider, Continue) определяет свои похожие. **Это N×M проблема** — без стандарта каждый agent делает свои tools, sharing невозможен. **ASP закрывает именно этот gap.**
- **No structural understanding** — Cline не знает «функция X вызывает функцию Y», только «вот вам файл, найдите там». Если такая структурная информация была бы доступна через ASP capability, Cline мог бы её использовать для smarter file selection.
- **No token budget enforcement на tool output.** `read_file` возвращает весь файл; если файл огромный — переполнение context. Aider's token budget pattern (см. lit-review) более disciplined. **ASP может предлагать tokenBudget per operation как сильную convention.**
- **No degradation signals в стандарте.** Cline tools возвращают raw outputs; нет structured «я не смог сделать X из-за Y». **Наш fix #5** ещё раз подтверждён.

### Что из Cline стоит переиспользовать в дизайне ASP

1. **Plan / Act mode pattern** как **operation safety class** в спеке:
   - Каждая ASP operation объявляет `safetyClass: "read-only" | "side-effecting" | "destructive"`.
   - Client может policy-based auto-approve read-only operations.
   - Это **direct adaptation** Cline's pattern в protocol-level standardization.
2. **Permission semantics в protocol.** Server может требовать explicit approval для side-effecting operations. ASP operation response может включать `requiredApproval: boolean`. Client (Cline-like) реализует UI.
3. **MCP-native semantics.** Cline загружает MCP servers через `.cline/mcp.json`. ASP MUST inherit MCP's lifecycle/transport (ADR 0001 — мы это уже зафиксировали), но Cline's `.cline/mcp.json` — concrete deployment convention, которую ASP может стандартизировать как `.asp-servers.json` или продвигать `.mcp.json` как universal convention.
4. **Tool-driven minimal operation set.** Cline доказывает, что **5-6 базовых tools достаточно** для широкого спектра задач:
   - `read_file`
   - `list_files`
   - `search_files` (ripgrep-style)
   - `apply_patch`
   - `execute_command`
   - `write_file`

   ASP может ввести **этот subset как mandatory baseline operations** (минимальный compliance set). Indexed operations (`findByTag`, `retrieve`, `impact`) — опциональные capabilities.

### Архитектурный вывод

**ASP должна accommodate два класса серверов:**

1. **Indexed servers** (GitNexus, наш `asp-ref` Stage 2c) — advertise `retrieve`, `impact`, `findByTag`, `cypher`, etc. Pre-built index requires upfront cost.
2. **Tool-driven servers** (минимальный compliance) — advertise только `read_file`, `list_files`, `search_files`. No index requirement.

**Client-side:**

- **Indexed clients** (Aider RepoMap, Continue.dev codebase indexing) — могут использовать either тип servers.
- **Tool-driven clients** (Cline) — используют только базовый baseline (или mock-индексированные через tools).

**Capability negotiation** определяет, какой class.

## Open questions

- **Q1: Сколько Cline пользователей реально используют MCP integration?** 62.1k★ — много, но из них N тысяч могут не настраивать MCP. Если adoption MCP внутри Cline низкий — наш target audience for ASP уже сужается. Нужны данные.
- **Q2: Как Cline решает «какой файл прочитать первым»?** На больших проектах (500k+ LOC) random walk через `list_files` неэффективен. Есть ли у Cline heuristics? **Прочитать source code Cline или discussion** в их community.
- **Q3: Cost / latency comparison** — Cline (no index, on-demand reads) vs GitNexus (pre-index, cypher queries) на одной задаче. Это **prime candidate для experiment в Gate 3 → 4**.
- **Q4: Cline's safety boundary через approval — масштабируется ли?** На задаче с 50 file reads — пользователь approve каждый? Auto-approve cuts safety. Trade-off не очевиден. **Стоит включить в use cases analysis** (`design/02-use-cases.md`).
- **Q5: Sub-agents в Cline** — что они умеют, как изолированы? Может быть, ASP должна accommodate sub-agent capabilities или это implementation detail.

## Related work cited

- **Cline docs:** <https://docs.cline.bot/getting-started/what-is-cline>, <https://docs.cline.bot/tools-reference/all-cline-tools>.
- **Cline source:** <https://github.com/cline/cline>.
- **DeepWiki Cline analysis:** <https://deepwiki.com/cline/cline/8-developer-guide>.
- **Cline codebase deep-dive:** <https://dev.to/neuzhou/i-read-every-key-file-in-clines-560k-line-codebase-heres-whats-actually-inside-4lmb>.
- **MCP spec** (Anthropic 2024–2025) — уже в нашем lit-review; Cline — MCP-native client.
- **Marketplace listing:** <https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev>.

## Личные заметки

### Что зацепило

- **62.1k★ — biggest signal в нашем литобзоре.** Cline более adopted, чем GitNexus (39.5k), Aider (45.1k), Continue (33.3k). Это значит **on-demand tool-driven approach имеет большую adoption**, чем pre-indexed подходы среди OSS-агентов. Это **важно для приоритизации ASP design**.
- **Plan / Act mode separation — strong UX pattern.** Не просто UI feature; structural safety boundary. ASP может это формализовать как `safetyClass` per operation. **Это, возможно, важнее, чем мы думали.**
- **Cline как perfect downstream consumer.** Если ASP server существует, Cline загрузит его через MCP — zero outreach effort. **Это значит:** наш ASP должен быть **MCP-server-shaped**, не CLI-shaped и не library-shaped.
- **Saoud Rizwan** — solo creator → corporate-backed organization (cline.bot). История успеха OSS commercialization. **Outreach target №1** по ADR 0002.

### С чем не согласен / что бы сделал иначе

- **No structural code understanding** — Cline ходит «на ощупь». На простых проектах это OK, на 500k+ LOC это становится bottleneck (latency, cost, missed files). **ASP capability для structural lookups (`findByTag`, `findReferences`) ровно это решает.** Cline станет faster + smarter, подключив ASP-server.
- **Approval fatigue.** На задаче «реализуй фичу X» Cline может попросить approve 30+ tool calls. Это **destroys flow**. Auto-approve компенсирует, но снижает safety guarantee. **ASP может предложить batched approval** через operation grouping (transaction-like).
- **No token budget.** `read_file` returns whole file. На 5k+ LOC файлах это переполнение context. **ASP включает tokenBudget как обязательную convention** — Cline tools могут стать budget-aware если ASP вводит этот стандарт.
- **Ad-hoc tool definitions.** `read_file` у Cline ≠ `read_file` у Aider. Schema-incompatible. **ASP стандартизирует JSON Schema** для всех common tool operations — это **прямой контрибуция.**

### Идеи на будущее (Stage 2a/2b influence)

1. **ASP minimal compliance set:** mandatory operations для любого ASP server: `asp/readFile`, `asp/listFiles`, `asp/searchFiles`. Все остальные — optional capabilities. Это даёт **низкий barrier to entry** + Cline-like clients работают сразу.
2. **`safetyClass` per operation** в ASP-спеке: `read-only`, `side-effecting`, `destructive`. Client policy: auto-approve `read-only`, ask for `side-effecting`, never auto-approve `destructive`. **Прямо вдохновлено Cline's Plan/Act + auto-approve features.**
3. **`tokenBudget` per operation response** (включая `asp/readFile`). Server либо возвращает partial output с `truncated: true`, либо возвращает streaming. **Address Cline's gap.**
4. **Operation grouping (batched approval).** ASP может включать `asp/beginBatch` / `asp/commitBatch` для transactions. Client approve один раз для всей операции. **Address approval fatigue.**
5. **Outreach к Saoud Rizwan / Cline community** — приоритет №1 (по ADR 0002). Если Cline станет early adopter ASP — наш стандарт получает 62k★ user base. Подход: предложить Cline тестовый ASP server (наш `asp-ref` Stage 2a), попросить feedback на спеке. **Это может стать главным adoption signal трека.**

### Cross-references к нашим артефактам

- **ADR 0001:** Cline — MCP-native, что подтверждает наш выбор MCP-inherited transport.
- **ADR 0002:** Saoud Rizwan / Cline — outreach priority №1 (62k★ user base).
- **ADR 0003:** ASP-ref Stage 2a operations должны быть **MCP server, mountable в Cline** через `.cline/mcp.json`. Это даёт нам early concrete user.
- **ADR 0004:** Hierarchical tags не нужны Cline для базовой работы. Но **value-add** для Cline: tag-based file selection (запрос «найди все tests» через tag вместо random walk). Это motivation для ASP capability negotiation — Cline может opt-out если не использует.
- **Idea 001 (toy):** наш `001-toy/generate_tags.py` — это пример server-side капабилити. Через ASP server он становится доступен Cline.
- **Контраст в lit-review:** Cline = on-demand reading. Aider / Continue / GitNexus = pre-built index. **Это последний важный архитектурный axis.**

### Финальная сравнительная таблица четырёх OSS-агентов / интеллект-серверов

| Аспект | GitNexus | Aider | Continue | **Cline** |
|---|---|---|---|---|
| Тип | Code intel **server** | Coding **agent** + RepoMap **внутри** | Coding **agent** + indexing **внутри** | Coding **agent**, no index |
| Подход к коду | Typed graph index | PageRank index | Embeddings index | **On-demand reading** |
| MCP role | MCP server | (нет MCP — internal) | (нет MCP — internal) | **MCP client + server consumer** |
| Token budget | ❌ | ✅ first-class | ⚠️ через contextLength | ❌ |
| Approval pattern | (server-side, нет) | (internal, prompt-based) | (internal, prompt-based) | **First-class, structured** |
| Plan/Act separation | — | — | — | ✅ structural |
| Stars | 39.5k★ | 45.1k★ | 33.3k★ | **62.1k★** |
| License | PolyForm NC | Apache 2.0 | Apache 2.0 | Apache 2.0 |
| Реализатор | Solo (Patwari) | Solo (Gauthier) | Corporate (Continue Dev) | Solo → corporate (cline.bot) |

**Главный вывод для ASP-спеки (финальный после 4 ключевых работ):**

1. **Two server classes:** indexed (minimal subset = `retrieve`, `impact`, `findByTag`, etc.) + tool-driven (mandatory baseline = `readFile`, `listFiles`, `searchFiles`). Через capability negotiation.
2. **`safetyClass` per operation** — структурная safety, не только UX. От Cline.
3. **`tokenBudget` per operation** — от Aider.
4. **Hierarchical tags** — от toy + Semgrep prior art (ADR 0004).
5. **Hybrid retrieval modes** — от Continue.
6. **Structural impact analysis** — от GitNexus.

**ASP-спека = union этих 6 patterns**, через capability negotiation так, что любая реализация может implement subset.
