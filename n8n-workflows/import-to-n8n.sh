#!/usr/bin/env bash
# n8nワークフローを一括インポートするヘルパー
# 使い方:  bash n8n-workflows/import-to-n8n.sh '<n8n APIキー>'
# 任意で第2引数に n8n のベースURL（既定: martial-arts-ghd）
set -u
KEY="${1:-}"
BASE="${2:-https://martial-arts-ghd.app.n8n.cloud}/api/v1"
DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "$KEY" ]; then
  echo "APIキーを渡してください:  bash n8n-workflows/import-to-n8n.sh 'キー'"
  exit 1
fi

for f in gmail-inquiry-to-reaction-sheet bookrun-zoom-to-reaction-sheet slack-status-to-reaction-sheet; do
  python3 -c "import json;d=json.load(open('$DIR/$f.json'));open('/tmp/n8nbody.json','w').write(json.dumps({'name':d['name'],'nodes':d['nodes'],'connections':d['connections'],'settings':d.get('settings',{})}))"
  echo "--- $f ---"
  curl -s -X POST "$BASE/workflows" \
    -H "X-N8N-API-KEY: $KEY" \
    -H "Content-Type: application/json" \
    --data @/tmp/n8nbody.json
  echo
done
echo "=== 完了。各行に \"id\":\"...\" が出ていれば取り込み成功です ==="
