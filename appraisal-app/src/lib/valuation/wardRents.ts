// 東京23区 賃貸の㎡あたり家賃（円/㎡・月）
//
// ⚠ これは公開相場をもとにした「シード（概算）値」です。
// tools/suumo_scraper.py → tools/build_ward_rents.py を実行すると、
// SUUMO 取得データの区別中央値で本ファイルが自動的に上書きされ、実データ化されます。
// 査定アプリの賃料推定・投資利回り評価のベースデータとして用います。

export const WARD_RENT_PER_SQM: Record<string, number> = {
  千代田区: 5200,
  中央区: 4800,
  港区: 5500,
  新宿区: 4300,
  文京区: 4000,
  台東区: 3800,
  墨田区: 3400,
  江東区: 3600,
  品川区: 3900,
  目黒区: 4200,
  大田区: 3300,
  世田谷区: 3700,
  渋谷区: 5000,
  中野区: 3600,
  杉並区: 3400,
  豊島区: 3700,
  北区: 3200,
  荒川区: 3200,
  板橋区: 3000,
  練馬区: 3000,
  足立区: 2800,
  葛飾区: 2800,
  江戸川区: 2900,
};

export const WARD_RENT_WARDS = Object.keys(WARD_RENT_PER_SQM);

/** 23区平均の㎡賃料（未対応区のフォールバック） */
export const WARD_RENT_AVERAGE = 3752;

/** 指定エリア・専有面積から想定月額家賃（円）を推定する */
export function estimateMonthlyRent(ward: string, sqm: number): number {
  const unit = WARD_RENT_PER_SQM[ward] ?? WARD_RENT_AVERAGE;
  return Math.round(unit * sqm);
}
