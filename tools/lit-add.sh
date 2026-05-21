#!/usr/bin/env bash
# Создать запись литобзора из шаблона.
# Использование: tools/lit-add.sh <track-dir> <slug>

set -euo pipefail

TRACK_DIR="${1:?track dir required}"
SLUG="${2:?slug required}"

LIT_DIR="$TRACK_DIR/lit-review"
TEMPLATE="$LIT_DIR/_template.md"
FILE="$LIT_DIR/$SLUG.md"
INDEX="$LIT_DIR/INDEX.md"

if [ ! -f "$TEMPLATE" ]; then
  echo "Не найден шаблон: $TEMPLATE" >&2
  exit 1
fi

if [ -f "$FILE" ]; then
  echo "Запись уже существует: $FILE" >&2
  exit 1
fi

TODAY="$(date +%Y-%m-%d)"

sed \
  -e "s|{{TITLE}}|$SLUG|" \
  -e "s|{{AUTHORS}}||" \
  -e "s|{{YEAR}}||" \
  -e "s|{{VENUE}}||" \
  -e "s|{{LINK}}||" \
  -e "s|{{CITEKEY}}|$SLUG|" \
  -e "s|{{DATE_READ}}|$TODAY|" \
  -e "s|{{RELEVANCE}}||" \
  -e "s|{{TAGS}}||" \
  "$TEMPLATE" > "$FILE"

echo "Создана запись: $FILE"
echo "Не забудь добавить строку в $INDEX после заполнения metadata."
