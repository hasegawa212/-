# admin-dashboard — 管理ダッシュボード

`App.tsx` をルートとした、独立した管理画面アプリです。Vite + React + TypeScript +
Tailwind CSS + shadcn 風 UI（sonner / tooltip）で構成されています。バックエンドは持たず、
表示データはモック（ダミー）です。

## 技術スタック

- **ビルド/開発**: Vite 5
- **UI**: React 18 + TypeScript（strict）
- **ルーティング**: [wouter](https://github.com/molefrog/wouter)
- **スタイル**: Tailwind CSS（CSS 変数によるライト/ダークテーマ）
- **通知トースト**: [sonner](https://sonner.emilkowal.ski/)
- **ツールチップ**: Radix UI Tooltip

## セットアップ

```bash
cd admin-dashboard
npm install
npm run dev      # http://localhost:5174
```

その他のコマンド:

- `npm run build` — 本番ビルド（`dist/` を生成）
- `npm run preview` — ビルド結果をプレビュー
- `npm run typecheck` — `tsc --noEmit` で型チェック

## ログイン（デモ）

簡易認証はクライアント側のみで完結します（`src/contexts/AdminAuthContext.tsx`）。

- メールアドレス: `admin@example.com`
- パスワード: `admin`

> ⚠️ これはデモ用の実装です。実運用ではサーバー側の認証に置き換えてください。

## ディレクトリ構成

```
src/
├── App.tsx                     # アプリのルート（ErrorBoundary → Theme → AdminAuth → Tooltip → Router）
├── main.tsx                    # エントリポイント
├── index.css                   # Tailwind + テーマ用 CSS 変数
├── components/
│   ├── ErrorBoundary.tsx       # 描画エラーのフォールバック
│   └── ui/                     # sonner / tooltip / button / card
├── contexts/
│   ├── ThemeContext.tsx        # light / dark / system テーマ
│   └── AdminAuthContext.tsx    # 簡易ログイン状態
├── lib/utils.ts                # cn() / formatCurrency()
└── pages/
    ├── Dashboard.tsx           # ログインゲート + KPI ダッシュボード
    └── NotFound.tsx            # 404 ページ
```

## カスタマイズのヒント

- **テーマ初期値**: `App.tsx` の `<ThemeProvider defaultTheme="light">` を変更。
- **ルート追加**: `App.tsx` の `Router` 内に `<Route path="/xxx" component={...} />` を追加。
- **KPI / アクティビティ**: `src/pages/Dashboard.tsx` 上部の `KPIS` / `ACTIVITIES` を編集。
  実データに接続する場合はここを API 呼び出しに置き換えてください。
- **配色**: `src/index.css` の CSS 変数（`--primary` など）と
  `tailwind.config.js` の `colors` を合わせて編集します。
