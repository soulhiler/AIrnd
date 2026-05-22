# ASP — открытый стандарт для AI-агентов по коду. Статья для друга

- **Дата:** 2026-05-22
- **Статус:** черновик, готов к рассылке
- **Аудитория:** программист, который пользуется AI-агентами для кода (Cline / Goose / Continue / Cursor) и интересуется тем, как они устроены изнутри.

## TL;DR

`asp-ref` — это **MCP-сервер на TypeScript** (Apache 2.0), который умеет читать, индексировать и понимать твою кодобазу для AI-агентов. Подключается одной строкой в `.cline/mcp.json` (или его аналоге у других агентов). 12 операций: поиск, иерархические теги, retrieval с эмбеддингами, анализ влияния, мутации. 12 языков через tree-sitter. Работает офлайн.

Это **reference implementation** open RFC спецификации **ASP (Agent Server Protocol)** — попытки стандартизировать то, что сегодня каждый агент пилит сам.

Альфа. Тестируется на нашем собственном репо. Реальных внешних пользователей ноль. Зову попробовать.

Репо: <https://github.com/soulhiler/AIrnd/tree/main/tracks/02-asp>

## Зачем эта штука вообще

Все современные OSS AI-агенты — Cline, Goose, Aider, Continue, Cursor — делают примерно одно и то же с кодом:

- Ищут файлы по имени / содержимому.
- Извлекают функции, классы, методы через AST.
- Иногда строят embeddings.
- Иногда строят граф вызовов.
- Подают это LLM в правильно урезанном виде.

И каждый агент **пишет это с нуля**. У Cline свой набор tools, у Aider свой RepoMap, у Continue свой `@Codebase`. Tool написанный для одного агента **не работает** с другим. Это **N×M problem**.

Стандарт MCP (от Anthropic) решает transport layer — но не диктует *что* серверы должны уметь делать с кодом. ASP — попытка закрыть этот gap: thin layer над MCP, который **типизирует операции, специфичные для code intelligence**.

Если ASP взлетит — любой `asp-*` сервер (наш, GitNexus в форке, твой будущий) работает с любым агентом, который умеет MCP.

## Что в `asp-ref` реально работает

Технически:

- **12 операций** через MCP tools:
  - `asp_readFile`, `asp_listFiles`, `asp_searchFiles` — базовые операции на файлах (с FTS5).
  - `asp_findByTag` — поиск по иерархическим тегам (`tracks/02-asp/decisions` находит все ADR + их секции).
  - `asp_context` — символ + его родитель + дети.
  - `asp_retrieve` — двухстадийный retrieval: vector (embeddings) / keyword (FTS5) / hybrid (Reciprocal Rank Fusion).
  - `asp_impact` — best-effort blast radius через call-граф (BFS, riskLevel).
  - `asp_refresh` / `asp_refreshStatus` — re-index с поддержкой incremental + path-scoped + async jobs.
  - `asp_writeFile` / `asp_applyPatch` — destructive мутации.
  - `asp_capabilities` — что сервер умеет.

- **12 языков** через tree-sitter WASM: Python, TypeScript, TSX, JavaScript, Rust, Go, Java, C#, Ruby, Bash, C, C++. WASM-only — не нужен native toolchain, работает на любой платформе с Node 20+.

- **SQLite** для индекса (`.asp/index.db` в корне репо). FTS5 встроен — никаких внешних download'ов как у некоторых конкурентов. ~330мс для 80 файлов / 1300 символов на нашем репо.

- **Local embeddings** через `@xenova/transformers` (опционально, off by default — `ASP_ENABLE_EMBEDDINGS=1`). 384-dim векторы хранятся как Float32 BLOB в SQLite. Линейный скан + cosine similarity. OK до ~10k символов; больше — нужен ANN, в roadmap.

- **LLM rerank** (опционально) — двух-стадийный retrieval в стиле Continue.dev. Провайдер: либо `ANTHROPIC_API_KEY` (direct Claude call), либо MCP sampling (если клиент advertise sampling capability). Без ни того, ни другого — gracefully возвращает stage-1 ordering + честный degradation entry.

- **Безопасность:** path traversal protection (рекурсивно отказываем `../` и absolute paths), уважение `.gitignore`, deny-list для секретов (`.env`, `.pem`, `id_rsa`, `credentials.json`).

- **43 теста** покрывают индексеры, операции, инкрементальный режим, защиту путей, мутации, retrieve в трёх режимах. Запускаются за ~2 секунды.

## Что делает `asp-ref` отличным от GitNexus / Aider RepoMap

`asp-ref` родился из dogfooding GitNexus в наш репозиторий и фиксации **5 раздражающих вещей**, которые мы хотим сделать лучше:

1. **Offline-first FTS.** GitNexus подтягивает FTS extension с своего CDN при запуске. У нас на sandboxed runner — 403. У `asp-ref` FTS5 встроен в SQLite, работает на любой машине без сети.
2. **Honest degradation signals.** Каждый response содержит `degradation: []`. Когда что-то не работает (модель эмбеддингов не скачана, rerank не настроен, граф не построен) — мы **явно сообщаем** с конкретной причиной. GitNexus / Continue в таких случаях молчат.
3. **Standardised query.** Все операции через типизированный JSON-RPC, спека описана. У GitNexus есть Cypher escape hatch на их собственном диалекте LadybugDB — изучить нельзя на других системах.
4. **Opt-in instrumentation.** Никакой auto-modification файлов проекта. GitNexus переписывает CLAUDE.md / AGENTS.md без спросa, что местами раздражает.
5. **Иерархические теги** через `kind/callable/function`, `lang/python`, `tracks/02-asp/decisions` — структурный аналог фасетного поиска. У SCIP / LSIF только плоский Kind enum.

Ничего из этого не «революция». Это **инкрементальные улучшения** там, где мы натыкались на боль.

## Quick start — 5 минут

```bash
git clone https://github.com/soulhiler/AIrnd.git
cd AIrnd/tracks/02-asp/prototype
npm install        # ~10 секунд, ставит 6 пакетов + deps
npm run build      # ~3 секунды, tsc strict mode
npm test           # 43 теста за ~2 секунды
```

Подключение к Cline (`.cline/mcp.json` в корне твоего проекта):

```json
{
  "mcpServers": {
    "asp-ref": {
      "command": "node",
      "args": ["/полный/путь/к/AIrnd/tracks/02-asp/prototype/dist/server.js"]
    }
  }
}
```

Перезапустить Cline. Если всё хорошо — в логах увидишь `[asp-ref] Index empty; starting background scan...`, через секунду — `Initial scan complete: N files, M symbols, X ms`.

Дальше в Cline просто проси «найди все ADR» / «что сломается если я изменю функцию X» — Cline увидит наши tools и использует.

## Если хочется попробовать на полную

С эмбеддингами:

```bash
ASP_ENABLE_EMBEDDINGS=1 node dist/server.js /path/to/repo
```

Первый запуск скачает модель `Xenova/all-MiniLM-L6-v2` (~22MB) с Hugging Face Hub. Дальше — офлайн.

С LLM rerank:

```bash
ASP_ENABLE_EMBEDDINGS=1 \
ASP_RERANK_PROVIDER=anthropic \
ANTHROPIC_API_KEY=sk-ant-... \
node dist/server.js /path/to/repo
```

При `asp_retrieve({rerank: true})` — реальный вызов Claude Haiku для переранжирования топ-кандидатов.

## Что НЕ работает (честно)

- **Реальных пользователей нет.** Я единственный, кто запускал это вне CI.
- **Edge resolution приближённый.** `asp_impact` использует anchor suffix match — над-приближает (false positives для общих имён типа `init`, `read`, `close`). Точное LSP-style resolution — отдельная задача.
- **Не проверено на больших репо.** Тестировано на нашем (80 файлов). Linux kernel мы не индексировали.
- **ANN индекса нет.** Embeddings ищутся linear scan'ом — OK до 10k символов, медленнее на больших репо.
- **MCP sampling rerank** не проверен в реальном клиенте — нет агента в нашем тест-environment, который advertise sampling.
- **Concurrent writes** не тестировались. SQLite single-writer — race conditions потенциально возможны.
- **Mutations (`writeFile` / `applyPatch`)** не имеют автоматического re-index hook — после записи нужно вручную вызвать `asp_refresh`.

## Что я хотел бы услышать от тебя

Если попробовал:

1. **Установилось / не установилось** — даже если не использовал дальше. Хочу понять friction.
2. **Какие операции пригодились** — какие отсутствуют для твоего use case?
3. **Где degradation entry вылез** — где сервер честно сказал «не могу X»? Это сигнал, где улучшать.
4. **Что вырвало с корнем** — настоящие баги / неожиданное поведение. `npm test` + `npm run build` тебе помогут отделить regression от misuse.

Если хотя бы один из этих сигналов получу — `asp-ref` перестаёт быть «pet project в вакууме».

Issue / discussion в репо: <https://github.com/soulhiler/AIrnd/issues>

Контакт: `soulhiler@gmail.com`

## Что дальше

В ближайших шагах:

- Outreach к Cline / Goose / Aider / Continue maintainers (drafts готовы).
- Mini-SWE-bench (n=10) для смоук-тест эффекта.
- ANN индекс через sqlite-vec или HNSW pure-TS.
- Реальный edge resolution через LSP.

Если интересно contribute — ADR / spec / тесты — открыт.

## Дисклеймер

Это **research artifact**, не product. Цель трека — open RFC спецификация, а не конкуренция за пользователей с GitNexus. Если что-то в `asp-ref` тебе показалось полезным — забери и форкни под Apache 2.0. Если что-то показалось глупым — напиши, исправим вместе или закроем как закрытый wontfix.

Я ожидаю, что 80% этого письма уйдёт в спам. Если ты дочитал до этого момента — спасибо.

---

— soulhiler ([AIrnd track 02-asp](https://github.com/soulhiler/AIrnd/tree/main/tracks/02-asp))
