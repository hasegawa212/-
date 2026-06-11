// =============================================================================
// ヒアリングシート フィールド定義（唯一のソース・オブ・トゥルース）
// -----------------------------------------------------------------------------
// この配列が「コンソールの入力項目」と「スプレッドシートの列」を 1:1 で対応づける。
// col   = ヒアリングシートのデータテーブル（25行目ヘッダ）の列。既存 53 列（A〜BA）。
// mergeInto = 専用列を持たない質的項目（エリア理由 / 絶対条件 / 希望条件 / 将来像）の
//         書き込み先列。保存時に「【ラベル】値」の形でその列へ追記する。
//         → シートの列を増やさずに Slack サマリーの全項目を取りこぼさないため。
// key   = フォーム / 保存ペイロードで使う内部キー。
// group = 画面のセクション。Slack サマリーの見出しと揃えてある（営業が迷わないように）。
//
// Apps Script 側は col 文字だけを見て書き込むため、列の意味の正は常にこのファイル。
// ★列を増減・並べ替えしたら apps-script/Code.gs の HEADERS と Google シート 25 行目も合わせる。
// =============================================================================

// 画面セクション（＝Slack サマリーの ■見出し と同じ並び）
export const GROUPS = [
  '受付・基本',
  '現状',
  '資金計画',
  '希望エリア・勤務',
  '物件条件',
  'ライフプラン・本音',
  '次アクション',
];

/**
 * @typedef {Object} Field
 * @property {string} col       ヒアリングシートの列（A〜BE）
 * @property {string} key       内部キー
 * @property {string} label     画面ラベル
 * @property {string} group     セクション（GROUPS のいずれか）
 * @property {'text'|'number'|'tel'|'date'|'select'|'textarea'} type
 * @property {string[]} [options]
 * @property {string} [placeholder]
 * @property {string} [help]
 * @property {boolean} [system] 自動入力（保存日時・URL）
 */

/** @type {Field[]} */
export const FIELDS = [
  // ── 受付・基本 ────────────────────────────────────────────────
  { col: 'A',  key: 'kinyubi',       label: '記入日',        group: '受付・基本', type: 'date' },
  { col: 'B',  key: 'hankyobi',      label: '反響日時',      group: '受付・基本', type: 'text', placeholder: '例）2026/6/7 17:41' },
  { col: 'C',  key: 'hankyomei',     label: '反響名（流入元）', group: '受付・基本', type: 'text', placeholder: '例）内見HP / SUUMO / インスタ / サイト予約フォーム' },
  { col: 'D',  key: 'tantosha',      label: '担当者',        group: '受付・基本', type: 'text' },
  { col: 'E',  key: 'okyakusamamei', label: 'お客様名',      group: '受付・基本', type: 'text' },
  { col: 'F',  key: 'furigana',      label: 'フリガナ',      group: '受付・基本', type: 'text' },
  { col: 'AR', key: 'renrakusaki',   label: '連絡先',        group: '受付・基本', type: 'tel', placeholder: '090-0000-0000' },
  { col: 'AS', key: 'renraku_ok',    label: '連絡可能時間',  group: '受付・基本', type: 'text', placeholder: '例）平日18時以降' },
  { col: 'AT', key: 'renraku_ng',    label: '連絡不可時間',  group: '受付・基本', type: 'text', placeholder: '例）無し' },

  // ── 現状 ──────────────────────────────────────────────────────
  { col: 'I',  key: 'genjukyo',      label: '現住居種別',    group: '現状', type: 'select', options: ['', '賃貸', '持ち家', '社宅', '実家', 'その他'] },
  { col: 'H',  key: 'genyachin',     label: '現家賃（万円/月）', group: '現状', type: 'number', placeholder: '例）8' },
  { col: 'G',  key: 'genjusho',      label: '現住所',        group: '現状', type: 'text', placeholder: '例）江東区南砂' },
  { col: 'AV', key: 'raiho_kikkake', label: 'きっかけ',      group: '現状', type: 'textarea', placeholder: '例）社宅からの切り替え' },
  { col: 'AM', key: 'kento_jiki',    label: '検討開始時期',  group: '現状', type: 'text', placeholder: '例）一ヶ月前' },
  { col: 'AK', key: 'naiken_keiken', label: '内見経験',      group: '現状', type: 'select', options: ['', 'なし', 'あり'] },
  { col: 'AL', key: 'tasha_hikaku',  label: '他社比較・問合せ', group: '現状', type: 'text', placeholder: '例）無し / 既に40社に当たって比較中' },

  // ── 資金計画 ──────────────────────────────────────────────────
  { col: 'O',  key: 'yosan_min',     label: '希望価格 下限（万円）', group: '資金計画', type: 'number' },
  { col: 'P',  key: 'yosan_max',     label: '希望価格 上限（万円）', group: '資金計画', type: 'number' },
  { col: 'L',  key: 'jikoshikin',    label: '自己資金/頭金（万円）', group: '資金計画', type: 'number' },
  { col: 'N',  key: 'yokin',         label: '預金額（万円）', group: '資金計画', type: 'number' },
  { col: 'M',  key: 'tsukizuki',     label: '月々支払（万円）', group: '資金計画', type: 'number' },
  { col: 'K',  key: 'loan_shubetsu', label: 'ローン種別',    group: '資金計画', type: 'select', options: ['', '単体', 'ペア', '親子', '合算'] },
  { col: 'Q',  key: 'kinmusaki',     label: '勤務先（会社名）', group: '資金計画', type: 'text' },
  { col: 'T',  key: 'nyusha_jiki',   label: '入社時期',      group: '資金計画', type: 'text', placeholder: '例）2000年4月 / 5年目' },
  { col: 'S',  key: 'koyo_keitai',   label: '雇用形態',      group: '資金計画', type: 'select', options: ['', '会社員（正社員）', '会社員（契約）', '派遣', 'アルバイト', '自営業', '経営者', 'その他'] },
  { col: 'U',  key: 'gensen_a',      label: 'R7源泉額A（万円）', group: '資金計画', type: 'number', help: '本人分' },
  { col: 'V',  key: 'gensen_b',      label: 'R7源泉額B（万円）', group: '資金計画', type: 'number', help: 'ペア/合算相手分' },
  { col: 'W',  key: 'kinyukikan',    label: '取引金融機関',   group: '資金計画', type: 'text', placeholder: '例）三井住友 / UFJ' },
  { col: 'X',  key: 'kizon_kariire', label: '既存借入',      group: '資金計画', type: 'text', placeholder: '例）特に無し / 車10万 分割' },
  { col: 'Y',  key: 'entai',         label: '延滞履歴',      group: '資金計画', type: 'select', options: ['', 'なし', 'あり'] },
  { col: 'Z',  key: 'kakutei_shinkoku', label: '確定申告',  group: '資金計画', type: 'select', options: ['', 'なし', 'あり'] },
  { col: 'AA', key: 'kokka_shikaku', label: '国家資格',      group: '資金計画', type: 'text', placeholder: '例）無し / 公認心理士' },

  // ── 希望エリア・勤務 ──────────────────────────────────────────
  { col: 'AB', key: 'kibo_area',     label: '希望エリア',    group: '希望エリア・勤務', type: 'text', placeholder: '例）東西線か新宿線沿い' },
  { mergeInto: 'AY', key: 'area_riyu', label: 'エリア理由',  group: '希望エリア・勤務', type: 'text', placeholder: '例）日本橋へのアクセスを優先' },
  { col: 'R',  key: 'kinmuchi',      label: '勤務地',        group: '希望エリア・勤務', type: 'text', placeholder: '例）日本橋 / 固定は無し' },
  { col: 'AC', key: 'kyoyo_tsukin',  label: '許容通勤（分）', group: '希望エリア・勤務', type: 'number' },
  { col: 'AD', key: 'eki_toho',      label: '駅まで徒歩（分）', group: '希望エリア・勤務', type: 'number' },
  { col: 'AE', key: 'tsukin_shudan', label: '通勤手段',      group: '希望エリア・勤務', type: 'select', options: ['', '電車', '徒歩', '車', '自転車'] },

  // ── 物件条件 ──────────────────────────────────────────────────
  { col: 'AF', key: 'bukken_shubetsu', label: '物件種別',    group: '物件条件', type: 'text', placeholder: '注文住宅・新築建売 / 土地・戸建・マンション' },
  { col: 'AG', key: 'madori',        label: '間取り',        group: '物件条件', type: 'text', placeholder: '例）3LDKか2LDK' },
  { col: 'AH', key: 'kaisu',         label: '階数',          group: '物件条件', type: 'text', placeholder: '例）2階建' },
  { col: 'AI', key: 'chushajo',      label: '駐車場（台）',  group: '物件条件', type: 'number' },
  { mergeInto: 'AY', key: 'zettai_joken', label: '絶対条件', group: '物件条件', type: 'textarea', placeholder: '例）駐車場・新築のみ' },
  { mergeInto: 'AY', key: 'kibo_joken', label: '希望条件',   group: '物件条件', type: 'textarea', placeholder: '例）庭・テラス・ペット可' },
  { col: 'AJ', key: 'kinrin_shogyo', label: '近隣希望商業施設', group: '物件条件', type: 'text', placeholder: '例）スーパーが近くにあるといい' },

  // ── ライフプラン・本音 ────────────────────────────────────────
  { col: 'J',  key: 'kazoku',        label: '家族構成',      group: 'ライフプラン・本音', type: 'text', placeholder: '単身・配偶者・お子様（　歳）・親' },
  { col: 'AU', key: 'oyago_chiiki',  label: '親御様居住地域', group: 'ライフプラン・本音', type: 'text', placeholder: '例）大阪 / 同居予定なし' },
  { col: 'AW', key: 'douki',         label: '家を買う動機',  group: 'ライフプラン・本音', type: 'textarea' },
  { mergeInto: 'AY', key: 'shorai_zo', label: '将来像',      group: 'ライフプラン・本音', type: 'textarea', placeholder: '例）静かに暮らしたい' },
  { col: 'AX', key: 'kenen',         label: '懸念・不安',    group: 'ライフプラン・本音', type: 'textarea' },

  // ── 次アクション ──────────────────────────────────────────────
  { col: 'AN', key: 'naiken_kanou1', label: '内見候補①',    group: '次アクション', type: 'text', placeholder: '6月27日(土)14:00' },
  { col: 'AO', key: 'naiken_kanou2', label: '内見候補②',    group: '次アクション', type: 'text', placeholder: '6月28日(日)13:00' },
  { col: 'AP', key: 'naiken_kakutei', label: '★確定内見日時', group: '次アクション', type: 'text', placeholder: '6月27日(土)14:00' },
  { col: 'AQ', key: 'doukousha',     label: '同行者',        group: '次アクション', type: 'text', placeholder: '例）本人のみ / 配偶者' },
  { col: 'AY', key: 'biko',          label: '備考',          group: '次アクション', type: 'textarea' },

  // ── システム（自動入力）──────────────────────────────────────
  { col: 'AZ', key: 'hozon_nichiji', label: '保存日時',      group: '次アクション', type: 'text', system: true, help: '保存時に自動記録' },
  { col: 'BA', key: 'etsuran_url',   label: '閲覧URL',       group: '次アクション', type: 'text', system: true, help: 'セッションURL（自動）' },
];

// ── 整合性チェック（専用列の重複が無いこと）─────────────────────
const _cols = FIELDS.filter((f) => f.col).map((f) => f.col);
if (new Set(_cols).size !== _cols.length) {
  throw new Error('FIELDS: 列(col)が重複しています');
}

/** col(列文字) → key の対応表（専用列を持つ項目のみ） */
export const COL_TO_KEY = Object.fromEntries(FIELDS.filter((f) => f.col).map((f) => [f.col, f.key]));
