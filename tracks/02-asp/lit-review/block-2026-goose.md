# Goose — Open-source AI agent с extension framework на MCP (Block → Linux Foundation)

## Простыми словами

**Goose** — бесплатный AI-помощник для программистов и не только. Создан компанией Block (это владельцы Cash App), потом передан в **Linux Foundation** (некоммерческая организация, которая хранит важные открытые проекты — Linux, Kubernetes и т.д.). 45.6 тыс. звёзд на GitHub.

Главная особенность Goose — он **собран вокруг идеи расширений**. Сам по себе он минималистичный (написан на языке Rust), но **подключает 70+ дополнительных модулей** через тот же стандарт MCP, который мы уже встречали у Cline. Это значит: Goose можно научить почти чему угодно, просто подключив нужный модуль.

**Почему это важно для нашего стандарта:** Goose — **второй главный целевой пользователь после Cline**. Оба используют MCP, оба собирают расширения как Lego. Если наш ASP-сервер (`asp-ref`) появится — Goose подключит его без всяких изменений.

## Metadata

- **Authors:** Block, Inc. (originally) → **Agentic AI Foundation (AAIF) at Linux Foundation** (since November 2025)
- **Year:** 2025–2026 (launched January 2025; donated to Linux Foundation November 2025)
- **Venue:** Open-source project ([block/goose](https://github.com/block/goose), 45.6k★, Apache 2.0); release v1.34.1 (2026-05-15); 2,600+ forks; 368 contributors
- **arXiv / DOI:** —
- **Citation key:** block-2026-goose
- **Дата прочтения:** 2026-05-21
- **Relevance (1–5):** **4** — пятая значимая prior art в OSS-агенте экосистеме. Goose уже использует MCP (как Cline) — наш ASP-server подключится через тот же mechanism. **Goose как governance precedent** (donation Block → Linux Foundation) — это model для нашего трека если ASP-спека станет успешной.
- **Tags:** code-intelligence, oss-agent, mcp-client, extension-framework, rust, linux-foundation, prior-art

## TL;DR

Goose — Apache-2.0 OSS AI agent на Rust, поддерживает 70+ extensions через MCP, 15+ LLM providers (Anthropic, OpenAI, Google, Ollama, Azure, Bedrock, и т.д.). Изначально создан в Block, donated в Linux Foundation (Agentic AI Foundation) в ноябре 2025. **Rust-based modular architecture:** core agent loop + provider abstraction + extension system на MCP. Desktop app (macOS / Linux / Windows) + CLI + API. **Goose — early MCP driver**: ranними design decisions MCP были созданы для Goose's needs. 45.6k★ — одинаково с Aider, выше чем GitNexus / Continue.

## Key claims

- **Claim 1 — «MCP-native extension framework».** Goose built как «MCP-shaped agent» — extensions через MCP standard. Quote: «*70+ extensions via the Model Context Protocol open standard*». Это **direct evidence**, что naш ASP подход (MCP server) — правильный pattern для OSS-агентов. Goose, Cline, и (косвенно) другие — все MCP-clients.
- **Claim 2 — «Goose ranним shaped MCP design».** Quote (Arcade.dev blog): *«Goose: the open-source agent that shaped MCP»*. Это означает: MCP design — не Anthropic's solo decision, а co-evolution с early adopters. **Implication для ASP:** мы должны позиционировать ASP как natural extension MCP, не как «новый протокол». Goose может быть allied в этом — они уже знают community.
- **Claim 3 — «Donation to Linux Foundation Agentic AI Foundation».** Block donated Goose в Linux Foundation (AAIF) в ноябре 2025; Anthropic параллельно donated MCP туда же. **Это major governance precedent:** OSS agent infrastructure уже находится под neutral foundation umbrella. **Implication для ASP:** если наша спека станет успешной, AAIF — natural foundation home. Это меняет outreach strategy с «убедить authors» на «contribute to existing foundation».
- **Claim 4 — «Multi-deployment: Desktop + CLI + API».** Quote: «*Desktop app for macOS/Linux/Windows + CLI for terminal workflows + API to embed it anywhere*». Это **flexibility, которой нет у Cline** (VS Code-centric) или Aider (CLI-only). Goose — most «embeddable» из OSS-агентов.
- **Claim 5 — «15+ LLM providers».** Goose model-agnostic как Cline. Это **подтверждает наш design constraint** (ADR 0001): ASP-спека MUST be model-agnostic. Никаких Claude-specific или GPT-specific фич.

## Methodology

Goose — production OSS-продукт под governance Linux Foundation Agentic AI Foundation. **No publicly published benchmarks**, validation через user adoption + corporate backing (Block is Square / Cash App parent — multi-billion-dollar fintech). Design philosophy — **«extension > monolith»**: core agent минимальный, ценность от extensions.

Технические особенности:

- **Rust** — performance-focused choice, в контрасте с TypeScript (Cline, Continue) или Python (Aider). Implications для нашего `asp-ref` storage backend decision (если мы тоже выберем Rust для performance).
- **Modular architecture:** core agent loop / provider abstraction layer / extension system. Это **наш architectural template** для reference impl Stages.
- **MCP registry crossed 3,000 entries** в early 2026 — экосистема процветает.

## Gap (для нашего трека)

### Что Goose НЕ покрывает (но ASP не закрывает gap; Goose — это **consumer**, не **server**)

- **Goose — MCP client, не code intelligence server.** Same как Cline (см. lit-review). Не конкурент GitNexus, не альтернатива нашему `asp-ref`. **Complement.**
- **No public benchmarks** vs других агентов — adoption signal только через stars.
- **No structural code understanding в core** — relies на extensions для индексирования.
- **Linux Foundation governance** добавляет легитимность, но slow-моving. Для нашего трека (research-программа) — это плюс если мы хотим долгий impact, но барьер если нужна fast iteration.

### Где Goose стоит как design reference (а не gap)

1. **Rust-based agent** — реальное доказательство, что Rust подходит для AI-агента. Снимает аргумент «Rust сложен для AI-разработки». **Implication для нашего `asp-ref`:** Rust — реалистичный кандидат на backend language (наряду с TypeScript, Python).
2. **MCP-extension-first design** — Goose не пытается быть «всё в одном». Это **design principle для `asp-ref`**: minimal core + capabilities as opt-in extensions.
3. **Linux Foundation как home для governance** — если наша спека attain critical mass, AAIF — обвиозный choice вместо нового foundation. **Saves us governance work later.**
4. **Multi-interface (Desktop/CLI/API)** — обвиозный сценарий не только для agents, но и для serverов. `asp-ref` должен expose CLI + library + MCP server.

### Что Goose даёт нам по outreach

Saoud Rizwan (Cline) — outreach priority №1.
**Goose maintainers (AAIF)** — outreach priority №2. Это **organizational target** (фонд), а не solo creator — outreach стратегия отличается.

## Open questions

- **Q1: Кто сейчас leads Goose в AAIF после donation?** Block contributors остались? Появились ли новые governance members? Это влияет на **кто принимает PR-ы**.
- **Q2: Adoption MCP внутри Goose user base — measurable?** Если 80% пользователей не настраивают extensions — Goose adoption не равно MCP adoption.
- **Q3: AAIF charter** — какие проекты они accept? Минимальный bar — какой? Если ASP станет успешной — мы хотим understand requirements заранее.
- **Q4: Goose's relationship with Cline.** Оба MCP-native, оба OSS, оба Apache 2.0. Direct competition? Coordination? Это **important context** для outreach (не хотим выглядеть как «играем одну сторону против другой»).

## Related work cited

- **Goose source:** <https://github.com/block/goose> (moved to <https://github.com/aaif/goose>?)
- **Block announcement:** <https://block.xyz/inside/block-open-source-introduces-codename-goose>.
- **Arcade.dev «The open-source agent that shaped MCP»:** <https://www.arcade.dev/blog/goose-the-open-source-agent-that-shaped-mcp/>.
- **MCP spec** (уже в lit-review) — Goose был early co-designer.
- **Cline** (уже в lit-review) — параллельный OSS MCP-native agent.

## Личные заметки

### Что зацепило

- **Goose donated to Linux Foundation** — это серьёзный governance signal. AI agent infrastructure становится **neutral commons**, не corporate moat. Это **good news для нашей RFC-спеки** — институциональная среда есть.
- **Rust + MCP combination.** Если performance важна для серверов в нашей ASP-ecosystem, Rust — реалистичный choice. Goose доказывает это в production.
- **45.6k★ at 1 year** — explosive growth, validates OSS-agent thesis.
- **«Shaped MCP» history.** Goose — co-designer MCP. **Их feedback на ASP — high signal.**

### С чем не согласен

- **Multi-deployment может растягивать focus.** Goose делает Desktop + CLI + API + extensions. Это **рискует «всё для всех, ничего для кого-то конкретно»**. Для нашего ASP `asp-ref` — лучше fokused на one deployment в Stage 2a (MCP server), затем расширяться.

### Идеи

1. **Outreach target №2** после Cline. AAIF — institutional target.
2. **Rust как kандидат языка** для `asp-ref` — validate-d Goose-ом.
3. **«ASP shaped MCP-v2»** — если в спеке заходить далеко, мы фактически расширяем MCP. Goose может стать ally в этом, поскольку они уже have «shaped MCP» track record.

### Cross-references

- **ADR 0001:** Goose validates MCP-inherited transport choice.
- **ADR 0002:** Goose (через AAIF) — outreach target №2 после Cline.
- **ADR 0003:** Rust — реалистичный backend choice (был «один из 4», теперь validate-d).
- **Cline lit-review:** Goose ≈ Cline в подходе (MCP-native, OSS, Apache 2.0), но Rust-based и AAIF-governed.
- **ADR 0004 (hierarchical tags):** Goose extensions могут реализовать tags, но core их не диктует. Same pattern что мы выбрали.
