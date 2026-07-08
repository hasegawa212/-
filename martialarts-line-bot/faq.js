// faq.js — ビジネスライン（LINE公式アカウント）の唯一の情報源 (single source of truth)
//
// 会社情報・FAQ・メニュー・サービス定義をここに集約しています。
// server.js / flex.js はここからエクスポートされた値だけを参照します。
//
// 〔要確認〕が付いた箇所は公式情報で差し替えてください（特に電話番号・免許番号）。

// ── 会社情報 ───────────────────────────────────────────────────
// 出典: martialarts.co.jp / 各種企業DB（2024時点の公開情報をもとに整理）
export const COMPANY = {
  name: '株式会社 Martial Arts',
  reading: 'マーシャルアーツ',
  tagline: '闘う、不動産パートナー。',
  catch: '購入から建築、そしてアフターサービスまで。お客様の未来を、ワンストップで共に築きます。',
  representative: '長谷川 光',
  founded: '2020年8月',
  site: 'https://martialarts.co.jp/',
  // 〔要確認〕公式の代表電話番号に差し替えてください
  tel: '〔要確認：代表電話〕',
  hours: '9:00〜18:00',
  address: '東京都港区赤坂2丁目12番17号 Martial Arts タワー',
  access: '東京メトロ 溜池山王駅 11番出口すぐ',
  areas: '首都圏（東京・神奈川・埼玉・千葉）を中心に東海エリアまで',
  contactNote: 'オンライン相談も承っています。担当者による対応をご希望の場合は、お電話または公式サイトのお問い合わせフォームをご利用ください。',
};

// ── サービス（6事業） ─────────────────────────────────────────
// flex.js のサービスカルーセル、および FAQ の詳細回答に使用。
export const SERVICES = [
  {
    id: 'baikyaku',
    icon: '🏠',
    label: '不動産買取・売却',
    tag: 'BUY & SELL',
    short: 'スピード査定・現金買取。住み替え・相続・訳あり物件までご相談ください。',
    detail:
      '【不動産買取・売却】\n' +
      '土地・中古マンション・中古戸建てを、当社が直接買い取ります。\n' +
      '・仲介ではなく買取なので、売却までがスピーディー\n' +
      '・住み替え／相続／離婚／住宅ローンのお悩みにも対応\n' +
      '・オンラインでの無料査定もOK\n\n' +
      'まずは「査定」と送っていただければ、査定の進め方をご案内します。',
    keywords: ['買取', '売却', '売りたい', '査定', '売る', '住み替え', '相続', 'マンション売', '家を売'],
  },
  {
    id: 'hanbai',
    icon: '🔑',
    label: '不動産販売・購入',
    tag: 'PURCHASE',
    short: '土地・中古マンション・戸建て。理想の住まい探しをプロがサポートします。',
    detail:
      '【不動産販売・購入】\n' +
      '土地・中古マンション・戸建てのご紹介から、住宅ローンのご相談までサポートします。\n' +
      '・ご予算・エリア・条件からお探しします\n' +
      '・購入後の建築・リフォームまでワンストップ\n' +
      '・法人契約の取り扱いも可能\n\n' +
      'ご希望条件を送っていただければ、担当よりご提案します。',
    keywords: ['購入', '買いたい', '物件', '販売', '土地', '戸建', 'マンション買', '住宅ローン', '探して'],
  },
  {
    id: 'kenchiku',
    icon: '🏗',
    label: '建築・リフォーム',
    tag: 'BUILD & RENOVATE',
    short: '新築・増改築・リノベーション。設計から施工まで自社体制で対応します。',
    detail:
      '【建築・リフォーム】\n' +
      '新築、増改築、フルリノベーションまで、設計から施工まで一貫して対応します。\n' +
      '・水回り／内装／外装のリフォーム\n' +
      '・中古購入 + リノベーションのセットプランもご提案\n' +
      '・施工事例は公式サイトの WORKS をご覧ください\n\n' +
      'ご相談内容（場所・ご希望・おおよその時期）を送ってください。',
    keywords: ['建築', 'リフォーム', 'リノベ', '新築', '増築', '改築', '工事したい', '直したい', '内装', '外壁'],
  },
  {
    id: 'solar',
    icon: '☀️',
    label: '太陽光発電',
    tag: 'SOLAR',
    short: '導入から運用・メンテナンスまで。光熱費と環境にやさしい暮らしを。',
    detail:
      '【太陽光発電】\n' +
      '太陽光発電システムの導入から運用・メンテナンスまで、包括的にサポートします。\n' +
      '・ご自宅の屋根に合わせた導入プランをご提案\n' +
      '・光熱費の削減と災害時の備えに\n' +
      '・導入後のメンテナンスも安心\n\n' +
      'ご興味があれば「太陽光」と送ってください。',
    keywords: ['太陽光', 'ソーラー', '発電', '光熱費', '蓄電', '電気代'],
  },
  {
    id: 'setsubi',
    icon: '🔧',
    label: '設備・サービス工事',
    tag: 'FACILITY',
    short: '住宅設備の設置・工事。暮らしの困りごとをワンストップで解決します。',
    detail:
      '【設備・サービス工事】\n' +
      '住宅設備の設置・入れ替え・各種工事に対応します。\n' +
      '・給湯器／エアコン／キッチン／バス などの設備工事\n' +
      '・不動産・建築とあわせてワンストップでご依頼可能\n\n' +
      'お困りの設備・ご希望を送ってください。',
    keywords: ['設備', '給湯器', 'エアコン', 'キッチン', 'お風呂', 'トイレ', '故障', '取り付け', '工事'],
  },
  {
    id: 'hoken',
    icon: '🛡',
    label: '保険（代理店）',
    tag: 'INSURANCE',
    short: '住まいの保険をスムーズに。売買・賃貸どちらの住まいにも対応します。',
    detail:
      '【保険（代理店事業）】\n' +
      '売買住宅・賃貸住宅にお住まいの方へ、住まいに関する保険をご案内します。\n' +
      '・火災保険／地震保険 などのご相談\n' +
      '・不動産のお手続きとあわせてスムーズにお申し込み\n\n' +
      'ご相談は「保険」と送ってください。',
    keywords: ['保険', '火災保険', '地震保険', '補償', '代理店'],
  },
];

// ── FAQ ルール ─────────────────────────────────────────────────
// - keywords: いずれか1語でもメッセージに含まれていればマッチ（部分一致・小文字化して比較）
// - 上から順に評価し、最初にマッチしたものを返す（具体的な項目を上に置くと精度が上がる）
// - flex: 指定があれば flex.js のビルダー名を返す（server.js が Flex メッセージを組み立てる）
// - answer: flex が無い / 補足したいときのテキスト
export const FAQ = [
  {
    id: 'services',
    label: 'サービス一覧',
    keywords: ['サービス', '事業', '何ができ', 'できること', 'メニュー', 'なにができ', '一覧', '会社は何'],
    flex: 'serviceCarousel',
    answer: `${COMPANY.name}の主なサービスです。気になるものをタップしてください。`,
  },
  // 各サービスの詳細（SERVICES から動的に生成し、この後ろに結合します）
  {
    id: 'consult',
    label: '無料相談・査定依頼',
    keywords: ['相談', '無料相談', '問い合わせ', '申込', '申し込み', '依頼', '見積', '見積り', '見積もり', '査定して', 'お願いしたい'],
    flex: 'ctaCard',
    answer:
      'ご相談・無料査定を承ります。以下のいずれかでお気軽にどうぞ。\n' +
      `・このトークに「ご相談内容」「お名前」「ご連絡先」を送る\n` +
      `・お電話：${COMPANY.tel}（${COMPANY.hours}）\n` +
      `・公式サイト：${COMPANY.site}\n\n` +
      '担当より折り返しご連絡します。オンライン相談も可能です。',
  },
  {
    id: 'company',
    label: '会社概要',
    keywords: ['会社概要', '会社情報', 'どんな会社', '代表', '設立', '会社について', 'martial', 'マーシャル'],
    answer:
      `${COMPANY.name}（${COMPANY.reading}）\n` +
      `${COMPANY.catch}\n\n` +
      `代表者：${COMPANY.representative}\n` +
      `設立：${COMPANY.founded}\n` +
      `所在地：${COMPANY.address}\n` +
      `事業エリア：${COMPANY.areas}\n` +
      `公式サイト：${COMPANY.site}`,
  },
  {
    id: 'access',
    label: 'アクセス',
    keywords: ['アクセス', '場所', '住所', 'どこ', '所在地', '地図', '行き方', '最寄り', '駅'],
    flex: 'accessCard',
    answer:
      `${COMPANY.name}\n${COMPANY.address}\n${COMPANY.access}\n\n公式サイト：${COMPANY.site}`,
  },
  {
    id: 'contact',
    label: '営業時間・連絡先',
    keywords: ['営業時間', '電話', '連絡先', 'つながらない', '担当', '人と話', 'オペレーター', '何時', '時間'],
    flex: 'contactCard',
    answer:
      `お電話：${COMPANY.tel}\n営業時間：${COMPANY.hours}\n所在地：${COMPANY.address}\n公式サイト：${COMPANY.site}\n\n${COMPANY.contactNote}`,
  },
  {
    id: 'online',
    label: 'オンライン相談',
    keywords: ['オンライン', 'リモート', 'zoom', 'ズーム', '来店しなくても', '遠方'],
    answer:
      'オンライン相談に対応しています。ご来店が難しい方も、ビデオ通話で査定やご相談が可能です。\n' +
      'ご希望の日時帯を送っていただければ、担当より調整のご連絡をします。',
  },
];

// SERVICES を FAQ の詳細ルールとして展開し、'services' の直後に差し込む。
const serviceRules = SERVICES.map((s) => ({
  id: `svc-${s.id}`,
  label: s.label,
  keywords: s.keywords,
  serviceId: s.id,
  answer: s.detail,
}));
FAQ.splice(1, 0, ...serviceRules);

// ── クイックリプライ用メニュー ─────────────────────────────────
export const MENU = [
  { label: 'サービス一覧', text: 'サービス一覧' },
  { label: '売却・査定', text: '査定' },
  { label: '物件を探す', text: '購入' },
  { label: '建築・リフォーム', text: 'リフォーム' },
  { label: '無料相談', text: '無料相談' },
  { label: 'アクセス', text: 'アクセス' },
];

// ── ユーティリティ ─────────────────────────────────────────────
function normalize(text) {
  return String(text ?? '').trim().toLowerCase();
}

// メッセージ本文に対して FAQ ルールを評価し、マッチした rule を返す。なければ null。
export function matchFaq(text) {
  const normalized = normalize(text);
  if (!normalized) return null;
  for (const rule of FAQ) {
    if (rule.keywords.some((kw) => normalized.includes(kw.toLowerCase()))) {
      return rule;
    }
  }
  return null;
}

export function getService(id) {
  return SERVICES.find((s) => s.id === id) || null;
}

// 友だち追加（follow）時のあいさつ本文（テキスト版フォールバック）
export function greetingText() {
  return (
    `友だち追加ありがとうございます！\n${COMPANY.name} 公式アカウントです。\n\n` +
    `${COMPANY.tagline}\n` +
    '不動産の売買・建築・リフォーム・太陽光・保険まで、住まいのことをワンストップでサポートします。\n\n' +
    '下のメニューから選ぶか、知りたいことをそのまま送ってください。'
  );
}

// マッチしなかったときの案内文
export function fallbackText() {
  return (
    'メッセージありがとうございます。うまく内容を読み取れませんでした。\n' +
    '下のメニューから選ぶか、「査定」「リフォーム」「太陽光」「無料相談」などのキーワードで送ってみてください。\n\n' +
    `お急ぎの場合はお電話ください：${COMPANY.tel}（${COMPANY.hours}）`
  );
}
