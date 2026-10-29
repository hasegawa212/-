// 役割マップの元データ（Slack 2026/9/1〜10/28 の公開チャンネルの読み取り）
// 顧客の個人情報・個人の評価は入れない。直すときはこのファイルだけ
(function (root) {
  const D = {
 "asOf": "2026-10-28",
 "period": "2026年9月1日〜10月28日",
 "ceoId": "hasegawa",
 "source": "Slack 公開チャンネル約45の読み取り（private チャンネル・DM は対象外）。件数の多いチャンネルは100件ずつ読んだため一部抜けあり",
 "people": [
  {
   "id": "hasegawa",
   "name": "長谷川 光",
   "title": "代表取締役（CEO）",
   "dept": "経営",
   "status": "在籍",
   "note": "2アカウント（長谷川光/代表=U09ESD7T79V、長谷川光/代表2=U08GX92S43G）。自動投稿botの多くも本人アカウントから流れている"
  },
  {
   "id": "takeda",
   "name": "武田 勇成",
   "title": "常務（CMO）",
   "dept": "経営・営業部",
   "status": "在籍"
  },
  {
   "id": "miura",
   "name": "三浦 一路",
   "title": "営業部長",
   "dept": "営業部",
   "status": "在籍"
  },
  {
   "id": "ueda",
   "name": "上田 歩",
   "title": "営業課長",
   "dept": "営業部",
   "status": "在籍"
  },
  {
   "id": "mineta",
   "name": "嶺田 勝",
   "title": "業務責任者",
   "dept": "業務部",
   "status": "在籍"
  },
  {
   "id": "yabu",
   "name": "藪 龍之輔",
   "title": "業務（仕入れ・リフォーム・物件出し）",
   "dept": "業務部",
   "status": "在籍",
   "confidence": "推測",
   "note": "肩書きはSlack上に表記なし。仕事内容から推定"
  },
  {
   "id": "kokubo",
   "name": "小久保 亮子",
   "title": "管理部課長（総務）",
   "dept": "管理部",
   "status": "在籍"
  },
  {
   "id": "kawamitsu",
   "name": "川満 正博",
   "title": "契約書類作成（重説・売買契約書）",
   "dept": "業務部",
   "status": "業務委託",
   "confidence": "推測",
   "note": "毎月末の支払い確認を代表に直接している（10/25）ため業務委託の可能性が高い"
  },
  {
   "id": "kobayashi",
   "name": "小林 駿",
   "title": "係長代理",
   "dept": "営業部",
   "status": "在籍"
  },
  {
   "id": "inuzuka",
   "name": "犬塚 淳宏",
   "title": "係長代理",
   "dept": "営業部",
   "status": "在籍"
  },
  {
   "id": "sakamoto",
   "name": "坂本 塁",
   "title": "係長代理",
   "dept": "営業部",
   "status": "在籍",
   "note": "使用中は新アカウント「坂本塁」(U09KQBSHKHU)。旧アカウント(U08J4UUNR9A)が週次KPI依頼の宛先に残っている"
  },
  {
   "id": "kikuchi",
   "name": "菊池 優心",
   "title": "係長代理",
   "dept": "営業部",
   "status": "在籍"
  },
  {
   "id": "sakai",
   "name": "酒井 海音",
   "title": "営業",
   "dept": "営業部",
   "status": "在籍",
   "note": "使用中は「酒井海音(新)」(U09REMW5HPV)。旧アカウント2つあり"
  },
  {
   "id": "sato",
   "name": "佐藤 優樹",
   "title": "営業（新入社員）",
   "dept": "営業部",
   "status": "在籍",
   "note": "10月入社。10/15に各チャンネルへ参加"
  },
  {
   "id": "hasegawa_toru",
   "name": "長谷川 徹",
   "title": "仕入れ引き継ぎ元",
   "dept": "外部",
   "status": "外部",
   "confidence": "推測",
   "note": "9/21に「仕入れローンのやり方」を共有。Slack上の在籍ユーザーには出てこないが、出勤前チェックリストの宛先に残っている"
  },
  {
   "id": "aoki",
   "name": "青木 龍馬",
   "title": "—",
   "dept": "—",
   "status": "退職",
   "note": "出勤前準備チェックリストの宛先に残っている"
  },
  {
   "id": "kodama",
   "name": "小玉 浩之",
   "title": "—",
   "dept": "—",
   "status": "退職",
   "note": "週次KPI入力依頼の宛先に残っている"
  },
  {
   "id": "suzuki",
   "name": "鈴木",
   "title": "—",
   "dept": "—",
   "status": "退職",
   "note": "CRM上で担当「鈴木（退職）」のお客様が残っている"
  }
 ],
 "tasks": [
  {
   "id": "night-sales-report",
   "name": "東京営業部 最終報告（その日の見込み・月間本数・アポ目標の現状）を#00に投稿",
   "area": "営業",
   "freq": "毎日",
   "owner": "miura",
   "helpers": [
    "ueda"
   ],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-26",
     "note": "10/25(日)東京営業部 最終報告"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-17",
     "note": "上田課長が代わりに投稿"
    }
   ],
   "confidence": "確認",
   "issue": "三浦部長が休みの日は上田課長が代行",
   "seat": "E-1"
  },
  {
   "id": "next-day-schedule",
   "name": "翌日の営業部スケジュール（配車情報＝誰がどの社用車でどの市へ）を夜に#00へ投稿",
   "area": "営業",
   "freq": "毎日",
   "owner": "kikuchi",
   "helpers": [],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-28",
     "note": "10/29(木)営業部スケジュール・配車情報"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-09-03",
     "note": "9/3営業部スケジュール"
    }
   ],
   "confidence": "確認",
   "seat": "E-8"
  },
  {
   "id": "weekend-dispatch-target",
   "name": "土日の朝に「本日の配車と目標棟数・休憩時間」を#07に投稿",
   "area": "営業",
   "freq": "毎週",
   "owner": "sakai",
   "helpers": [],
   "evidence": [
    {
     "channel": "#07_東京-在宅",
     "date": "2026-10-04",
     "note": "本日の配車と目標（目標25棟）"
    },
    {
     "channel": "#07_東京-在宅",
     "date": "2026-09-12",
     "note": "本日の配車と目標"
    }
   ],
   "confidence": "確認",
   "seat": "E-4"
  },
  {
   "id": "weekend-count",
   "name": "土日の目標棟数・実績棟数・見込み・今月アポ目標の現状を人別に集計して#07に投稿",
   "area": "営業",
   "freq": "毎週",
   "owner": "inuzuka",
   "helpers": [],
   "evidence": [
    {
     "channel": "#07_東京-在宅",
     "date": "2026-10-11",
     "note": "【土日目標・結果報告】目標50棟"
    },
    {
     "channel": "#07_東京-在宅",
     "date": "2026-09-27",
     "note": "【土日目標・結果報告】"
    }
   ],
   "confidence": "確認",
   "seat": "S-3"
  },
  {
   "id": "door-visit-log",
   "name": "在宅訪問：#07に日付スレッドを立て、回った建物・部屋ごとの結果を記録",
   "area": "営業",
   "freq": "毎日",
   "owner": null,
   "helpers": [
    "kobayashi",
    "inuzuka",
    "sakamoto",
    "kikuchi",
    "sakai",
    "ueda",
    "miura",
    "takeda",
    "sato"
   ],
   "evidence": [
    {
     "channel": "#07_東京-在宅",
     "date": "2026-10-25",
     "note": "佐藤さんが建物ごとの訪問記録を投稿"
    },
    {
     "channel": "#07_東京-在宅",
     "date": "2026-10-24",
     "note": "三浦部長の訪問記録"
    }
   ],
   "confidence": "確認",
   "issue": "営業全員の共通業務（主担当なし）",
   "seat": null
  },
  {
   "id": "apo-report",
   "name": "アポ報告（前日確認・入室・日時変更・キャンセル/バックレ・契約）を#02に投稿",
   "area": "営業",
   "freq": "毎日",
   "owner": "inuzuka",
   "helpers": [
    "ueda",
    "kikuchi",
    "sakai",
    "sakamoto",
    "takeda",
    "miura",
    "kobayashi"
   ],
   "evidence": [
    {
     "channel": "#02_アポ報告",
     "date": "2026-10-25",
     "note": "アポ日時変更報告（担当犬塚・同行三浦）"
    },
    {
     "channel": "#02_アポ報告",
     "date": "2026-09-25",
     "note": "9/25〜10/10で犬塚23件・武田13件・菊池13件"
    }
   ],
   "confidence": "確認",
   "issue": "同行者が入室報告を書くかで混乱（代表が9/26「入った人が書く」と指示）",
   "seat": null
  },
  {
   "id": "prospect-report",
   "name": "見込み報告をsales-analysis botに投げて#02に記録",
   "area": "営業",
   "freq": "都度",
   "owner": null,
   "helpers": [
    "inuzuka",
    "sakamoto",
    "kobayashi",
    "sakai",
    "kikuchi",
    "ueda",
    "takeda"
   ],
   "evidence": [
    {
     "channel": "#02_アポ報告",
     "date": "2026-10-08",
     "note": "酒井 見込み報告（Sales Analysis）"
    },
    {
     "channel": "#02_アポ報告",
     "date": "2026-09-27",
     "note": "犬塚 見込み報告"
    }
   ],
   "confidence": "確認",
   "bot": "sales-analysis",
   "seat": null
  },
  {
   "id": "deal-report",
   "name": "商談報告と工程報告（相談シートまでのSTEP）を#03に投稿",
   "area": "営業",
   "freq": "都度",
   "owner": "takeda",
   "helpers": [
    "ueda",
    "miura",
    "sakai",
    "sakamoto",
    "kikuchi",
    "kobayashi"
   ],
   "evidence": [
    {
     "channel": "#03_商談報告",
     "date": "2026-10-24",
     "note": "工程報告｜相談シートまで STEP4/5"
    },
    {
     "channel": "#03_商談報告",
     "date": "2026-09-23",
     "note": "9/23〜27は武田11件"
    }
   ],
   "confidence": "確認",
   "seat": null
  },
  {
   "id": "consult-sheet",
   "name": "案件相談シートを#04に提出（kari bot宛）",
   "area": "営業",
   "freq": "都度",
   "owner": null,
   "helpers": [
    "inuzuka",
    "kobayashi",
    "kikuchi"
   ],
   "evidence": [
    {
     "channel": "#04_案件相談シート",
     "date": "2026-10-26",
     "note": "犬塚が提出"
    },
    {
     "channel": "#04_案件相談シート",
     "date": "2026-10-24",
     "note": "bot集計：2026/8以降急減（8月4件→9月1件→10月3件）"
    }
   ],
   "confidence": "確認",
   "issue": "提出数が急減。報告経路が他に流れているか未確認",
   "seat": null
  },
  {
   "id": "case-minutes",
   "name": "案件ごとの議事録スレッド（No.付き）で書類・審査・金消の連絡",
   "area": "営業",
   "freq": "都度",
   "owner": null,
   "helpers": [
    "takeda",
    "kikuchi",
    "mineta",
    "yabu",
    "ueda",
    "sakamoto",
    "sakai",
    "miura",
    "inuzuka"
   ],
   "evidence": [
    {
     "channel": "#05_議事録",
     "date": "2026-10-20",
     "note": "No.402の議事録（犬塚）"
    },
    {
     "channel": "#05_議事録",
     "date": "2026-10-04",
     "note": "嶺田→担当へ審査書類の連絡"
    }
   ],
   "confidence": "確認",
   "issue": "代表が議事録の作成・催促をしている（10/19「議事録の記事送って」）",
   "seat": null
  },
  {
   "id": "docs-deposit",
   "name": "お客様からの預かり書類を#19（file-bot-2）に投稿",
   "area": "営業",
   "freq": "都度",
   "owner": null,
   "helpers": [
    "inuzuka",
    "kikuchi",
    "ueda",
    "sakai",
    "sakamoto",
    "takeda",
    "kobayashi"
   ],
   "evidence": [
    {
     "channel": "#19_営業お預かり書類",
     "date": "2026-10-15",
     "note": "犬塚の書類投稿（9/25〜で13件）"
    },
    {
     "channel": "#19_営業お預かり書類",
     "date": "2026-10-16",
     "note": "CRMへ自動取込（hikaru6780）"
    }
   ],
   "confidence": "確認",
   "bot": "file-bot-2 / hikaru6780（CRMカルテへ自動反映）",
   "issue": "代表が9/17に預かり証の渡し忘れを全社通達",
   "seat": "S-4"
  },
  {
   "id": "weekly-docs-check",
   "name": "毎週月曜：進行中顧客の書類・ボイレコ格納状況を#19で呼びかけ",
   "area": "営業",
   "freq": "毎週",
   "owner": "sakai",
   "helpers": [],
   "evidence": [
    {
     "channel": "#19_営業お預かり書類",
     "date": "2026-10-05",
     "note": "毎週月曜確認の呼びかけ"
    },
    {
     "channel": "#19_営業お預かり書類",
     "date": "2026-09-07",
     "note": "同上"
    }
   ],
   "confidence": "確認",
   "seat": "S-4"
  },
  {
   "id": "cic-myhome",
   "name": "CIC提出・マイホーム（事前審査）報告を#25に投稿",
   "area": "営業",
   "freq": "都度",
   "owner": null,
   "helpers": [],
   "evidence": [
    {
     "channel": "#25_シーアイシー提出-マイホーム個信情報-報告",
     "date": "2026-10-06",
     "note": "代表「昨日のcicのしゅとくする人はどうなってる？」以外に投稿なし"
    },
    {
     "channel": "#05_審査書類",
     "date": "2026-09-06",
     "note": "botが「#19と#25が形骸化」と報告"
    }
   ],
   "confidence": "確認",
   "issue": "担当なし・形骸化",
   "seat": "S-4"
  },
  {
   "id": "voice-recorder",
   "name": "アポ・商談のボイレコを#18に上げ、AIで要約",
   "area": "営業",
   "freq": "都度",
   "owner": null,
   "helpers": [
    "kobayashi",
    "kikuchi",
    "sakamoto",
    "sakai",
    "inuzuka"
   ],
   "evidence": [
    {
     "channel": "#18_アポイントボイレコチャンネル",
     "date": "2026-10-18",
     "note": "代表「ボイレコなかったらインセンティブ下げる」"
    },
    {
     "channel": "#18_商談_ボイレコ",
     "date": "2026-10-25",
     "note": "sales-analysisの商談報告下書き"
    }
   ],
   "confidence": "確認",
   "bot": "apo-analysis / sales-analysis",
   "issue": "ボイレコ未提出が続き、代表がルール化",
   "seat": null
  },
  {
   "id": "car-use",
   "name": "社用車使用報告（業務外・事務所用に車を使う時）",
   "area": "営業",
   "freq": "都度",
   "owner": "miura",
   "helpers": [
    "sakai",
    "kikuchi",
    "inuzuka",
    "ueda",
    "takeda"
   ],
   "evidence": [
    {
     "channel": "#06_車両報告",
     "date": "2026-10-28",
     "note": "社用車使用報告（会社へ行くため）"
    },
    {
     "channel": "#06_車両報告",
     "date": "2026-10-14",
     "note": "酒井 社用車使用報告"
    }
   ],
   "confidence": "確認",
   "seat": null
  },
  {
   "id": "fuel-report",
   "name": "給油報告（宇佐美以外で入れた理由も）",
   "area": "営業",
   "freq": "毎日",
   "owner": null,
   "helpers": [
    "inuzuka",
    "ueda",
    "kikuchi",
    "sakai",
    "miura",
    "takeda",
    "kobayashi",
    "sakamoto",
    "sato",
    "yabu"
   ],
   "evidence": [
    {
     "channel": "#06_車両報告",
     "date": "2026-10-26",
     "note": "犬塚・武田の給油報告"
    },
    {
     "channel": "#06_車両報告",
     "date": "2026-09-01",
     "note": "9/1〜10/10で100件（犬塚18・上田16・菊池12）"
    }
   ],
   "confidence": "確認",
   "issue": "運転者全員の共通業務",
   "seat": null
  },
  {
   "id": "car-accident",
   "name": "社用車の事故・故障報告",
   "area": "営業",
   "freq": "都度",
   "owner": null,
   "helpers": [
    "ueda",
    "inuzuka"
   ],
   "evidence": [
    {
     "channel": "#06_車両報告",
     "date": "2026-09-12",
     "note": "上田 事故報告"
    },
    {
     "channel": "#06_車両報告",
     "date": "2026-10-24",
     "note": "犬塚 故障（バッテリー）報告"
    }
   ],
   "confidence": "確認",
   "seat": null
  },
  {
   "id": "car-monthly-check",
   "name": "社用車の月次点検（25日締め・点検アプリ→管理表）",
   "area": "管理",
   "freq": "毎月",
   "owner": "kokubo",
   "helpers": [
    "hasegawa"
   ],
   "evidence": [
    {
     "channel": "#06_車両報告",
     "date": "2026-09-02",
     "note": "小久保が月次点検管理表を作成"
    },
    {
     "channel": "#06_車両報告",
     "date": "2026-10-26",
     "note": "bot：10月分締切超過、20日・24日リマインド設定"
    }
   ],
   "confidence": "確認",
   "bot": "hikaru6780（未提出リマインド）",
   "issue": "記入率が低く、代表が9/20に「立場関係なくやれ」と通達",
   "seat": "K-1"
  },
  {
   "id": "etc-fleet",
   "name": "ETCコーポレートカード切替・社用車フリート保険更新・廃車解約",
   "area": "管理",
   "freq": "単発",
   "owner": "kokubo",
   "helpers": [
    "takeda",
    "kikuchi"
   ],
   "evidence": [
    {
     "channel": "#06_車両報告",
     "date": "2026-10-26",
     "note": "ETC切替の進捗（証明書不足2台）"
    },
    {
     "channel": "#06_車両報告",
     "date": "2026-10-07",
     "note": "フリート保険の更新手続きを依頼"
    }
   ],
   "confidence": "確認",
   "issue": "セットアップ証明書不足の2台が未解決",
   "seat": "K-1"
  },
  {
   "id": "attendance",
   "name": "勤怠連絡（休暇・遅刻・早退・振替休日）を#10に投稿",
   "area": "全社",
   "freq": "都度",
   "owner": null,
   "helpers": [
    "sakai",
    "inuzuka",
    "mineta",
    "miura",
    "kobayashi",
    "ueda",
    "kokubo",
    "kikuchi",
    "yabu",
    "takeda",
    "sakamoto"
   ],
   "evidence": [
    {
     "channel": "#10_勤怠管理",
     "date": "2026-10-25",
     "note": "酒井 早退申請"
    },
    {
     "channel": "#10_勤怠管理",
     "date": "2026-10-18",
     "note": "嶺田 振替休日申請（決済・契約対応の休日出勤分）"
    }
   ],
   "confidence": "確認",
   "issue": "代表へは理由の共有があったりなかったり（10/25役員ルールで指摘）",
   "seat": null
  },
  {
   "id": "attendance-monthly",
   "name": "月次勤怠管理の報告（前月分）",
   "area": "管理",
   "freq": "毎月",
   "owner": "kokubo",
   "helpers": [],
   "evidence": [
    {
     "channel": "#10_勤怠管理",
     "date": "2026-09-30",
     "note": "月次勤怠管理 2026.9"
    },
    {
     "channel": "#10_勤怠管理",
     "date": "2026-09-02",
     "note": "月次勤怠管理 2026.8"
    }
   ],
   "confidence": "確認",
   "seat": "E-7"
  },
  {
   "id": "leave-approval",
   "name": "勤怠連絡の報告先（承認）",
   "area": "営業",
   "freq": "都度",
   "owner": "takeda",
   "helpers": [
    "miura",
    "ueda"
   ],
   "evidence": [
    {
     "channel": "#10_勤怠管理",
     "date": "2026-10-23",
     "note": "「武田CMO、三浦部長、上田課長に報告済み」"
    },
    {
     "channel": "#10_勤怠管理",
     "date": "2026-10-08",
     "note": "「武田CMOに報告済み」"
    }
   ],
   "confidence": "確認",
   "seat": "E-0"
  },
  {
   "id": "after-hours-entry",
   "name": "営業時間外の事務所入室・退出報告",
   "area": "全社",
   "freq": "都度",
   "owner": "miura",
   "helpers": [],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-28",
     "note": "人形町事務所 入室（事務所整理・書類捜索）"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-06",
     "note": "練馬事務所 入室"
    }
   ],
   "confidence": "確認",
   "seat": null
  },
  {
   "id": "closing-message",
   "name": "終業メッセージ（経営理念・行動指針）を#00に投稿",
   "area": "全社",
   "freq": "毎日",
   "owner": "takeda",
   "helpers": [],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-26",
     "note": "終業メッセージ"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-09-03",
     "note": "終業メッセージ"
    }
   ],
   "confidence": "確認",
   "seat": "E-0"
  },
  {
   "id": "kpi-weekly",
   "name": "週次KPIの入力（月曜20時締め）と提出の催促",
   "area": "経営",
   "freq": "毎週",
   "owner": "takeda",
   "helpers": [
    "hasegawa"
   ],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-26",
     "note": "日曜にbotがKPIフォームの入力依頼（宛先に退職者・旧アカウント）"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-13",
     "note": "武田「KPI送った方はスタンプ」と催促"
    }
   ],
   "confidence": "確認",
   "bot": "長谷川光/代表アカウントの自動投稿",
   "issue": "依頼の宛先に小玉（退職）と坂本・酒井の旧アカウントが残り、佐藤・川満が抜けている",
   "seat": "S-3"
  },
  {
   "id": "kpi-feedback",
   "name": "週次KPIへの一人ひとりへのコメント・全員フィードバック",
   "area": "経営",
   "freq": "毎週",
   "owner": "hasegawa",
   "helpers": [],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-09-15",
     "note": "KPI【一人ひとりへのコメント】"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-09-08",
     "note": "全員フィードバック（9/1〜9/7）"
    }
   ],
   "confidence": "確認",
   "seat": "M-1"
  },
  {
   "id": "weekly-kpi-post",
   "name": "週次KPI・月次進捗・KGI/KPIリマインド・売上ダッシュボードの自動投稿",
   "area": "経営",
   "freq": "毎日",
   "owner": "hasegawa",
   "helpers": [],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-28",
     "note": "10月進捗（残り3日）を朝夜投稿"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-26",
     "note": "週次KPI（毎週月曜10:00）"
    }
   ],
   "confidence": "確認",
   "bot": "Mac miniの常駐スクリプト / hikaru6780 / MA_AI",
   "issue": "10/8に代表が一度「リマインド全部止めろ」と指示。投稿が多く#00が埋まる",
   "seat": "S-10"
  },
  {
   "id": "site-monitor",
   "name": "Web・口コミ・電話番号の監視（平穏報告）",
   "area": "経営",
   "freq": "毎日",
   "owner": "hasegawa",
   "helpers": [],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-28",
     "note": "本日の平穏報告（朝・夜）"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-09-13",
     "note": "Web監視 異常検知（タイムアウト）"
    }
   ],
   "confidence": "確認",
   "bot": "Mac miniの常駐スクリプト",
   "issue": "誰が異常に対応するか決まっていない",
   "seat": "S-8"
  },
  {
   "id": "morning-checklist",
   "name": "出勤前準備チェックリストの報告（ワークフロー）",
   "area": "全社",
   "freq": "毎日",
   "owner": null,
   "helpers": [],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-28",
     "note": "9:00に依頼が届く（宛先に退職者・外部も含む）"
    }
   ],
   "confidence": "確認",
   "bot": "Slackワークフロー「出勤前準備チェックリスト」",
   "issue": "宛先に青木（退職）・長谷川徹が残っている。回答状況は未確認",
   "seat": "S-10"
  },
  {
   "id": "daily-calendar",
   "name": "当日の予定（カレンダー）を朝8時に#07へ自動投稿",
   "area": "営業",
   "freq": "毎日",
   "owner": "hasegawa",
   "helpers": [],
   "evidence": [
    {
     "channel": "#07_東京-在宅",
     "date": "2026-10-12",
     "note": "10/12(月)の予定（3件）"
    },
    {
     "channel": "#07_東京-在宅",
     "date": "2026-09-13",
     "note": "9/13(日)の予定（12件）"
    }
   ],
   "confidence": "確認",
   "bot": "長谷川光/代表アカウントの自動投稿",
   "issue": "予定を入れる人が決まっていない（推測）",
   "seat": "S-10"
  },
  {
   "id": "zaitaku-map",
   "name": "在宅訪問マップの自動投稿（9時）",
   "area": "営業",
   "freq": "毎日",
   "owner": "hasegawa",
   "helpers": [],
   "evidence": [
    {
     "channel": "#07_東京-在宅",
     "date": "2026-10-11",
     "note": "在宅訪問マップ 登録物件：—件"
    }
   ],
   "confidence": "確認",
   "bot": "hikaru6780",
   "issue": "登録物件が毎日「—件」。使われていない",
   "seat": "S-10"
  },
  {
   "id": "monday-meeting",
   "name": "月曜の全体会議（12:00）の告知・出席確認と進行",
   "area": "経営",
   "freq": "毎週",
   "owner": "hasegawa",
   "helpers": [
    "ueda"
   ],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-11",
     "note": "明日10/12(月)12:00 全体会議の告知"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-12",
     "note": "上田がZoomリンクを共有"
    }
   ],
   "confidence": "確認",
   "issue": "10/19に代表「上層部がいないなら全体会議ではない」",
   "seat": "M-1"
  },
  {
   "id": "settlement-meeting",
   "name": "決済戦略会議の議事録",
   "area": "営業",
   "freq": "毎週",
   "owner": "inuzuka",
   "helpers": [
    "takeda"
   ],
   "evidence": [
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-05",
     "note": "決済戦略会議 議事録テンプレ"
    },
    {
     "channel": "#18_会議_ボイレコ",
     "date": "2026-10-05",
     "note": "決済戦略会議の録音をAI要約"
    }
   ],
   "confidence": "確認",
   "bot": "sales-analysis（録音要約）",
   "seat": "M-1"
  },
  {
   "id": "win-meeting",
   "name": "Win meeting（営業メンバー週次）の司会・書記・まとめ投稿",
   "area": "営業",
   "freq": "毎週",
   "owner": "kobayashi",
   "helpers": [
    "sakai",
    "sakamoto",
    "inuzuka"
   ],
   "evidence": [
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-05",
     "note": "司会：小林代理 書記：酒井"
    },
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-19",
     "note": "議事録 坂本・進行 犬塚"
    }
   ],
   "confidence": "確認",
   "seat": "S-1"
  },
  {
   "id": "case-meeting",
   "name": "案件進捗の個別会議（全体会議の後）",
   "area": "経営",
   "freq": "毎週",
   "owner": "hasegawa",
   "helpers": [
    "mineta",
    "yabu",
    "inuzuka"
   ],
   "evidence": [
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-20",
     "note": "進行：長谷川CEO／サポート：嶺田／書記：藪・犬塚"
    },
    {
     "channel": "#14_社内ルール共有",
     "date": "2026-10-11",
     "note": "案件会議のメンバー（長谷川・勝さん・薮・犬塚くん）"
    }
   ],
   "confidence": "確認",
   "seat": "M-1"
  },
  {
   "id": "sourcing-meeting",
   "name": "仕入れ会議（金曜12:00）と議事録",
   "area": "仕入れ・業務",
   "freq": "毎週",
   "owner": "yabu",
   "helpers": [
    "hasegawa",
    "takeda",
    "miura",
    "ueda",
    "mineta"
   ],
   "evidence": [
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-23",
     "note": "仕入れ会議 議事録（藪）"
    },
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-09-26",
     "note": "仕入れ会議まとめ"
    }
   ],
   "confidence": "確認",
   "seat": "E-5"
  },
  {
   "id": "property-proposal",
   "name": "相談シート前のお客様へ物件を探して提案（物件出し）",
   "area": "仕入れ・業務",
   "freq": "都度",
   "owner": "yabu",
   "helpers": [
    "takeda",
    "mineta",
    "sakai"
   ],
   "evidence": [
    {
     "channel": "#21_相談シート前の案件-提案物件-",
     "date": "2026-10-17",
     "note": "自社2件の提案"
    },
    {
     "channel": "#12_内見報告",
     "date": "2026-10-02",
     "note": "代表「物件出しだれか手伝ってくれた？」→常務・勝さん・かいとが手伝い"
    }
   ],
   "confidence": "確認",
   "issue": "藪に集中（9/30代表「藪は15日から休みがない」、同行者にも物件出しを指示）",
   "seat": "P-1"
  },
  {
   "id": "viewing-plan",
   "name": "内見予定報告（物件・業者・鍵・返済額）を#12に投稿",
   "area": "仕入れ・業務",
   "freq": "都度",
   "owner": "yabu",
   "helpers": [
    "mineta"
   ],
   "evidence": [
    {
     "channel": "#12_内見報告",
     "date": "2026-10-25",
     "note": "内見予定報告（10/26）"
    },
    {
     "channel": "#12_内見報告",
     "date": "2026-10-03",
     "note": "嶺田が内見予定報告"
    }
   ],
   "confidence": "確認",
   "seat": "P-1"
  },
  {
   "id": "viewing-attend",
   "name": "全ての内見に同行",
   "area": "仕入れ・業務",
   "freq": "都度",
   "owner": "mineta",
   "helpers": [],
   "evidence": [
    {
     "channel": "#14_社内ルール共有",
     "date": "2026-10-24",
     "note": "今後の全ての内見に嶺田勝が同行するルール"
    }
   ],
   "confidence": "確認",
   "issue": "10/24から。嶺田の予定を先に確認する必要",
   "seat": "E-5"
  },
  {
   "id": "reform-case",
   "name": "リフォーム案件の管理（見積書・請求書・業者日程・完工確認・アプラス審査・着金確認）",
   "area": "仕入れ・業務",
   "freq": "毎日",
   "owner": "yabu",
   "helpers": [
    "ueda",
    "takeda",
    "mineta"
   ],
   "evidence": [
    {
     "channel": "#01_自社リフォーム案件",
     "date": "2026-10-25",
     "note": "案件一覧をcanvasに追加・正式承認の連絡"
    },
    {
     "channel": "#01_自社リフォーム案件",
     "date": "2026-10-24",
     "note": "アプラス完工確認の手配"
    }
   ],
   "confidence": "確認",
   "issue": "9/1〜10/26の62件中52件が藪",
   "seat": "E-6"
  },
  {
   "id": "reform-vendor",
   "name": "リフォーム業者の単価比較・新しい業者探し",
   "area": "仕入れ・業務",
   "freq": "単発",
   "owner": "hasegawa",
   "helpers": [
    "ueda",
    "takeda"
   ],
   "evidence": [
    {
     "channel": "#01_自社リフォーム案件",
     "date": "2026-10-07",
     "note": "翔ホーム vs 候補業者 単価比較"
    },
    {
     "channel": "#01_自社リフォーム案件",
     "date": "2026-10-05",
     "note": "代表「みんなでさがすのたのむね」"
    }
   ],
   "confidence": "確認",
   "seat": "P-2"
  },
  {
   "id": "loan-status",
   "name": "事前承認・本承認・契約完了・金消・決済完了の報告を#00に投稿",
   "area": "仕入れ・業務",
   "freq": "都度",
   "owner": "mineta",
   "helpers": [
    "yabu",
    "takeda",
    "ueda"
   ],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-25",
     "note": "金消契約完了（嶺田）・本承認（藪）"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-13",
     "note": "決済完了報告（嶺田）"
    }
   ],
   "confidence": "確認",
   "seat": "E-5"
  },
  {
   "id": "loan-screening",
   "name": "住宅ローン審査の段取り（給料証明書・本申込・金融機関とのやりとり）",
   "area": "仕入れ・業務",
   "freq": "都度",
   "owner": "mineta",
   "helpers": [
    "takeda",
    "hasegawa"
   ],
   "evidence": [
    {
     "channel": "#05_議事録",
     "date": "2026-10-04",
     "note": "嶺田→菊池 本申込完了の連絡"
    },
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-22",
     "note": "仲介業者と融資審査状況の打合せ（CEO・嶺田・武田）"
    }
   ],
   "confidence": "確認",
   "seat": "E-5"
  },
  {
   "id": "contract-docs",
   "name": "重要事項説明書・売買契約書の作成とAI・BC間契約自動作成の検証",
   "area": "仕入れ・業務",
   "freq": "毎日",
   "owner": "kawamitsu",
   "helpers": [
    "takeda"
   ],
   "evidence": [
    {
     "channel": "#27_タスク報告_内勤",
     "date": "2026-10-25",
     "note": "重説・売買契約書作成→AI自動作成で検証"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-09-26",
     "note": "代表「初の重要事項説明書契約ありがとう」"
    }
   ],
   "confidence": "確認",
   "seat": null
  },
  {
   "id": "ai-contract-check",
   "name": "AI自動売買契約書の項目チェック（49項目）",
   "area": "仕入れ・業務",
   "freq": "単発",
   "owner": "takeda",
   "helpers": [
    "kawamitsu"
   ],
   "evidence": [
    {
     "channel": "#役員ルールチャンネル",
     "date": "2026-09-01",
     "note": "49項目中15項目を確認、残りは川満さんへ"
    }
   ],
   "confidence": "確認",
   "seat": null
  },
  {
   "id": "task-report",
   "name": "内勤の1日の1時間ごとスケジュール報告（#27）",
   "area": "管理",
   "freq": "毎日",
   "owner": "kokubo",
   "helpers": [
    "kawamitsu",
    "yabu"
   ],
   "evidence": [
    {
     "channel": "#27_タスク報告_内勤",
     "date": "2026-10-28",
     "note": "小久保タスク"
    },
    {
     "channel": "#27_タスク報告_内勤",
     "date": "2026-10-09",
     "note": "藪の最後の投稿"
    }
   ],
   "confidence": "確認",
   "issue": "藪は10/9以降投稿なし。嶺田は投稿なし",
   "seat": null
  },
  {
   "id": "transfer-request",
   "name": "振込依頼の起票（file-bot-2・3日前ルール・金額ごとの承認）",
   "area": "管理",
   "freq": "毎日",
   "owner": "mineta",
   "helpers": [
    "kokubo",
    "takeda",
    "miura",
    "ueda",
    "inuzuka",
    "kikuchi",
    "sakamoto"
   ],
   "evidence": [
    {
     "channel": "#23_請求書_振込依頼_共有チャンネル",
     "date": "2026-10-26",
     "note": "嶺田の振込依頼（10/16〜で12件）"
    },
    {
     "channel": "#23_請求書_振込依頼_共有チャンネル",
     "date": "2026-10-08",
     "note": "営業各自が家賃補填の振込依頼"
    }
   ],
   "confidence": "確認",
   "bot": "file-bot-2 / MA_AI・hikaru6780（前日リマインド）",
   "issue": "前日・当日の依頼が多い（9/15・10/19に代表が指摘）",
   "seat": "K-2"
  },
  {
   "id": "transfer-execute",
   "name": "振込の実行（楽天銀行の予約振込）と完了明細の共有",
   "area": "経営",
   "freq": "毎日",
   "owner": "hasegawa",
   "helpers": [
    "kokubo",
    "takeda"
   ],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-25",
     "note": "「本日朝イチでお振込み予約させてもらってます」"
    },
    {
     "channel": "#23_請求書_振込依頼_共有チャンネル",
     "date": "2026-10-15",
     "note": "ペイジー非対応分を小久保が支払い用紙で対応"
    }
   ],
   "confidence": "確認",
   "issue": "代表に集中。資金繰りを見ないまま承認が出ていた（10/9役員ルールで指摘）",
   "seat": "K-2"
  },
  {
   "id": "payment-approval",
   "name": "振込依頼の承認（役員）",
   "area": "経営",
   "freq": "都度",
   "owner": "takeda",
   "helpers": [
    "miura"
   ],
   "evidence": [
    {
     "channel": "#役員ルールチャンネル",
     "date": "2026-10-09",
     "note": "武田・三浦が「必要経費なので承認していた」と回答"
    }
   ],
   "confidence": "確認",
   "issue": "資金繰りを踏まえた承認になっていない。事前相談に変更",
   "seat": "E-0"
  },
  {
   "id": "income-report",
   "name": "入金予定・入金・手付金回収の報告（#23入金）",
   "area": "管理",
   "freq": "都度",
   "owner": "takeda",
   "helpers": [
    "hasegawa",
    "mineta"
   ],
   "evidence": [
    {
     "channel": "#23_入金確認_入金報告_共有チャンネル",
     "date": "2026-10-13",
     "note": "代表「ゆーせーしかいれてない」"
    },
    {
     "channel": "#23_入金確認_入金報告_共有チャンネル",
     "date": "2026-10-25",
     "note": "武田 入金報告"
    }
   ],
   "confidence": "確認",
   "issue": "9/2〜10/28の39件中28件が武田。入れる人を決める必要",
   "seat": "K-2"
  },
  {
   "id": "rent-remit",
   "name": "毎月10日：管理物件オーナーへの家賃送金と家賃補填の振込（記録シート）",
   "area": "管理",
   "freq": "毎月",
   "owner": "hasegawa",
   "helpers": [
    "miura",
    "ueda",
    "takeda",
    "sakamoto",
    "inuzuka",
    "kikuchi"
   ],
   "evidence": [
    {
     "channel": "#賃貸管理",
     "date": "2026-10-09",
     "note": "明日10日 賃料・家賃補填 振込日のリマインド"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-09-09",
     "note": "毎月リマインド：管理物件オーナー様家賃送金"
    }
   ],
   "confidence": "確認",
   "bot": "hikaru6780（9日21時リマインド・振込記録シート）",
   "issue": "振込先口座が未取得の案件あり（9/12）",
   "seat": "K-2"
  },
  {
   "id": "payroll",
   "name": "給料・歩合の計算確定と振込（20日給料シート締め・25日支給・月末歩合）",
   "area": "経営",
   "freq": "毎月",
   "owner": "hasegawa",
   "helpers": [
    "kokubo"
   ],
   "evidence": [
    {
     "channel": "#15_歩合シート_外交員明細",
     "date": "2026-09-30",
     "note": "代表「歩合振り込みました」"
    },
    {
     "channel": "#10_勤怠管理",
     "date": "2026-10-20",
     "note": "毎月リマインド：20日 給料シート締切"
    }
   ],
   "confidence": "確認",
   "bot": "長谷川光/代表アカウントの自動リマインド",
   "seat": "M-1"
  },
  {
   "id": "expense",
   "name": "個人経費精算（20日12時締め）の申請",
   "area": "全社",
   "freq": "毎月",
   "owner": null,
   "helpers": [
    "yabu",
    "inuzuka",
    "sakai",
    "takeda"
   ],
   "evidence": [
    {
     "channel": "#33-個人経費精算チャンネル-20日まで-",
     "date": "2026-10-19",
     "note": "soumu botの申請通知（9/19〜10/19で75件）"
    },
    {
     "channel": "#23_請求書_振込依頼_共有チャンネル",
     "date": "2026-10-20",
     "note": "振込依頼書の自動生成"
    }
   ],
   "confidence": "確認",
   "bot": "soumu",
   "seat": null
  },
  {
   "id": "expense-receipt",
   "name": "経費精算の領収書原本回収と税理士への送付",
   "area": "管理",
   "freq": "毎月",
   "owner": "kokubo",
   "helpers": [],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-09-24",
     "note": "領収書の原本を小久保まで提出"
    },
    {
     "channel": "#26_郵送物",
     "date": "2026-10-05",
     "note": "9月の個人精算領収書一式を税理士法人へ発送"
    }
   ],
   "confidence": "確認",
   "seat": "E-7"
  },
  {
   "id": "expense-approve",
   "name": "経費精算の内容確認・承認",
   "area": "経営",
   "freq": "毎月",
   "owner": "hasegawa",
   "helpers": [
    "takeda"
   ],
   "evidence": [
    {
     "channel": "#33-個人経費精算チャンネル-20日まで-",
     "date": "2026-09-20",
     "note": "代表「やることがありすぎて一個ずつ確認できない」→botに精査依頼"
    }
   ],
   "confidence": "確認",
   "bot": "hikaru6780",
   "issue": "代表が確認しきれていない",
   "seat": "M-1"
  },
  {
   "id": "mail",
   "name": "郵便物の受取・スキャン・保管・担当デスクへの配布と発送の報告",
   "area": "管理",
   "freq": "毎日",
   "owner": "kokubo",
   "helpers": [],
   "evidence": [
    {
     "channel": "#26_郵送物",
     "date": "2026-10-05",
     "note": "郵便物の報告（9/1〜10/5で66件）"
    },
    {
     "channel": "#26_郵送物",
     "date": "2026-09-11",
     "note": "嶺田さん依頼の発送"
    }
   ],
   "confidence": "確認",
   "bot": "長谷川光/代表アカウント（21時に郵送物まとめ）",
   "seat": "K-1"
  },
  {
   "id": "wfh-phone",
   "name": "水曜の在宅勤務連絡と東洋建設ホーム・JAPANマネジメントの受電対応",
   "area": "管理",
   "freq": "毎週",
   "owner": "kokubo",
   "helpers": [],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-27",
     "note": "明日（水曜）在宅勤務・東洋建設ホームの受電対応"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-16",
     "note": "受電報告（担当者宛の伝言）"
    }
   ],
   "confidence": "確認",
   "seat": "E-7"
  },
  {
   "id": "seal-docs",
   "name": "印鑑カードの取出し・格納報告と印鑑証明・住民票・納税証明の取得",
   "area": "管理",
   "freq": "都度",
   "owner": "kokubo",
   "helpers": [],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-15",
     "note": "重要物品 取り出し（区役所でCEO印鑑証明）"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-09-08",
     "note": "通帳記帳・納税証明書取得で外出"
    }
   ],
   "confidence": "確認",
   "seat": "E-7"
  },
  {
   "id": "office-admin",
   "name": "来客連絡・会議室予約表・オフィス備品・エレベーター停止などの社内連絡",
   "area": "管理",
   "freq": "都度",
   "owner": "kokubo",
   "helpers": [],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-06",
     "note": "来客連絡（フリート更新）"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-09-17",
     "note": "会議室の予約表を作成"
    }
   ],
   "confidence": "確認",
   "seat": "K-1"
  },
  {
   "id": "monday-cleaning",
   "name": "月曜の社内清掃と完了連絡",
   "area": "全社",
   "freq": "毎週",
   "owner": "kokubo",
   "helpers": [
    "inuzuka"
   ],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-26",
     "note": "小久保「本日も月曜日の社内清掃ありがとうございました」"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-12",
     "note": "犬塚が清掃完了を報告"
    }
   ],
   "confidence": "確認",
   "seat": null
  },
  {
   "id": "alrit-filing",
   "name": "会社書類・明細をアルリット（社内NAS）に格納依頼",
   "area": "管理",
   "freq": "都度",
   "owner": "hasegawa",
   "helpers": [
    "kokubo",
    "takeda"
   ],
   "evidence": [
    {
     "channel": "#13_アルリット格納依頼",
     "date": "2026-10-28",
     "note": "9/1〜10/28で代表48件・小久保10件・武田7件"
    },
    {
     "channel": "#13_アルリット格納依頼",
     "date": "2026-09-02",
     "note": "小久保 ETC・ガソリン代の月次明細を報告"
    }
   ],
   "confidence": "確認",
   "bot": "file-bot-2",
   "issue": "会社書類の格納を代表が自分でしている",
   "seat": "K-1"
  },
  {
   "id": "rakuten-life",
   "name": "楽天生命 代理店の年次対応（研修・アンケート・登録確認）の案内",
   "area": "管理",
   "freq": "単発",
   "owner": "ueda",
   "helpers": [
    "takeda",
    "kokubo"
   ],
   "evidence": [
    {
     "channel": "#07_東京-在宅",
     "date": "2026-09-28",
     "note": "上田が全員向けにやり方を投稿"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-02",
     "note": "上田が「代理店代表者のみの内容だった」と訂正"
    }
   ],
   "confidence": "確認",
   "seat": "S-9"
  },
  {
   "id": "bond-interest",
   "name": "私募債の利息支払いの管理",
   "area": "管理",
   "freq": "毎月",
   "owner": "takeda",
   "helpers": [
    "kikuchi"
   ],
   "evidence": [
    {
     "channel": "#役員ルールチャンネル",
     "date": "2026-10-17",
     "note": "利息の振込時期を過ぎたとお客様から電話、武田が確認漏れを報告"
    }
   ],
   "confidence": "確認",
   "issue": "支払い漏れが発生。請求チャンネルに流すよう代表が指示（10/18）",
   "seat": "K-2"
  },
  {
   "id": "asset-followup",
   "name": "既存のお客様への資産管理フォロー電話（毎週木曜10〜17時）",
   "area": "営業",
   "freq": "毎週",
   "owner": "sakai",
   "helpers": [
    "hasegawa"
   ],
   "evidence": [
    {
     "channel": "#28_-お客様の資産管理",
     "date": "2026-09-16",
     "note": "担当：酒井（毎週木曜）として開始"
    },
    {
     "channel": "#28_-お客様の資産管理",
     "date": "2026-10-08",
     "note": "架電記録（サイドアプローチ確定）"
    }
   ],
   "confidence": "確認",
   "bot": "hikaru6780（架電ログ・週次サマリー） / staff（顧客情報照会）",
   "seat": "S-5"
  },
  {
   "id": "recovery-call",
   "name": "過去アポの再アプローチ架電（オートコール・リカバリーリスト）",
   "area": "営業",
   "freq": "単発",
   "owner": "kobayashi",
   "helpers": [
    "sakai",
    "hasegawa"
   ],
   "evidence": [
    {
     "channel": "#09_アポキャンセルバックれチャンネル",
     "date": "2026-10-15",
     "note": "小林・酒井が架電結果を記録、代表がオートコール開始"
    },
    {
     "channel": "#00-営業部全体",
     "date": "2026-10-22",
     "note": "MA_AIが酒井宛の架電業務（23名）を案内"
    }
   ],
   "confidence": "確認",
   "bot": "hikaru6780（TAC自動架電） / MA_AI",
   "seat": "S-5"
  },
  {
   "id": "sales-training",
   "name": "商談研修の講師",
   "area": "営業",
   "freq": "都度",
   "owner": "takeda",
   "helpers": [
    "hasegawa"
   ],
   "evidence": [
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-22",
     "note": "商談研修③ 進行：武田CMO"
    },
    {
     "channel": "#14_社内ルール共有",
     "date": "2026-10-28",
     "note": "代表が商談の研修を実施"
    }
   ],
   "confidence": "確認",
   "seat": "S-6"
  },
  {
   "id": "training-notes",
   "name": "商談研修のまとめを#16に投稿",
   "area": "営業",
   "freq": "都度",
   "owner": null,
   "helpers": [
    "sakai",
    "kikuchi"
   ],
   "evidence": [
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-05",
     "note": "商談研修②まとめ（酒井）"
    },
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-22",
     "note": "商談研修③まとめ（菊池）"
    }
   ],
   "confidence": "確認",
   "seat": "S-6"
  },
  {
   "id": "training-test",
   "name": "研修後のフィードバックテスト・ロープレ評価",
   "area": "経営",
   "freq": "都度",
   "owner": "hasegawa",
   "helpers": [],
   "evidence": [
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-05",
     "note": "研修受講者一人ずつフィードバック、木曜までにテスト提出"
    },
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-08",
     "note": "ロープレフィードバック"
    }
   ],
   "confidence": "確認",
   "seat": "S-6"
  },
  {
   "id": "ceo-meeting",
   "name": "お客様との面談・商談への同席（面談者：代表）",
   "area": "営業",
   "freq": "都度",
   "owner": "hasegawa",
   "helpers": [
    "sakai",
    "ueda"
   ],
   "evidence": [
    {
     "channel": "#02_アポ報告",
     "date": "2026-10-08",
     "note": "面談アポイント確定（面談者：代表 長谷川）"
    },
    {
     "channel": "#03_商談報告",
     "date": "2026-10-25",
     "note": "代表とのオンライン商談録画"
    }
   ],
   "confidence": "確認",
   "seat": null
  },
  {
   "id": "accompany",
   "name": "アポ・内見・本申込への同行",
   "area": "営業",
   "freq": "毎日",
   "owner": "takeda",
   "helpers": [
    "miura",
    "ueda"
   ],
   "evidence": [
    {
     "channel": "#02_アポ報告",
     "date": "2026-10-24",
     "note": "同行：武田CMO・三浦"
    },
    {
     "channel": "#07_東京-在宅",
     "date": "2026-09-13",
     "note": "予定12件のうち同行が武田・三浦・上田"
    }
   ],
   "confidence": "確認",
   "seat": "E-0"
  },
  {
   "id": "recruit-ads",
   "name": "採用広告（Meta広告・採用LP・Indeed）の企画と打合せ",
   "area": "経営",
   "freq": "都度",
   "owner": "hasegawa",
   "helpers": [
    "takeda"
   ],
   "evidence": [
    {
     "channel": "#24_インディード面接_メタ広告人財募集",
     "date": "2026-09-15",
     "note": "人財集客広告LP"
    },
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-19",
     "note": "武田がIndeed求人広告の打合せ議事録"
    }
   ],
   "confidence": "確認",
   "seat": "K-3"
  },
  {
   "id": "recruit-call",
   "name": "応募者への電話・カジュアル面談・面談設定",
   "area": "経営",
   "freq": "毎日",
   "owner": "hasegawa",
   "helpers": [],
   "evidence": [
    {
     "channel": "#24_インディード面接_メタ広告人財募集",
     "date": "2026-09-21",
     "note": "カジュアル面談報告（対応：長谷川）"
    },
    {
     "channel": "#24_インディード面接_メタ広告人財募集",
     "date": "2026-09-23",
     "note": "「午前8時51分 不在」と架電記録"
    }
   ],
   "confidence": "確認",
   "bot": "hikaru6780（電話名簿・応募通知・シート更新）",
   "issue": "代表に集中",
   "seat": "K-3"
  },
  {
   "id": "recruit-interview",
   "name": "面接の実施と面接報告・内定通知書",
   "area": "経営",
   "freq": "都度",
   "owner": "takeda",
   "helpers": [
    "ueda",
    "miura"
   ],
   "evidence": [
    {
     "channel": "#24_インディード面接_メタ広告人財募集",
     "date": "2026-09-15",
     "note": "三浦 面接報告（採用）、武田が内定通知書を作成・送付"
    },
    {
     "channel": "#24_インディード面接_メタ広告人財募集",
     "date": "2026-09-03",
     "note": "上田 面接報告"
    }
   ],
   "confidence": "確認",
   "seat": "K-3"
  },
  {
   "id": "new-hire-setup",
   "name": "新入社員のフォーム・ツール登録（経費精算・KPI）",
   "area": "管理",
   "freq": "都度",
   "owner": "hasegawa",
   "helpers": [],
   "evidence": [
    {
     "channel": "#33-個人経費精算チャンネル-20日まで-",
     "date": "2026-10-17",
     "note": "佐藤さん・川満さんの追加をbotに依頼→権限不足で未完了"
    }
   ],
   "confidence": "確認",
   "issue": "担当者がいない。KPI依頼の宛先にも未反映",
   "seat": "K-3"
  },
  {
   "id": "tools-dev",
   "name": "社内ツールの開発・保守（顧客管理アプリ・CRM・点検アプリ・自動テレアポ・名刺アプリ・ルールポータル等）",
   "area": "経営",
   "freq": "毎日",
   "owner": "hasegawa",
   "helpers": [],
   "evidence": [
    {
     "channel": "#14_社内ルール共有",
     "date": "2026-10-24",
     "note": "顧客管理アプリのログイン情報を共有"
    },
    {
     "channel": "#28_-お客様の資産管理",
     "date": "2026-10-11",
     "note": "自動テレアポアプリ2つ目を作成"
    }
   ],
   "confidence": "確認",
   "bot": "hikaru6780 / staff / MA_AI",
   "issue": "代表1人。停止やログイン切れが頻発（Mac miniオフライン10/15、APIの認証切れ）",
   "seat": "S-10"
  },
  {
   "id": "rules",
   "name": "社内ルール・全社通達（ボイレコ必須・預かり証・言葉遣い・内見同行など）",
   "area": "経営",
   "freq": "毎週",
   "owner": "hasegawa",
   "helpers": [
    "takeda"
   ],
   "evidence": [
    {
     "channel": "#14_社内ルール共有",
     "date": "2026-10-24",
     "note": "お客様への言葉遣いとルールについて"
    },
    {
     "channel": "#14_社内ルール共有",
     "date": "2026-09-18",
     "note": "現金と預り証の取扱い"
    }
   ],
   "confidence": "確認",
   "bot": "hikaru6780（ルールポータル更新）",
   "seat": "M-1"
  },
  {
   "id": "deal-room",
   "name": "商談中は「商談ルーム」に入る（代表が聞ける状態にする）",
   "area": "営業",
   "freq": "毎日",
   "owner": null,
   "helpers": [],
   "evidence": [
    {
     "channel": "#役員ルールチャンネル",
     "date": "2026-10-22",
     "note": "代表「商談のルームつくったんだからやれよ」"
    },
    {
     "channel": "#役員ルールチャンネル",
     "date": "2026-10-17",
     "note": "ルールとして再通達"
    }
   ],
   "confidence": "確認",
   "issue": "守られていない",
   "seat": null
  },
  {
   "id": "finance",
   "name": "金融機関との面談・資金調達（融資・バックファイナンス）",
   "area": "経営",
   "freq": "都度",
   "owner": "hasegawa",
   "helpers": [
    "mineta"
   ],
   "evidence": [
    {
     "channel": "#16_会議_報告資料_共有",
     "date": "2026-10-08",
     "note": "金融機関面談報告"
    },
    {
     "channel": "#18_会議_ボイレコ",
     "date": "2026-09-25",
     "note": "借入の実行・登記の最終整理（長谷川・嶺田）"
    }
   ],
   "confidence": "確認",
   "issue": "資金繰りが厳しく代表に集中",
   "seat": null
  },
  {
   "id": "legal",
   "name": "元専務の件の弁護士対応",
   "area": "経営",
   "freq": "単発",
   "owner": "hasegawa",
   "helpers": [
    "ueda"
   ],
   "evidence": [
    {
     "channel": "#14_社内ルール共有",
     "date": "2026-09-08",
     "note": "弁護士を通じて法的手続きに入ると全社連絡"
    },
    {
     "channel": "#役員ルールチャンネル",
     "date": "2026-10-13",
     "note": "上田に経緯のまとめを依頼"
    }
   ],
   "confidence": "確認",
   "seat": null
  },
  {
   "id": "partner-lp",
   "name": "紹介パートナー募集の立ち上げ（LP・Meta広告）",
   "area": "経営",
   "freq": "単発",
   "owner": "hasegawa",
   "helpers": [
    "takeda"
   ],
   "evidence": [
    {
     "channel": "#30_反響_lp-hp",
     "date": "2026-10-15",
     "note": "紹介パートナー募集 立ち上げの決定事項"
    }
   ],
   "confidence": "確認",
   "seat": "S-8"
  },
  {
   "id": "inbound-lp",
   "name": "LP・HPからの反響対応",
   "area": "営業",
   "freq": "都度",
   "owner": null,
   "helpers": [
    "takeda",
    "mineta"
   ],
   "evidence": [
    {
     "channel": "#30_反響_lp-hp",
     "date": "2026-09-23",
     "note": "bot分析：反響55〜60件に対し結果が出ていない"
    }
   ],
   "confidence": "推測",
   "issue": "担当が決まっていない（#30_メール-反響は投稿なし）",
   "seat": "S-8"
  },
  {
   "id": "new-structure",
   "name": "新体制のペア（組合せ）案の作成",
   "area": "経営",
   "freq": "単発",
   "owner": "takeda",
   "helpers": [
    "hasegawa"
   ],
   "evidence": [
    {
     "channel": "#役員ルールチャンネル",
     "date": "2026-10-21",
     "note": "新体制のペアのパターン1・2"
    }
   ],
   "confidence": "確認",
   "seat": null
  },
  {
   "id": "philosophy",
   "name": "営業理念・業務理念づくり",
   "area": "経営",
   "freq": "単発",
   "owner": "hasegawa",
   "helpers": [],
   "evidence": [
    {
     "channel": "#14_社内ルール共有",
     "date": "2026-10-26",
     "note": "全員で営業理念・業務理念を決める投稿"
    }
   ],
   "confidence": "確認",
   "seat": null
  },
  {
   "id": "campaign-event",
   "name": "キャンペーン閉会式・来客（賞金授与）の段取り",
   "area": "全社",
   "freq": "単発",
   "owner": "ueda",
   "helpers": [
    "miura",
    "hasegawa"
   ],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-12",
     "note": "上田 閉会式の会場予約・見積報告"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-14",
     "note": "三浦 来社予定の周知"
    }
   ],
   "confidence": "確認",
   "seat": null
  },
  {
   "id": "huddle-call",
   "name": "営業のハドル（オンライン集合）の呼びかけ",
   "area": "営業",
   "freq": "都度",
   "owner": "ueda",
   "helpers": [],
   "evidence": [
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-06",
     "note": "営業で入れる方はハドルへ"
    },
    {
     "channel": "#00_martialarts全体",
     "date": "2026-10-01",
     "note": "ハドル開始"
    }
   ],
   "confidence": "確認",
   "seat": "E-2"
  },
  {
   "id": "stale-alert",
   "name": "停滞案件アラート（案件シートの停滞日数）",
   "area": "営業",
   "freq": "毎日",
   "owner": null,
   "helpers": [],
   "evidence": [
    {
     "channel": "#営業-業務共有チャンネル-",
     "date": "2026-09-11",
     "note": "Zapierの停滞案件アラート（以降投稿なし）"
    }
   ],
   "confidence": "確認",
   "bot": "Zapier",
   "issue": "9/11以降止まっている。テスト案件・担当未設定が混在",
   "seat": "S-10"
  },
  {
   "id": "rent-mediation",
   "name": "賃貸仲介・日報提出・見込み在宅の報告",
   "area": "営業",
   "freq": "都度",
   "owner": null,
   "helpers": [],
   "evidence": [
    {
     "channel": "#20_賃貸仲介業",
     "date": "2026-10-28",
     "note": "期間中投稿なし"
    },
    {
     "channel": "#11_日報提出",
     "date": "2026-10-28",
     "note": "期間中投稿なし（#08_見込み在宅も同じ）"
    }
   ],
   "confidence": "確認",
   "issue": "チャンネルはあるが誰も使っていない",
   "seat": null
  }
 ]
};
  if (typeof module === "object" && module.exports) module.exports = D;
  else root.RM_DATA = D;
})(typeof self !== "undefined" ? self : this);
