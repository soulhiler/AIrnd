# 0007. Storage backend Stage 2a — SQLite with FTS5

- **Дата:** 2026-05-21
- **Статус:** accepted
- **Связанные ADR:** [0003](0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md), [0006](0006-reference-implementation-language-typescript.md)
- **Scope:** только Stage 2a (MVP-alpha). Stage 2b и 2c могут требовать дополнительных backends — отдельные ADR.

## Простыми словами

Нашему серверу нужно где-то хранить **индекс** (карту всех файлов, символов и связей). Из вариантов рассмотрели четыре:

1. **SQLite** — обычная встроенная база, есть в любом Node.js.
2. **LanceDB** — специальная база для «числовых отпечатков» текста (как у Continue.dev).
3. **Kùzu** — современная база для графов (карта связей класс→метод→вызов).
4. **DuckDB** — аналитическая база.

Для **первой версии** (Stage 2a, минимальный рабочий прототип) выбираем **SQLite**. Причины:

1. **Уже есть везде.** Node.js + npm-пакет `better-sqlite3` — установка в одну строку. Других зависимостей не нужно.
2. **Встроенный полнотекстовый поиск (FTS5).** Это **наше исправление №1**: у GitNexus FTS требует скачивания из интернета и иногда ломается. SQLite FTS5 — **офлайн, всегда работает**.
3. **Одна папка `.asp/index.db` — и всё.** Никаких отдельных сервисов, докеров, демонов.
4. **Если позже нужно — добавим LanceDB и Kùzu рядом.** SQLite не блокирует это будущее.

**Что отложили:**

- **LanceDB** — только если будем делать «семантический поиск» через числовые отпечатки. Сейчас в Stage 2a его не делаем. Решим в Stage 2b.
- **Kùzu** — для большого графа связей (impact analysis). В Stage 2a используем простые SQL JOIN'ы поверх SQLite. Решим в Stage 2c.

## Context

ADR 0003 фиксирует scope reference impl: GitNexus parity + 5 fixes, поэтапно через Stages 2a → 2b → 2c. Каждый stage требует своих storage capabilities:

- **Stage 2a (MVP-alpha):** 5 операций — `readFile`, `listFiles`, `searchFiles`, `findByTag`, `context`. Никаких embeddings; impact analysis отложен.
- **Stage 2b:** + 6 операций включая `retrieve` (с opt-in rerank). Здесь нужен vector store.
- **Stage 2c:** + impact + cypher + full parity. Здесь нужен graph store или semantic equivalent.

Кандидаты для Stage 2a storage:

| | SQLite + better-sqlite3 | LanceDB | Kùzu | DuckDB | Custom in-memory |
|---|---|---|---|---|---|
| Embedded в Node | ✅ нативный | ✅ TS bindings | ✅ TS bindings | ✅ TS bindings | ✅ trivially |
| Full-text search | ✅ FTS5 built-in | ❌ (vectors only) | ⚠️ ad-hoc | ✅ через extension | ⚠️ build it ourselves |
| Vectors | ⚠️ через extensions | ✅ native | ❌ | ⚠️ vss extension | ❌ |
| Graph | ⚠️ JOIN'ами | ❌ | ✅ native Cypher-like | ⚠️ recursive CTE | ❌ |
| Maturity | maximum (декады) | early (~2 года) | new (~3 года) | mature (~5 лет) | n/a |
| Dependency size | <5MB | ~50MB | ~20MB | ~30MB | 0 |
| Network deps | none | none | none | none | none |
| Persistent | file | file | file | file | ❌ (или write yourself) |

## Decision

**Stage 2a storage = SQLite через `better-sqlite3` package, с FTS5 для keyword search.**

Конкретно:

1. **Package:** `better-sqlite3` (sync API, fast, mature). Альтернатива `node:sqlite` (Node 22+ built-in) — рассмотреть когда требование Node 22 acceptable.
2. **Schema** для Stage 2a (minimal):
   - `symbols(id PRIMARY KEY, scheme, path, anchor, kind, parent_id, line, end_line, token_size, snippet)`
   - `tags(symbol_id, tag)` — индекс по `(tag, symbol_id)` для prefix matching.
   - `symbols_fts` — FTS5 virtual table on `symbols.snippet` для `searchFiles`.
3. **Hierarchical tag queries:** SQL `LIKE 'tag/%'` или GLOB pattern. Performance acceptable до 100k symbols; если станет bottleneck — denormalize в materialized closure table.
4. **Location:** `.asp/index.db` в repo root (igniored by `.gitignore`).
5. **Cache invalidation:** mtime per file column; refresh re-checks mtimes.
6. **Не делаем сейчас:** embeddings storage (vss extension рассмотреть в Stage 2b), graph queries (recursive CTE — в Stage 2c или migrate to Kùzu).

## Consequences

### Positive

- **Простота setup.** `npm install better-sqlite3` — и всё. Никаких daemons, никаких внешних services.
- **FTS5 решает наш fix #1** offline-first FTS. У GitNexus extension downloads из external server (см. dogfooding lit-review); у нас встроено.
- **Maturity.** SQLite в production decades — debugging, tooling, community sutil.
- **Footprint.** ~5MB native module vs ~50MB LanceDB. Lower bar для users.
- **Не блокирует будущее.** Можем добавить LanceDB / Kùzu **рядом** в Stage 2b/2c как дополнительные backends — capability negotiation определит, какие операции поддерживаются.
- **Transactional.** Atomic refresh — single transaction commit/rollback.
- **Backup-friendly.** Single file = easy backup, easy delete, easy reproducible bug reports.

### Negative

- **Не оптимально для vector retrieval.** В Stage 2b нам потребуется vector store. SQLite vss extension — option, но not as performant as LanceDB. Mitigation: добавить LanceDB **рядом** для embedding-heavy operations, оставляя SQLite для symbol metadata + FTS.
- **Graph queries через recursive CTE — verbose.** Для impact analysis (Stage 2c) writing JOIN-based graph traversal в SQL — painful. Mitigation: migrate to Kùzu в Stage 2c, или materialize closure table.
- **Write contention для concurrent agents.** SQLite single-writer model — если два agent параллельно refresh — один блокируется. Mitigation: для Stage 2a — acceptable (single user); revisit для multi-user в Stage 2c.
- **No native vector ops.** Если эксперимент с embeddings нужен в Stage 2a — придётся либо добавить extension, либо использовать отдельный store.

### Necessary follow-ups

- **`prototype/` setup:** package.json + tsconfig.json с зависимостями. **Не начинаем код до Phase 1 закрытия.**
- **ADR 0009 (потенциально):** в Stage 2b — vector storage choice (LanceDB vs sqlite-vss vs другое). Решается после profile Stage 2a + use case в Stage 2b.
- **ADR 0010 (потенциально):** в Stage 2c — graph storage choice (sticking with SQLite recursive CTE vs migrate to Kùzu).
- **Spec capability:** добавить в Section 5.2 capability `storage` (informational, не нормативный) для server backend advertisement (`sqlite`, `lancedb`, `kuzu`, `custom`).

## Alternatives considered

### Alternative A: LanceDB-only из коробки

Использовать LanceDB как primary storage с самого начала, get vectors готовы для Stage 2b.

Pros: Не migration в Stage 2b. Production-grade vector DB.

Cons:

- **LanceDB не optimal для symbol metadata.** Designed для vector workloads, не general-purpose SQL.
- **No built-in FTS5.** Keyword search через external index (sqlite или ripgrep) — splitting concerns.
- **50MB dependency** для Stage 2a где мы embeddings не делаем — overkill.

Отклонено: premature optimization для Stage 2a.

### Alternative B: Kùzu из коробки

Cypher-style graph queries native. Нужно для impact analysis всё равно.

Pros: Готово для Stage 2c graph queries. Native typed edges.

Cons:

- **Younger** (released ~2023). Less production hardening.
- **TS bindings less mature** than better-sqlite3.
- **No FTS5 equivalent.** Keyword search — separate index.
- **Не optimal для simple metadata queries** в Stage 2a.

Отклонено: premature optimization. Может revisit в Stage 2c.

### Alternative C: Custom in-memory (NetworkX-style)

Как Aider's RepoMap — in-memory graph через NetworkX-equivalent (TS port или custom).

Pros: Fastest для small repos. Zero dependencies.

Cons:

- **No persistence.** Cold-start full re-index каждый раз. На 10k+ файлов — пара minutes per start.
- **Memory pressure.** На больших repos — OOM.
- **No FTS5.** Build keyword search ourselves.

Отклонено: persistence — must-have.

### Alternative D: DuckDB

Modern analytics SQL DB. Supports vectors via extension.

Pros: SQL syntax — universal. Good analytics performance.

Cons:

- **Less common.** Smaller TS / Node ecosystem.
- **FTS5 equivalent — via extension.** Не built-in.
- **No big advantage over SQLite** для наш workload (we're not doing OLAP, мы doing point queries).

Отклонено: no compelling reason поверх SQLite.

## References

- **`better-sqlite3` package:** <https://github.com/WiseLibs/better-sqlite3>.
- **SQLite FTS5 docs:** <https://www.sqlite.org/fts5.html>.
- **LanceDB TS bindings:** <https://github.com/lancedb/lancedb> (alternative for Stage 2b).
- **Kùzu TS bindings:** <https://github.com/kuzudb/kuzu> (alternative for Stage 2c).
- **ADR 0003** (reference impl Stages).
- **ADR 0006** (language: TypeScript).
- **Continue.dev lit-review** — uses LanceDB; reference для Stage 2b.
- **GitNexus lit-review** — uses LadybugDB (graph); reference для Stage 2c.
- **Aider RepoMap lit-review** — in-memory NetworkX; reference для in-memory option.
