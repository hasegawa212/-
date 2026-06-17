#!/usr/bin/env bash
# gas-import.sh — テレアポ管理シート.csv を GAS Web App に一括投入
#
# Usage:
#   ./scripts/gas-import.sh [csv_file]
#
# csv_file を省略すると リポジトリルートの テレアポ管理シート.csv を使用。
# GAS exec URL は $GAS_URL または gas-call.sh 内のデフォルトを使う。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CSV_FILE="${1:-$REPO_ROOT/テレアポ管理シート.csv}"

if [[ ! -f "$CSV_FILE" ]]; then
  echo "Error: CSV file not found: $CSV_FILE" >&2
  exit 1
fi

echo "Reading: $CSV_FILE"

# CSV をパースして JSON records 配列を構築
# Python が使えればそちらを使い、なければ jq + awk で対応
if command -v python3 >/dev/null 2>&1; then
  PAYLOAD="$(python3 -c "
import csv, json, sys

with open(sys.argv[1], encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    records = [dict(row) for row in reader]

payload = {'action': 'bulkAdd', 'records': records}
print(json.dumps(payload, ensure_ascii=False))
" "$CSV_FILE")"
elif command -v python >/dev/null 2>&1; then
  PAYLOAD="$(python -c "
import csv, json, sys

with open(sys.argv[1], encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    records = [dict(row) for row in reader]

payload = {'action': 'bulkAdd', 'records': records}
print(json.dumps(payload, ensure_ascii=False))
" "$CSV_FILE")"
else
  echo "Error: python3 is required for CSV parsing" >&2
  exit 1
fi

RECORD_COUNT="$(echo "$PAYLOAD" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['records']))")"
echo "Parsed $RECORD_COUNT records from CSV"
echo "Sending bulkAdd to GAS Web App..."

RESPONSE="$("$SCRIPT_DIR/gas-call.sh" -X POST -d "$PAYLOAD" --raw 2>&1)"

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"success"'; then
  echo "Import complete."
else
  echo "Import may have failed. Check the response above." >&2
  exit 1
fi
