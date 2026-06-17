#!/usr/bin/env bash
# gas-deploy.sh — clasp を使って GAS コードの push + デプロイ + CSV インポートを全自動で行う
#
# Usage:
#   ./scripts/gas-deploy.sh           # 初回セットアップ＆デプロイ
#   ./scripts/gas-deploy.sh --push    # コード更新のみ（再デプロイなし）
#   ./scripts/gas-deploy.sh --import  # CSV インポートのみ
#   ./scripts/gas-deploy.sh --all     # push + deploy + import（デフォルト）
#
# 前提:
#   - Node.js (npm) がインストール済み
#   - Google アカウントでログイン可能なブラウザ

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GAS_DIR="$REPO_ROOT/gas"
CLASP_FILE="$GAS_DIR/.clasp.json"

MODE="${1:---all}"

# ---------------------------------------------------------------------------
# 色付き出力
# ---------------------------------------------------------------------------
info()  { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
ok()    { printf '\033[1;32m[OK]\033[0m    %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*"; }
err()   { printf '\033[1;31m[ERR]\033[0m   %s\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# 1. clasp インストール確認
# ---------------------------------------------------------------------------
ensure_clasp() {
  if command -v clasp >/dev/null 2>&1; then
    ok "clasp found: $(clasp --version 2>/dev/null || echo 'installed')"
    return
  fi
  info "clasp not found. Installing via npm..."
  npm install -g @google/clasp
  ok "clasp installed"
}

# ---------------------------------------------------------------------------
# 2. clasp ログイン確認
# ---------------------------------------------------------------------------
ensure_login() {
  if clasp login --status 2>&1 | grep -q "You are logged in"; then
    ok "clasp: logged in"
    return
  fi
  info "clasp login required. Opening browser..."
  clasp login
  ok "clasp: login complete"
}

# ---------------------------------------------------------------------------
# 3. プロジェクト作成 or 既存紐付け
# ---------------------------------------------------------------------------
ensure_project() {
  if [[ -f "$CLASP_FILE" ]]; then
    ok "clasp project already configured: $CLASP_FILE"
    return
  fi

  info "No .clasp.json found. Creating new GAS project..."
  cd "$GAS_DIR"

  clasp create \
    --title "テレアポ管理シート" \
    --type webapp \
    --rootDir "$GAS_DIR"

  if [[ -f "$GAS_DIR/.clasp.json" ]]; then
    ok "GAS project created"
  else
    err "Failed to create project"
    exit 1
  fi
  cd "$REPO_ROOT"
}

# ---------------------------------------------------------------------------
# 4. コード push
# ---------------------------------------------------------------------------
do_push() {
  info "Pushing code to GAS..."
  cd "$GAS_DIR"
  clasp push --force
  ok "Code pushed"
  cd "$REPO_ROOT"
}

# ---------------------------------------------------------------------------
# 5. デプロイ (Web App)
# ---------------------------------------------------------------------------
do_deploy() {
  info "Deploying as Web App..."
  cd "$GAS_DIR"

  DEPLOY_OUTPUT="$(clasp deploy --description "auto-deploy $(date +%Y%m%d-%H%M%S)" 2>&1)"
  echo "$DEPLOY_OUTPUT"

  DEPLOY_ID="$(echo "$DEPLOY_OUTPUT" | grep -oP '(?<=- )AKfycb[A-Za-z0-9_-]+')" || true
  if [[ -n "$DEPLOY_ID" ]]; then
    EXEC_URL="https://script.google.com/macros/s/$DEPLOY_ID/exec"
    ok "Deployed: $EXEC_URL"

    # gas-call.sh のデフォルト URL を更新
    sed -i "s|^DEFAULT_URL=.*|DEFAULT_URL=\"$EXEC_URL\"|" "$SCRIPT_DIR/gas-call.sh"
    ok "Updated DEFAULT_URL in gas-call.sh"
  else
    warn "Could not parse deploy ID. Check output above."
  fi

  cd "$REPO_ROOT"
}

# ---------------------------------------------------------------------------
# 6. CSV インポート
# ---------------------------------------------------------------------------
do_import() {
  info "Importing CSV data..."
  "$SCRIPT_DIR/gas-import.sh"
}

# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------
main() {
  info "=== GAS Auto Deploy ==="
  ensure_clasp
  ensure_login
  ensure_project

  case "$MODE" in
    --push)
      do_push
      ;;
    --import)
      do_import
      ;;
    --all|*)
      do_push
      do_deploy
      do_import
      ;;
  esac

  ok "=== Done ==="
}

main
