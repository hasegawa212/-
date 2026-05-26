// 銀行審査 否決事例データセット
//
// 出典: 自社の Slack 全期間遡り調査（2024-07 〜 2026-04、30 件）
// 機微情報の取り扱い: 顧客名は匿名化（顧客 ID 化）。銀行名・市町村は公開情報のため保持。
//
// このデータは「過去にどんなパターンで否決が出たか／次にどう動いたか」の事例集として
// loanSimulator のリスク警告と次の打ち手推奨に使用する。
//
// 業務マニュアル「機微情報の取り扱い」ポリシー準拠:
//   - 個別顧客の属性詳細（年収・職業等）は記録しない
//   - 否決パターンの分類タグのみ記録

export type RejectionTag =
  | "property_road_access" // 接道義務違反・接面道路問題
  | "property_atemono" // 充て物審査（物件評価不足）
  | "property_kosenfuka" // 再建築不可
  | "property_kakaku" // 物件価格不適合（評価額より売出が高すぎ）
  | "borrower_employment" // 雇用契約・在籍証明不備
  | "borrower_single" // 単身者懸念
  | "borrower_dansin_kokuji" // 団信告知事項
  | "borrower_kojin_shin" // 個信記録（JICC・KSC・CIC）
  | "borrower_all_failed" // 全行・全保証会社で否決（属性に深刻な問題）
  | "product_mismatch" // 商品要件不一致
  | "unknown"; // 詳細未把握

export type NextActionType =
  | "switch_bank_same_tier" // 同種別他行
  | "switch_bank_lower_tier" // 銀行→信金など格下げ
  | "switch_to_flat35" // フラット 35 へ
  | "switch_to_nonbank" // ノンバンクへ
  | "switch_property" // 物件振替
  | "review_strategy" // 方向性再検討
  | "wait" // 待機（物件側の問題待ち）
  | "continue"; // 別行で継続

export interface RejectionCase {
  caseId: string; // 匿名化 ID
  customerCode: string; // 顧客匿名コード（同一顧客は同じコード）
  date: string; // YYYY-MM
  bankName: string;
  bankCategory: "megabank" | "regional" | "shinkin" | "nonbank" | "jhf" | "labor" | "ja" | "credit_union" | "other";
  tags: RejectionTag[];
  city: string; // 物件所在地市町村（公開情報レベル）
  nextAction: NextActionType;
  nextBankCategoryHint: string; // 次の動きの自由メモ（銀行カテゴリ）
  serialRejectionCount: number; // 同顧客で何回連続否決か
}

// 匿名化済み 30 ケース
export const REJECTION_CASES: RejectionCase[] = [
  // 顧客 A（旧 岸本 様）— 計 4 回否決
  { caseId: "R001", customerCode: "CUST-A", date: "2024-07", bankName: "水戸信用金庫", bankCategory: "shinkin", tags: ["property_atemono"], city: "牛久市", nextAction: "switch_bank_same_tier", nextBankCategoryHint: "茨城県信用組合", serialRejectionCount: 1 },
  { caseId: "R002", customerCode: "CUST-A", date: "2024-09", bankName: "茨城県信用組合", bankCategory: "credit_union", tags: ["unknown"], city: "土浦市", nextAction: "switch_to_nonbank", nextBankCategoryHint: "メロディ（ノンバンク）", serialRejectionCount: 2 },
  { caseId: "R003", customerCode: "CUST-A", date: "2024-10", bankName: "メロディ", bankCategory: "nonbank", tags: ["unknown"], city: "土浦市", nextAction: "review_strategy", nextBankCategoryHint: "方向性再検討", serialRejectionCount: 3 },
  { caseId: "R009", customerCode: "CUST-A", date: "2025-03", bankName: "中央労働金庫", bankCategory: "labor", tags: ["property_atemono"], city: "土浦市", nextAction: "switch_to_flat35", nextBankCategoryHint: "フラット 35", serialRejectionCount: 4 },

  // 顧客 B（旧 松本 様）— 計 5 回否決、最終的に全行全滅
  { caseId: "R004", customerCode: "CUST-B", date: "2024-10", bankName: "茨城県信用組合", bankCategory: "credit_union", tags: ["property_road_access"], city: "ひたちなか市", nextAction: "switch_bank_same_tier", nextBankCategoryHint: "水戸信用金庫で物件振替再申込", serialRejectionCount: 1 },
  { caseId: "R005", customerCode: "CUST-B", date: "2024-11", bankName: "水戸信用金庫", bankCategory: "shinkin", tags: ["unknown"], city: "日立市", nextAction: "switch_bank_same_tier", nextBankCategoryHint: "住信 SBI・常陽銀行", serialRejectionCount: 2 },
  { caseId: "R006", customerCode: "CUST-B", date: "2024-11", bankName: "常陽銀行", bankCategory: "regional", tags: ["unknown"], city: "日立市", nextAction: "continue", nextBankCategoryHint: "住信 SBI", serialRejectionCount: 3 },
  { caseId: "R007", customerCode: "CUST-B", date: "2025-01", bankName: "住信SBI銀行", bankCategory: "regional", tags: ["borrower_employment"], city: "日立市", nextAction: "review_strategy", nextBankCategoryHint: "雇用契約書なし→在籍証明書でも否決", serialRejectionCount: 4 },
  { caseId: "R008", customerCode: "CUST-B", date: "2025-02", bankName: "全金融機関", bankCategory: "other", tags: ["borrower_all_failed"], city: "-", nextAction: "switch_property", nextBankCategoryHint: "中古戸建で取り組み検討", serialRejectionCount: 5 },

  // 顧客 C（旧 松岡 様）— 計 5 回否決
  { caseId: "R010", customerCode: "CUST-C", date: "2025-04", bankName: "常陽銀行", bankCategory: "regional", tags: ["property_kakaku"], city: "-", nextAction: "switch_property", nextBankCategoryHint: "物件振替", serialRejectionCount: 1 },
  { caseId: "R013", customerCode: "CUST-C", date: "2025-04", bankName: "JA", bankCategory: "ja", tags: ["unknown"], city: "ひたちなか市", nextAction: "switch_bank_lower_tier", nextBankCategoryHint: "水戸信金・茨城県信", serialRejectionCount: 2 },
  { caseId: "R014", customerCode: "CUST-C", date: "2025-04", bankName: "中央労働金庫", bankCategory: "labor", tags: ["unknown"], city: "ひたちなか市", nextAction: "switch_bank_lower_tier", nextBankCategoryHint: "水戸信金・茨城県信", serialRejectionCount: 3 },
  { caseId: "R015", customerCode: "CUST-C", date: "2025-04", bankName: "水戸信用金庫", bankCategory: "shinkin", tags: ["unknown"], city: "ひたちなか市", nextAction: "switch_to_flat35", nextBankCategoryHint: "フラット 35", serialRejectionCount: 4 },
  { caseId: "R016", customerCode: "CUST-C", date: "2025-04", bankName: "茨城県信用組合", bankCategory: "credit_union", tags: ["unknown"], city: "ひたちなか市", nextAction: "switch_to_flat35", nextBankCategoryHint: "フラット 35（留保）", serialRejectionCount: 5 },

  // 顧客 D（旧 今飯田 様）
  { caseId: "R011", customerCode: "CUST-D", date: "2025-04", bankName: "茨城県信用組合", bankCategory: "credit_union", tags: ["unknown"], city: "古河市", nextAction: "continue", nextBankCategoryHint: "JA で契約本申込", serialRejectionCount: 1 },

  // 顧客 E（旧 荒木 様）
  { caseId: "R012", customerCode: "CUST-E", date: "2025-04", bankName: "佐賀銀行", bankCategory: "regional", tags: ["unknown"], city: "戸畑（北九州）", nextAction: "switch_bank_lower_tier", nextBankCategoryHint: "福岡ひびき信用金庫", serialRejectionCount: 1 },
  { caseId: "R017", customerCode: "CUST-E", date: "2025-04", bankName: "福岡ひびき信用金庫", bankCategory: "shinkin", tags: ["borrower_kojin_shin"], city: "戸畑（北九州）", nextAction: "switch_bank_same_tier", nextBankCategoryHint: "福岡銀行 web", serialRejectionCount: 2 },

  // 顧客 F（旧 笠井 様）— 計 5 回否決、最終 SBI ラスト
  { caseId: "R018", customerCode: "CUST-F", date: "2025-08", bankName: "JA", bankCategory: "ja", tags: ["unknown"], city: "-", nextAction: "switch_bank_same_tier", nextBankCategoryHint: "大東銀行", serialRejectionCount: 1 },
  { caseId: "R019", customerCode: "CUST-F", date: "2025-08", bankName: "栃木銀行", bankCategory: "regional", tags: ["unknown"], city: "-", nextAction: "switch_bank_same_tier", nextBankCategoryHint: "大東銀行", serialRejectionCount: 2 },
  { caseId: "R020", customerCode: "CUST-F", date: "2025-08", bankName: "烏山信用金庫", bankCategory: "shinkin", tags: ["unknown"], city: "-", nextAction: "switch_bank_same_tier", nextBankCategoryHint: "大東銀行", serialRejectionCount: 3 },
  { caseId: "R021", customerCode: "CUST-F", date: "2025-08", bankName: "栃木信用金庫", bankCategory: "shinkin", tags: ["unknown"], city: "-", nextAction: "switch_bank_same_tier", nextBankCategoryHint: "大東銀行", serialRejectionCount: 4 },
  { caseId: "R022", customerCode: "CUST-F", date: "2025-08", bankName: "SBIネット銀行", bankCategory: "regional", tags: ["unknown"], city: "-", nextAction: "switch_to_flat35", nextBankCategoryHint: "フラット 35", serialRejectionCount: 5 },

  // その他
  { caseId: "R023", customerCode: "CUST-G", date: "2025-08", bankName: "福銀", bankCategory: "regional", tags: ["unknown"], city: "福岡", nextAction: "continue", nextBankCategoryHint: "事前審査継続", serialRejectionCount: 1 },
  { caseId: "R024", customerCode: "CUST-H", date: "2025-08", bankName: "熊本ネット", bankCategory: "nonbank", tags: ["unknown"], city: "熊本", nextAction: "wait", nextBankCategoryHint: "物件待ち", serialRejectionCount: 1 },
  { caseId: "R025", customerCode: "CUST-I", date: "2025-10", bankName: "埼玉縣信用金庫", bankCategory: "shinkin", tags: ["borrower_single"], city: "-", nextAction: "switch_bank_same_tier", nextBankCategoryHint: "武蔵野・群馬銀行", serialRejectionCount: 1 },
  { caseId: "R026", customerCode: "CUST-J", date: "2025-11", bankName: "SBI銀行", bankCategory: "regional", tags: ["borrower_dansin_kokuji"], city: "-", nextAction: "switch_to_nonbank", nextBankCategoryHint: "ARUHI 不可・日本モーゲージ精査", serialRejectionCount: 1 },
  { caseId: "R027", customerCode: "CUST-K", date: "2025-11", bankName: "群馬銀行", bankCategory: "regional", tags: ["unknown"], city: "群馬", nextAction: "switch_bank_same_tier", nextBankCategoryHint: "東和銀行", serialRejectionCount: 1 },
  { caseId: "R028", customerCode: "CUST-L", date: "2026-02", bankName: "未公開", bankCategory: "other", tags: ["unknown"], city: "-", nextAction: "switch_property", nextBankCategoryHint: "柴崎建設へ物件振替", serialRejectionCount: 1 },
  { caseId: "R029", customerCode: "CUST-M", date: "2026-02", bankName: "水戸信用金庫", bankCategory: "shinkin", tags: ["property_kakaku"], city: "-", nextAction: "continue", nextBankCategoryHint: "物件価格調整で再審査", serialRejectionCount: 1 },
  { caseId: "R030", customerCode: "CUST-N", date: "2026-04", bankName: "SBI", bankCategory: "regional", tags: ["unknown"], city: "-", nextAction: "switch_property", nextBankCategoryHint: "手付金放棄で物件振替", serialRejectionCount: 1 },
];

// 統計サマリ
export function getRejectionStats() {
  const byTag: Record<string, number> = {};
  const byBank: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const c of REJECTION_CASES) {
    for (const t of c.tags) {
      byTag[t] = (byTag[t] || 0) + 1;
    }
    byBank[c.bankName] = (byBank[c.bankName] || 0) + 1;
    byCategory[c.bankCategory] = (byCategory[c.bankCategory] || 0) + 1;
  }

  return {
    totalCases: REJECTION_CASES.length,
    uniqueCustomers: new Set(REJECTION_CASES.map((c) => c.customerCode)).size,
    byTag,
    byBank,
    byCategory,
    serialRejectionMax: Math.max(...REJECTION_CASES.map((c) => c.serialRejectionCount)),
  };
}
