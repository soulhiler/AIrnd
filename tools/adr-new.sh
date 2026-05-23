#!/usr/bin/env bash
# Создать новую ADR с автонумерацией.
# Использование: tools/adr-new.sh <track-dir> <title>

set -euo pipefail

TRACK_DIR="${1:?track dir required}"
shift
TITLE="${*:?title required}"

ADR_DIR="$TRACK_DIR/decisions"
TEMPLATE="$ADR_DIR/_template.md"

if [ ! -f "$TEMPLATE" ]; then
  echo "Не найден шаблон: $TEMPLATE" >&2
  exit 1
fi

# Найти максимальный существующий номер ADR (формат NNNN-*.md, без _template)
LAST_NUM=$(find "$ADR_DIR" -maxdepth 1 -name '[0-9]*-*.md' -printf '%f\n' 2>/dev/null \
  | sed -E 's/^([0-9]+)-.*/\1/' \
  | sort -n \
  | tail -1)

if [ -z "$LAST_NUM" ]; then
  NEXT_NUM=1
else
  NEXT_NUM=$((10#$LAST_NUM + 1))
fi

NUM_PADDED=$(printf '%04d' "$NEXT_NUM")

# Slug из заголовка: lowercase, пробелы → дефисы, удалить спецсимволы
SLUG=$(echo "$TITLE" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9а-я ]+//g' \
  | sed -E 's/ +/-/g' \
  | sed -E 's/^-+|-+$//g')

FILE="$ADR_DIR/$NUM_PADDED-$SLUG.md"
TODAY="$(date +%Y-%m-%d)"

sed \
  -e "s|{{NUMBER}}|$NUM_PADDED|" \
  -e "s|{{TITLE}}|$TITLE|" \
  -e "s|{{DATE}}|$TODAY|" \
  "$TEMPLATE" > "$FILE"

echo "Создана ADR: $FILE"
