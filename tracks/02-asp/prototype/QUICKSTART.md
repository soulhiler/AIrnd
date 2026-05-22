# asp-ref Quickstart — для своих проектов

Короткая инструкция, чтобы подключить `asp-ref` к любому твоему репо и
начать пользоваться через 5 минут. Один раз собрал — потом подключаешь
к скольким хочешь проектам.

## 1. Собрать сервер (один раз)

```bash
git clone https://github.com/soulhiler/AIrnd.git ~/asp-ref-build
cd ~/asp-ref-build/tracks/02-asp/prototype
npm install        # ~10 сек
npm run build      # ~3 сек
npm test           # ~2 сек, 43 теста должны быть зелёные
```

Готовый сервер живёт в `~/asp-ref-build/tracks/02-asp/prototype/dist/server.js`.
Запоминаем этот путь — будем в каждом проекте на него ссылаться.

## 2. Подключить к твоему проекту

В корне любого твоего репо создай `.mcp.json` (или дополни существующий):

```json
{
  "mcpServers": {
    "asp-ref": {
      "command": "node",
      "args": ["/home/user/asp-ref-build/tracks/02-asp/prototype/dist/server.js"]
    }
  }
}
```

Замени путь на свой абсолютный (тот, что вышел в шаге 1).

Перезапусти Claude Code (или Cline / любой MCP-совместимый агент) в
этом проекте. В логах увидишь:

```text
[asp-ref] Index empty; starting background scan...
[asp-ref] Initial scan complete: N files, M symbols, X ms.
```

Индекс лежит в `.asp/index.db` в корне твоего репо. Добавь `.asp/` в
`.gitignore`, чтобы он не попадал в git.

## 3. Проверить что всё ок

```bash
cd ~/asp-ref-build/tracks/02-asp/prototype
./scripts/smoke-test.sh /путь/к/твоему/проекту
```

Должно быть 6 зелёных OK и `✓ asp-ref smoke test PASSED`.

## 4. Что попросить агента прямо сейчас

В чате с Claude Code / Cline в твоём проекте — попробуй такие запросы.
Агент сам подберёт правильный `asp_*` tool:

- **«Покажи все мои тесты»** → агент вызовет `asp_findByTag` с
  `tag: "tests"` (или похожим путём).
- **«Где у меня настройки базы?»** → `asp_searchFiles` или
  `asp_retrieve mode=hybrid`.
- **«Что сломается, если я изменю функцию X?»** → `asp_impact` найдёт
  всё, что её вызывает (BFS по графу, до 3 уровней).
- **«Дай контекст символа Y»** → `asp_context` вернёт сам символ,
  родителя и детей.

Если агент не цепляет наши tools — открой свой запрос с явным указанием:
*«используй asp_findByTag для ...»*.

## 4.1. Безопасность (важно прочитать!)

После hardening pass v0.1.1:

- **Деструктивные операции (`asp_writeFile`, `asp_applyPatch`)
  выключены по умолчанию.** Запросы вернут ошибку
  `MutationsDisabledError`. Если хочешь дать агенту право писать —
  добавь в `env`:

  ```json
  "env": { "ASP_ENABLE_MUTATIONS": "1" }
  ```

  Рекомендация: **не включай**, пока не убедишься, что твой агент не
  auto-approve'ит destructive calls.

- **Секреты не читаются и не индексируются.** Файлы `.env`, `*.pem`,
  `*.key`, `id_rsa`, `credentials.json`, и пр. блокируются на server
  side — даже если агент попросит прочитать.

- **Symlink escape блокируется.** Если в твоём репо есть симлинки,
  указывающие наружу, сервер откажет в чтении/записи через них.

- **`.asp/` добавляется в `.gitignore` автоматически** при первом
  запуске (если репо — git-репо). Чтобы отключить:
  `"env": { "ASP_SKIP_GITIGNORE": "1" }`.

- **`npm audit`** показывает 4 transitive vulnerabilities через
  `@xenova/transformers → onnxruntime-web → protobufjs`. CVE
  направление — DoS через malformed protobuf. В нашем сценарии
  (локальный сервер, доверенный HF cache, эмбеддинги off by default)
  риск низкий. Подробнее в [INTEGRATION.md](INTEGRATION.md#security).

## 5. Включить семантический поиск (опционально)

По умолчанию работает только поиск по словам (FTS5). Чтобы добавить
поиск по смыслу (vector embeddings):

```json
{
  "mcpServers": {
    "asp-ref": {
      "command": "node",
      "args": ["/полный/путь/dist/server.js"],
      "env": {
        "ASP_ENABLE_EMBEDDINGS": "1"
      }
    }
  }
}
```

Первый запуск **скачает модель** (~22 MB) из Hugging Face — нужен
интернет один раз. Дальше офлайн.

После этого `asp_retrieve query="..." mode="vector"` найдёт куски по
смыслу, не по буквам.

## 6. Включить LLM-переранжирование (опционально, платно)

Если у тебя есть Anthropic API ключ — добавь в env:

```json
{
  "ASP_ENABLE_EMBEDDINGS": "1",
  "ASP_RERANK_PROVIDER": "anthropic",
  "ANTHROPIC_API_KEY": "sk-ant-...",
  "ASP_RERANK_MODEL": "claude-haiku-4-5-20251001"
}
```

Тогда `asp_retrieve rerank=true` делает реальный LLM-вызов для
переупорядочивания топ-кандидатов. Стоимость: ~$0.001–0.01 за вызов
на Haiku.

## 7. Куда смотреть, если что-то сломалось

| Симптом | Что делать |
|---|---|
| Агент не видит tools | Проверь, что путь в `.mcp.json` абсолютный и файл существует. Перезапусти агент. |
| `Index empty` висит дольше минуты | `npm run build` не запускался, проверь `dist/server.js`. |
| `asp_searchFiles` возвращает пусто | Скан ещё идёт — дождись или вызови `asp_refresh wait=true`. |
| `degradation: ["partial-index"]` | То же — фоновый скан не закончился. |
| `Index schema version mismatch` | Удали `.asp/` в твоём репо, индекс пересоберётся. |
| Какой-то язык не индексируется | Поддерживаются: py, ts/tsx, js, rs, go, java, cs, rb, sh, c/h, cpp. Другие пока пропускаются. |

Сервер пишет логи в stderr. Чтобы посмотреть:

```bash
node ~/asp-ref-build/tracks/02-asp/prototype/dist/server.js /path/to/repo 2> /tmp/asp.log
# В другом терминале:
tail -f /tmp/asp.log
```

## 8. Обновить сервер

```bash
cd ~/asp-ref-build
git pull
cd tracks/02-asp/prototype
npm install     # если зависимости изменились
npm run build
```

После обновления **удали `.asp/`** в каждом твоём проекте, если в
сервере были изменения схемы (см. сообщение `schema version mismatch`).
Иначе ничего удалять не надо — индекс совместим.

## Подключение к нескольким проектам одновременно

Одна сборка `asp-ref` обслуживает **сколько хочешь** репозиториев. Просто
в каждом проекте — свой `.mcp.json` с одинаковой ссылкой на тот же
`dist/server.js`. У каждого проекта будет свой `.asp/index.db` в корне,
сервер запускается отдельно на каждую сессию агента.

## Что писать, если что-то странное

Issue: <https://github.com/soulhiler/AIrnd/issues>

В issue полезно приложить:

- Размер репо (примерно файлов / строк).
- Какой агент (Claude Code / Cline / etc.).
- Stderr-лог сервера (`2> /tmp/asp.log`).
- `asp_capabilities` output — что сервер заявляет.

---

Подробная инструкция со всеми деталями: [`INTEGRATION.md`](INTEGRATION.md).
Концептуальное обоснование, зачем это всё:
[`../deliverables/article-for-engineers.md`](../deliverables/article-for-engineers.md).
