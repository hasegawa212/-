# Netlify デプロイ復旧手順

## 確認した障害

- 実行: https://github.com/hasegawa212/-/actions/runs/39956070819
- ジョブ: 120422107631、コミット: `18155426d5027167db27a8c5f1e1838d89dd7502`
- 2026-10-23 21:48 JST: 型チェック、既存58テスト、ビルドは成功。
- CLI v17 の公開処理で `Error: Site not found. Please rerun "netlify link"`、終了コード1。
- 実際に使用されたサイトID: `e6431469-8bb5-4d42-8db1-c370eebd5d04`。
- トークンの存在は確認できたが、有効性やチーム権限はこのログでは判断できない。サイトIDの誤り・サイト移管/削除・トークンの権限不足などの区別には管理者による照合が必要。

2026-10-24 JST の公開サイト確認: https://ma-appraisal.netlify.app/ は HTTP 200。
既定値で不動産査定2,407万円、車査定130万円の結果と内訳を表示。
公開JS `index-BPRQ1nu2.js` は失敗実行の `index-FZ_ydXdi.js` と異なる。
現在の公開が今回のコミットを反映しているとは判断しない。

## 安全な復旧

1. Netlifyで **既存の ma-appraisal** を開き、Project configuration → General の Project IDと、Production domains の `ma-appraisal.netlify.app` を照合する。現在のPublished deploy ID/URLを控える。新規サイト作成・サイト名変更・ドメイン移動・データ削除は不要。
2. GitHubリポジトリの Settings → Secrets and variables → Actions で `NETLIFY_SITE_ID` を既存サイトのProject IDに合わせる。記載済みIDが正しい場合は変更しない。他のワークフローが同じSecretを参照していないか、変更前に確認する。
3. 同じサイトを管理するNetlifyアカウントのトークンについて、有効期限、取消状態、所属チーム・SSO承認を確認する。必要なら同等権限のトークンに更新して `NETLIFY_AUTH_TOKEN` に保存する。トークンをチャット、PR、ログ、リポジトリへ貼らない。
4. 修正ブランチのワークフローを手動実行し、`publish=false` のまま診断する。既存mainにも workflow_dispatch があるため、Run workflowのブランチ選択で修正ブランチを指定できる。CLIなら `gh workflow run deploy-appraisal-app.yml --ref fix/appraisal-netlify-preflight -f publish=false`。
5. 診断結果で分岐する。
   - Authentication 401: トークン期限切れ・取消・値の誤りを確認。
   - Authentication/Site access 403: チーム参加、サイト権限、SSO承認を確認。
   - Site access 404: IDとトークン所有者のアクセス権を照合。404だけでは削除と権限不足を区別しない。
   - target mismatch: 別サイトへの公開を停止した状態。IDと公開ドメインを管理画面で再確認。
   - 429/5xx/network: Netlifyの稼働状況・レート制限を確認して診断のみ再試行。
6. 診断成功・テスト成功を確認後、PRをマージする。mainへのpushは従来通り本番公開する。手動で公開する場合はmainで `publish=true` を明示する。過去の失敗実行を再実行すると古いコードが公開され得るため、最新mainを使う。
7. ActionsのCLI終了コード0と本番URL、NetlifyのPublished deployを確認する。URL・JS/CSS取得、画面表示、不動産と車の入力変更→査定結果更新を検証する。失敗時は控えた既存デプロイを再公開し、サイトやデータを削除しない。

## 設定と変更範囲

`appraisal-app` を作業ディレクトリとして `npm run build` → `dist` を公開する。
`appraisal-app/netlify.toml` はSPAフォールバックを設定している。
ルートの `netlify.toml` は別サイト `hearing-martialarts` 用のため変更しない。
NetlifyのGit連携ビルドを併用している場合、管理画面のBase directoryが `appraisal-app`、Publish directoryがその配下の `dist` かを確認する。

今回の修正は公開前の読み取り専用API診断、公開URLの照合、PR検証と手動診断モードを追加する。
CLIメジャー、既存サイトIDのフォールバック、アプリ本体、査定計算、ドメイン、保存データは変更しない。
Netlifyの実トークン/管理セッションがない環境ではAPI診断の実測と公開完了の検証はできない。
このPRだけで認証情報やサイトIDの不整合が解消するとは限らない。

## テスト

失敗するテストを先に作成後に実装。`npm run typecheck && npm test && npm run build`。
API通信はモックし、正常経路・欠落設定・不正ID・401/403/404/429/500・公開先不一致・通信障害・秘密情報非出力を検証する。
本番APIの権限テストの代わりにはならない。

参考: https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/
API: https://open-api.netlify.com/ (`GET /api/v1/user`, `GET /api/v1/sites/{site_id}`)
