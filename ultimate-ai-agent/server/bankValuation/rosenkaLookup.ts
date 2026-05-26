// 路線価の住所→価格推定（PR #16）
//
// 設計方針:
//   - 第一段階（本実装）: 住所文字列から都道府県・市区町村を抽出し、
//     公示地価ベースの代表値テーブルから路線価を推定（精度: low〜medium）
//   - 第二段階（将来）: 国税庁路線価図 API / 国土数値情報 API への置換
//     → lookupRosenka() の実装を差し替えるだけで対応可能な抽象化
//
// 路線価推定値は 2026 年公示地価（住宅地・平均）× 0.8 ベース。
// 実際の路線価は街区単位で大きく振れるため、必ず実際の路線価図で
// 確認した上で使用すること（脱属人化原則⑥ 数値の根拠を明示）。

export type LookupConfidence = "high" | "medium" | "low" | "none";

export interface RosenkaLookupResult {
  rosenkaPerSqm: number; // 推定路線価（円/㎡）。0 なら推定不能
  confidence: LookupConfidence;
  parsedPrefecture: string | null;
  parsedCity: string | null;
  matchedKey: string | null; // どの代表値レコードにマッチしたか
  source: string; // データソース説明
  note: string; // 推定の妥当性・注意点
}

// 主要エリア別 路線価代表値（円/㎡）
// 2026 年公示地価（住宅地・平均）× 0.8 から算出（公開情報ベース）
// 街区単位の実路線価とは大きく異なる場合があるため、必ず実図確認すること

interface AreaRecord {
  key: string; // 都道府県 or 市区町村名（完全一致 or 含有チェック）
  rosenka: number;
  confidence: LookupConfidence;
}

const TOKYO_WARDS: AreaRecord[] = [
  { key: "千代田区", rosenka: 1_500_000, confidence: "medium" },
  { key: "中央区", rosenka: 1_200_000, confidence: "medium" },
  { key: "港区", rosenka: 1_800_000, confidence: "medium" },
  { key: "新宿区", rosenka: 800_000, confidence: "medium" },
  { key: "文京区", rosenka: 700_000, confidence: "medium" },
  { key: "渋谷区", rosenka: 900_000, confidence: "medium" },
  { key: "豊島区", rosenka: 600_000, confidence: "medium" },
  { key: "目黒区", rosenka: 700_000, confidence: "medium" },
  { key: "品川区", rosenka: 600_000, confidence: "medium" },
  { key: "世田谷区", rosenka: 500_000, confidence: "medium" },
  { key: "杉並区", rosenka: 450_000, confidence: "medium" },
  { key: "中野区", rosenka: 500_000, confidence: "medium" },
  { key: "練馬区", rosenka: 350_000, confidence: "medium" },
  { key: "板橋区", rosenka: 350_000, confidence: "medium" },
  { key: "北区", rosenka: 400_000, confidence: "medium" },
  { key: "荒川区", rosenka: 400_000, confidence: "medium" },
  { key: "台東区", rosenka: 700_000, confidence: "medium" },
  { key: "墨田区", rosenka: 400_000, confidence: "medium" },
  { key: "江東区", rosenka: 450_000, confidence: "medium" },
  { key: "葛飾区", rosenka: 280_000, confidence: "medium" },
  { key: "江戸川区", rosenka: 300_000, confidence: "medium" },
  { key: "足立区", rosenka: 280_000, confidence: "medium" },
  { key: "大田区", rosenka: 400_000, confidence: "medium" },
];

const MAJOR_CITIES: AreaRecord[] = [
  // 政令市
  { key: "横浜市", rosenka: 250_000, confidence: "low" },
  { key: "川崎市", rosenka: 280_000, confidence: "low" },
  { key: "さいたま市", rosenka: 200_000, confidence: "low" },
  { key: "千葉市", rosenka: 150_000, confidence: "low" },
  { key: "大阪市", rosenka: 350_000, confidence: "low" },
  { key: "京都市", rosenka: 250_000, confidence: "low" },
  { key: "神戸市", rosenka: 200_000, confidence: "low" },
  { key: "名古屋市", rosenka: 200_000, confidence: "low" },
  { key: "福岡市", rosenka: 180_000, confidence: "low" },
  { key: "札幌市", rosenka: 100_000, confidence: "low" },
  { key: "仙台市", rosenka: 120_000, confidence: "low" },
  { key: "広島市", rosenka: 130_000, confidence: "low" },
  { key: "北九州市", rosenka: 70_000, confidence: "low" },
  // 茨城（CLAUDE.md context）
  { key: "水戸市", rosenka: 80_000, confidence: "low" },
  { key: "つくば市", rosenka: 90_000, confidence: "low" },
  { key: "土浦市", rosenka: 60_000, confidence: "low" },
  { key: "ひたちなか市", rosenka: 55_000, confidence: "low" },
  { key: "古河市", rosenka: 55_000, confidence: "low" },
];

// 都道府県別フォールバック（市区町村マッチしなかった場合）
const PREFECTURE_FALLBACK: AreaRecord[] = [
  { key: "東京都", rosenka: 400_000, confidence: "low" }, // 23 区平均（区抽出失敗時）
  { key: "神奈川県", rosenka: 180_000, confidence: "low" },
  { key: "千葉県", rosenka: 100_000, confidence: "low" },
  { key: "埼玉県", rosenka: 120_000, confidence: "low" },
  { key: "大阪府", rosenka: 200_000, confidence: "low" },
  { key: "京都府", rosenka: 130_000, confidence: "low" },
  { key: "兵庫県", rosenka: 130_000, confidence: "low" },
  { key: "愛知県", rosenka: 120_000, confidence: "low" },
  { key: "福岡県", rosenka: 100_000, confidence: "low" },
  { key: "北海道", rosenka: 60_000, confidence: "low" },
  { key: "宮城県", rosenka: 70_000, confidence: "low" },
  { key: "茨城県", rosenka: 50_000, confidence: "low" },
  { key: "栃木県", rosenka: 50_000, confidence: "low" },
  { key: "群馬県", rosenka: 50_000, confidence: "low" },
];

const ALL_PREFECTURES = [
  "北海道",
  "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

function parseAddress(address: string): { prefecture: string | null; city: string | null } {
  const normalized = address.trim();
  const pref = ALL_PREFECTURES.find((p) => normalized.includes(p)) ?? null;

  let city: string | null = null;
  // 市区町村抽出: ●●市 / ●●区 / ●●町 / ●●村 のうち最初のマッチ
  const cityMatch = normalized.match(/([^\s\d]{1,8}(?:市|区|町|村))/);
  if (cityMatch) city = cityMatch[1];

  return { prefecture: pref, city };
}

export function lookupRosenka(address: string): RosenkaLookupResult {
  if (!address || address.trim().length === 0) {
    return {
      rosenkaPerSqm: 0,
      confidence: "none",
      parsedPrefecture: null,
      parsedCity: null,
      matchedKey: null,
      source: "input empty",
      note: "住所が入力されていません",
    };
  }

  const { prefecture, city } = parseAddress(address);

  // 1. 東京 23 区 を最優先で照合
  if (city) {
    const ward = TOKYO_WARDS.find((w) => city.includes(w.key) || address.includes(w.key));
    if (ward) {
      return {
        rosenkaPerSqm: ward.rosenka,
        confidence: ward.confidence,
        parsedPrefecture: "東京都",
        parsedCity: ward.key,
        matchedKey: ward.key,
        source: "2026 年公示地価（住宅地・平均）× 0.8 ベース",
        note: "23 区代表値。街区により大きく異なるため、実路線価図で要確認。",
      };
    }
  }

  // 2. 主要市区町村
  if (city) {
    const m = MAJOR_CITIES.find((c) => city.includes(c.key) || address.includes(c.key));
    if (m) {
      return {
        rosenkaPerSqm: m.rosenka,
        confidence: m.confidence,
        parsedPrefecture: prefecture,
        parsedCity: m.key,
        matchedKey: m.key,
        source: "2026 年公示地価（住宅地・平均）× 0.8 ベース",
        note: "市域全体の代表値。中心市街地・郊外で大きく異なる。",
      };
    }
  }

  // 3. 都道府県フォールバック
  if (prefecture) {
    const p = PREFECTURE_FALLBACK.find((r) => r.key === prefecture);
    if (p) {
      return {
        rosenkaPerSqm: p.rosenka,
        confidence: "low",
        parsedPrefecture: prefecture,
        parsedCity: city,
        matchedKey: prefecture,
        source: "都道府県平均からの概算",
        note: "市区町村が代表値テーブルに無いため都道府県平均で代用。精度低・要実測。",
      };
    }
    // 都道府県の代表値も無い場合
    return {
      rosenkaPerSqm: 40_000,
      confidence: "low",
      parsedPrefecture: prefecture,
      parsedCity: city,
      matchedKey: null,
      source: "全国地方平均からの概算",
      note: "代表値テーブル外の地域。地方住宅地平均で代用。精度極低。",
    };
  }

  // 4. 何もマッチしない
  return {
    rosenkaPerSqm: 0,
    confidence: "none",
    parsedPrefecture: null,
    parsedCity: city,
    matchedKey: null,
    source: "no match",
    note: "都道府県名が抽出できませんでした。住所を「東京都港区六本木...」のように記入してください。",
  };
}
