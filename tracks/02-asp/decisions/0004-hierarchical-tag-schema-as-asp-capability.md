# 0004. Hierarchical tag schema as ASP capability

- **Дата:** 2026-05-21
- **Статус:** accepted
- **Связанные ADR:** [0001](0001-mcp-extension-vs-new-protocol.md), [0002](0002-asp-scope-opensource-agent-ecosystem-only.md), [0003](0003-reference-implementation-cleanroom-build-with-gitnexus-parity-5-fixes.md)
- **Связанная идея:** [001 hierarchical tags](../ideas/001-hierarchical-tags.md) (статус: promoted-to-ADR этим решением)

## Простыми словами

В наш стандарт ASP добавляем **обязательную возможность** — поиск кода и документов по **меткам в виде дорожек** (как папки: `tests/unit/auth`, `feature/login`). Сервер, который называет себя «ASP-совместимым», обязан понимать: если запрос про `tests`, то надо вернуть всё под `tests/...`. Это сильно улучшает точность поиска для AI-помощника — он сможет находить **конкретные секции внутри файлов**, а не только сами файлы.

Откуда сервер берёт эти метки — мы **не диктуем**: можно автоматически из путей файлов (как наш toy-эксперимент), можно вручную в комментариях, можно через AI. Мы только определяем формат и поведение поиска.

## Context

После dogfooding GitNexus, литобзора (Aider, Continue.dev) и mini prior-art search появился чёткий gap в существующих code intelligence стандартах:

- **SCIP** (Sourcegraph) — только плоский `Kind` enum (Class, Function, Method, ...) + плоский `SymbolRole` bitset (Definition, Import, Test, ...). **Нет categorical hierarchy.**
- **LSP** — `SymbolKind` тоже плоский (enum 1-26: File, Module, Namespace, Package, Class, ...).
- **Aider RepoMap, Continue.dev** — не используют tags вообще, делают ranking без structural categorization.
- **GitNexus** — есть typed edges (CALLS, REFERENCES), но они о relationship type, не о categorical taxonomy символов.

**Единственная prior art с hierarchical taxonomy для кода — Semgrep** (`<language>/<framework>/<category>/$MORE`), но **scope** у них узкий: только security/correctness rules, не все символы кодобазы.

Academic foundation существует (Hearst et al., CHI 2002, «Hierarchical Faceted Metadata in Site Search Interfaces») — 24-летняя established theory с positive empirical evidence в library catalogs, scientific archives. **К code intelligence напрямую не применялась.**

Toy implementation (см. [`../ideas/001-toy/`](../ideas/001-toy/)) на нашем AIrnd-репо подтвердил viability:

- Path-based tag generation тривиальна (~8 строк Python).
- Markdown headings извлекаются как secondary tags чисто.
- На запросах вида «найди все секции X» (cross-document) hierarchical tags дают **точную локализацию** (file#section) там, где `grep -rl` даёт только файлы + ложные совпадения.

Решение фиксировать hierarchical tags **сейчас**, до закрытия литобзора, обосновано тем, что:

1. Prior art search показал явный gap в существующих стандартах — низкий риск reinventing.
2. Toy implementation работает на наших данных — directional evidence уже есть.
3. Этот capability фундаментален для дизайна остальных operations (retrieval, filtering) — без него мы будем переделывать.
4. ADR consciously принимается **before formal precision@10 measurement** — это записано в Negative consequences как принимаемый риск.

## Decision

**ASP-спецификация включает иерархические теги как обязательную capability.** Конкретно:

### 1. Symbol structure (схема)

Каждый ASP symbol имеет необязательное поле `tags`:

```jsonc
{
  "symbol": "tracks/02-asp/lit-review/foo.md#Section Name",
  "kind": "section",
  "tags": [
    "tracks",
    "tracks/02-asp",
    "tracks/02-asp/lit-review",
    "heading/level-2",
    "section/Parent Heading"
  ]
}
```

**Формат тега:** строка из ASCII-сегментов, разделённых `/`. Регулярное выражение: `^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$`. Юникод-сегменты разрешены, но не required для compliance (см. open question в follow-ups).

### 2. Capability negotiation

Сервер в `capabilities` объявляет:

```jsonc
{
  "tagSchema": "hierarchical",   // or "flat" or "none"
  "tagSources": ["path", "markdown-headings"]  // server-choice какие источники
}
```

- `"hierarchical"` — сервер поддерживает префиксный поиск (запрос `tracks` находит `tracks/02-asp`).
- `"flat"` — сервер поддерживает теги, но без иерархического префиксного семантика (exact match only).
- `"none"` — сервер не предоставляет теги вообще.

### 3. Search operation

ASP включает operation `asp/findByTag`:

```jsonc
{
  "method": "asp/findByTag",
  "params": {
    "tag": "tracks/02-asp",
    "hierarchical": true,    // default true; false = exact match
    "kind": "file",          // optional filter by symbol kind
    "limit": 100             // optional, default depends on tokenBudget
  }
}
```

Возвращает массив symbols (с полем `tags`), отфильтрованных по правилам:

- `hierarchical: true` → возвращает symbols, у которых **любой** тег начинается с `params.tag + "/"` или равен `params.tag`.
- `hierarchical: false` → возвращает symbols, у которых **любой** тег точно равен `params.tag`.

### 4. Source-agnostic policy

ASP **не диктует**, как сервер получает теги. Допустимые подходы (server-choice):

- **Path-based** (auto из путей файлов и каталогов).
- **Manual** (annotations в frontmatter, комментариях, отдельных конфигах).
- **Convention-based** (специальные имена файлов / каталогов).
- **LLM-inferred** (модель предлагает теги).
- **Hybrid** (любая комбинация).

Сервер advertise источники через `capabilities.tagSources` (informational, не enforced).

### 5. Reserved namespaces

ASP-спека резервирует несколько top-level namespaces для cross-tool semantics:

- `kind/...` — для symbol kind hierarchy (`kind/callable/function`, `kind/type/class`). Опционально.
- `heading/level-N` — для markdown-headings (когда применимо).
- `section/{parent_heading}` — для structural parent.
- `lang/{language}` — для programming language tag (`lang/python`, `lang/typescript`).

Все остальные namespaces — implementation-defined.

## Consequences

### Positive

- **Заполняем явный gap** в существующих стандартах (SCIP, LSP, LSIF — нет hierarchical categories).
- **Reuse academic foundation** — Hearst et al. CHI 2002 дают 24 года накопленных принципов; не reinvent.
- **Cross-document queries become first-class.** Запрос «все «Простыми словами» секции» работает программно — toy proves это (см. `001-toy/queries.md` Q2).
- **Source-agnostic — низкий barrier to entry.** Реализатор сам выбирает, как генерирует теги; path-based работает без annotation cost.
- **Compositional с другими operations.** `asp/retrieve` может принимать `filter: {tags: ["tests/unit"]}` для фильтрации перед ranking. Tag filter + PageRank ranking + token budget — orthogonal concerns.
- **Differentiator от GitNexus** на UX-уровне: GitNexus's flat Kind не выражает «test/unit vs test/integration», нашa спека выражает.

### Negative

- **Early commitment до формального precision measurement.** Toy implementation дал directional signal, но precision@10 ≥15% (H1 из идеи 001) не измерен на ground truth dataset. **Mitigation:** формальный эксперимент остаётся в backlog (Gate 2 → 3 или 3 → 4). Если данные опровергнут гипотезу — ADR amend с reduction до optional capability.
- **Сложность спеки увеличивается.** Server implementors теперь обязаны реализовать tag-aware queries (если advertise `hierarchical`). **Mitigation:** `tagSchema: "none"` — valid escape hatch для минимальных серверов.
- **Tag source ambiguity.** Если два сервера индексируют один репо разными подходами (один path-based, другой manual), результаты будут отличаться. Это **acceptable variance** для capability negotiation, но requires документация в спеке.
- **Performance unknown на больших репо.** Toy на 25 файлах мгновенный. Performance на 10М LOC — TBD. **Mitigation:** capability `tagSchema` — opt-in; server-implementation может ограничить scope.
- **Naming bikeshedding.** `asp/findByTag` vs `asp/queryTags` vs `asp/searchByTag` — finalisation в Phase 1 спеки.

### Necessary follow-ups

- **Включить в ASP spec v0.1 sketch** (Gate 1 deliverable): описать schema + operation + capability negotiation формально через JSON Schema.
- **ADR 00NN: Reserved namespaces** — расширить список (`kind/...`, `lang/...`, `heading/...`) после полного литобзора и use cases analysis.
- **Pre-registration формального эксперимента** (после Cline / agentic-codebase / LSIF lit-review): `experiments/exp-002-hierarchical-tags-precision/PREREG.md`. Цель: измерить precision@10 на 50-100 manually labeled queries.
- **Reference implementation Stage 2b** включает реализацию `findByTag` (см. ADR 0003 stages).
- **Outreach к Semgrep** (по плану ADR 0002 outreach): описать наше positioning vs их `category/subcategory`, попросить feedback. Semgrep — natural ally, так как они уже верят в hierarchical taxonomy.

## Alternatives considered

### Alternative A: Не включать tags в ASP вообще

Оставить tagging как vendor extension; ASP-спека определяет только базовые operations (retrieve, context, impact). Отклонено: theory + toy implementation показывают, что tag-aware queries fundamentally расширяют user surface. Делать post-hoc add-on неправильно — interactions с retrieval / ranking разнообразны.

### Alternative B: Flat tags only (без иерархии)

Включить tags, но требовать exact match (как SymbolRole в SCIP). Отклонено: основной gap, который мы закрываем, — именно prefix-matching. Без него мы не добавляем ничего нового над SCIP.

### Alternative C: Dictate tag source (например, обязать path-based)

Server обязан использовать path-based tag generation. Отклонено: ограничивает innovation. Manual annotations и LLM-inferred — legitimate подходы; spec не должна их блокировать.

### Alternative D: Single-tag per symbol

Каждый symbol имеет **один** tag (как primary category), не array. Отклонено: реальные коды требуют multi-tag (один файл = test + auth + integration). Single-tag forces разработчиков делать ложные компромиссы.

## References

- **Prior art:**
  - Semgrep rule namespace: `<language>/<framework>/<category>/$MORE` ([docs](https://semgrep.dev/docs/contributing/contributing-to-semgrep-rules-repository)).
  - Hearst et al., CHI 2002, «Hierarchical Faceted Metadata in Site Search Interfaces» ([PDF](https://flamenco.berkeley.edu/papers/flamenco-shortpaper02.pdf)).
- **Lit-review:**
  - [Aider RepoMap](../lit-review/gauthier-2024-aider-repomap.md) — ranking без tags; ASP добавляет tag layer над их подходом.
  - [Continue.dev](../lit-review/continuedev-2026-codebase-indexing.md) — embeddings без structural tags; ASP добавляет complement.
  - [GitNexus](../lit-review/patwari-2026-gitnexus.md) — typed edges; ASP tags ortho gonal к их type system.
  - [LSP spec](../lit-review/microsoft-2022-lsp-spec.md) — flat SymbolKind enum (1-26).
  - [tree-sitter](../lit-review/brunsfeld-2018-tree-sitter.md) — flat tag types (name.definition.*).
- **Toy implementation:** [`../ideas/001-toy/`](../ideas/001-toy/) — proof of concept на AIrnd-репо.
- **Идея 001:** [`../ideas/001-hierarchical-tags.md`](../ideas/001-hierarchical-tags.md) — статус promoted-to-ADR этим решением.
- **SCIP schema:** <https://github.com/sourcegraph/scip/blob/main/scip.proto> — нет hierarchical categories, gap который мы закрываем.
