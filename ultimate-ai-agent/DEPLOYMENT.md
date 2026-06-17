# Ultimate AI Agent — 公開デプロイガイド

仕入れシミュレーター 2 ページ（銀行評価額 + 住宅ローン）を社外公開するための手順。

---

## 公開モードの仕組み

`PUBLIC_MODE=true` で起動すると：

- **サーバ**: OpenAI を使うエンドポイント（Chat / Image / Workflow 等）を全て 403 で遮断
- **クライアント**: ナビから AI Tools / Agents / Automation / Data セクションを非表示
- **ルーティング**: `/loan-simulator` / `/bank-valuation` / `/deal-history` / `/settings` 以外は強制リダイレクト
- **Rate Limiting**: 1 IP あたり 60 リクエスト/分（tRPC 全 API）

→ OpenAI API キーは不要、API spam リスクなし。

---

## Railway での公開（推奨）

### 前提

- GitHub アカウントで `hasegawa212/-` リポジトリにアクセス可能
- Railway アカウント（https://railway.app）

### 手順

#### 1. Railway で新規プロジェクト作成

1. https://railway.app/new → **Deploy from GitHub repo**
2. `hasegawa212/-` を選択
3. Service が作成される

#### 2. ルートディレクトリ指定

`Settings → Service → Root Directory` を `ultimate-ai-agent` に設定。

Railway は `railway.json` を読み、`Dockerfile` を使ってビルドする。

#### 3. 環境変数を設定

`Settings → Variables` で以下を追加：

| Key | Value | 必須 |
| --- | --- | --- |
| `ADMIN_USERNAME` | 任意の管理者名 | ★ |
| `ADMIN_PASSWORD` | 強いパスワード（16 文字以上推奨） | ★ |
| `PUBLIC_MODE` | `true` | ★ |
| `VITE_PUBLIC_MODE` | `true` | ★ |
| `NODE_ENV` | `production` | ★ |
| `PORT` | `3000` | |
| `DATABASE_URL` | `/app/data/app.db` | |

#### 4. 永続ボリュームを追加

`Settings → Volumes` で：
- Mount Path: `/app/data`
- Size: 1 GB（無料枠）

→ SQLite データベース（案件履歴・実績校正データ）が再デプロイで消えなくなる。

#### 5. デプロイ

`Deployments → Trigger Deploy` または GitHub push で自動ビルド開始。
ビルド完了後、Settings → Domains で `https://◯◯◯.up.railway.app` のような公開 URL が発行される。

#### 6. 動作確認

1. 公開 URL にアクセス → ログイン画面が表示
2. ADMIN_USERNAME / ADMIN_PASSWORD でログイン
3. 自動で `/loan-simulator` にリダイレクト
4. ナビには「仕入れ業務」セクションのみ表示されることを確認

---

## Render での公開

### 手順

1. https://render.com で **New Web Service** → GitHub 連携
2. リポジトリ `hasegawa212/-` を選択
3. Root Directory: `ultimate-ai-agent`
4. Runtime: **Docker**（Dockerfile 自動検出）
5. 環境変数を上記表と同じ内容で設定
6. Disk を追加: Mount Path `/app/data`、Size 1 GB
7. Deploy

---

## デプロイ後の運用

### ID/PW の社外関係者への共有

- ID/PW は **個別のチャネル**（暗号化メール / 1Password 等）で共有
- 共有相手ごとに ID を分けたい場合は、複数 ID を環境変数で持つには本格的認証実装が必要（DB ユーザーテーブル + パスワードハッシュ）

### 監視

- Railway / Render のダッシュボードで **CPU / メモリ / リクエスト数**を定期確認
- `429 Too Many Requests` が頻発する場合は Rate Limit 上限を調整
- データベースバックアップは Railway の Volume バックアップ機能を有効化

### スケールアップ

- 利用者が増えたら：
  - Railway: Service Plan を Hobby → Pro に
  - Render: Free → Standard に
- DB を SQLite から Postgres に移行（Drizzle 対応済み、コード変更小）

---

## 完全機能版（社内利用）に戻す

`PUBLIC_MODE=false` / `VITE_PUBLIC_MODE=false` に変更し、`OPENAI_API_KEY` を設定して再デプロイ。
全機能（Chat / Workflow / Agents 等）が有効化される。

---

## 既知の制限

- 認証は環境変数固定の 1 ID 方式（DB ベース複数ユーザー未対応）
- パスワード忘れ時のリセット機能なし（環境変数の値を再設定）
- API は IP ベースの Rate Limit（プロキシ環境では `X-Forwarded-For` を信頼）
- 公開モードでは Chat / Image / Code Generator 等が完全に動作しない（仕様）

---

## トラブルシューティング

### ログインできない

- 環境変数 `ADMIN_USERNAME` / `ADMIN_PASSWORD` が正しく設定されているか
- `NODE_ENV=production` 時は **環境変数必須**（未設定だと全ログイン拒否）
- サーバログに `[Auth]` の警告が出ていないか

### `/loan-simulator` が表示されない

- `VITE_PUBLIC_MODE=true` が Vite **ビルド時** に設定されていたか確認（ビルド後の変更は反映されない）
- Railway / Render は変数追加後に再ビルドが必要

### 429 Too Many Requests

- Rate Limit に達した。1 分待って再試行
- 上限を上げたい場合は `server/index.ts` の `RATE_LIMIT_MAX` を編集

---

## 関連ドキュメント

- [CLAUDE.md](./CLAUDE.md) — プロジェクト全体
- [.env.example](./.env.example) — 環境変数テンプレ
- [Dockerfile](./Dockerfile) — コンテナビルド
- [docker-compose.yml](./docker-compose.yml) — ローカル Docker
