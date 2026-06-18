# slack-bulk-messaging — 個別DMの一斉送信ツール

Slack で**宛先リストの一人ひとりに「個別DM」をまとめて送る**CLIツールです。

グループDMや一斉投稿だと「自分宛」という感覚が薄く、危機感を持ってもらえません。
このツールは**各人へ別々の1対1のDM**を順番に送るので、受け取った側は「自分だけに来た指示」として受け取ります。手作業で一人ずつ送る代わりに、リストを渡せば自動で全員に配信します。

- 宛先は **メールアドレス** でも **Slack ユーザーID** でも指定可能（両対応）
- 本文に **`{{name}}` など差し込み**ができ、一人ひとり宛名入りのDMになる
- **`--dry-run`** で送信前に「誰に・どんな本文が届くか」を確認できる
- 依存パッケージゼロ（Node 18+ の標準 `fetch` のみ）

## セットアップ

### 1. Slack アプリ（Bot）を用意してトークンを取得

1. https://api.slack.com/apps → **Create New App**（From scratch）
2. **OAuth & Permissions** → **Bot Token Scopes** に以下を追加
   - `chat:write` … DMの送信
   - `im:write` … DMチャンネルを開く
   - `users:read` … 表示名の取得（任意）
   - `users:read.email` … **メール宛先を使うなら必須**（メールからユーザーを特定）
3. **Install to Workspace** でワークスペースにインストール
4. 表示される **Bot User OAuth Token**（`xoxb-` で始まる）をコピー

### 2. トークンを設定

```bash
cd slack-bulk-messaging
cp .env.example .env
# .env を開いて SLACK_BOT_TOKEN=xoxb-... を貼り付け
```

`.env` を使わず `--token xoxb-...` で渡すこともできます。

## 使い方

### 1. 宛先CSVを用意（`recipients.example.csv` を参考に）

```csv
name,email,slack_id
山田太郎,taro.yamada@example.com,
佐藤花子,,U01ABCDEF12
鈴木一郎,ichiro.suzuki@example.com,
```

- `email` 列か `slack_id` 列の**どちらか**があればOK（両方あれば `slack_id` 優先）
- `name` などその他の列は本文に差し込めます
- 列名は多少ゆれても認識します（`お名前`/`氏名`、`メールアドレス` など）

### 2. 本文を用意（`message.example.txt` を参考に）

```
{{name}}さん

お疲れさまです。本日中に下記を必ず対応してください。
...
```

`{{列名}}` がCSVの値に置き換わります（`{{name}}` → 山田太郎）。

### 3. まず dry-run で確認（実際には送りません）

```bash
node send.js -r recipients.example.csv -m message.example.txt --dry-run
```

誰に・どんな本文が届くかが一覧表示されます。**本番前に必ず確認**してください。

### 4. 本番送信

```bash
node send.js -r recipients.csv -m message.txt
```

各人へ順番に個別DMを送信します（既定で1秒間隔／レート制限は自動で待機・再試行）。
送信間隔は `--delay 1500`（ミリ秒）で調整できます。

実行ごとに `send-log-<日時>.csv` に結果（成功/失敗）が記録されます。

## オプション一覧

| オプション | 説明 |
| --- | --- |
| `-r, --recipients <file>` | 宛先CSV（必須） |
| `-m, --message <file>` | 本文テキスト（必須） |
| `-d, --delay <ms>` | 送信間隔ミリ秒（既定 1000） |
| `--token <xoxb-...>` | Slack Bot Token（未指定なら `.env`／環境変数） |
| `--dry-run` | 送信せず宛先解決と本文プレビューのみ |
| `-h, --help` | ヘルプ |

## 注意

- **送信は取り消せません。** 本番前に必ず `--dry-run` で確認してください。
- 宛先CSV・本文・送信ログには個人情報が含まれ得ます。`.gitignore` で `recipients.csv` / `message.txt` / `send-log-*.csv` はコミット対象外にしています（例ファイル `*.example.*` のみ追跡）。
- DMを送るには、対象ユーザーがそのワークスペースに参加している必要があります。メール宛先の場合、ワークスペース上のメールと一致しないと `users_not_found` になります。
- 大量送信はワークスペースのポリシーやSlackの利用規約に従ってください。`--delay` を十分に取り、相手への配慮を忘れずに。
