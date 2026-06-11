import { describe, it, expect } from "vitest";
import { appraiseRealEstate, walkFactor, buildingResidualRate } from "./realEstate";
import { appraiseCar, ageResidualRate, mileageFactor } from "./car";
import { estimateMonthlyRent, WARD_RENT_PER_SQM, WARD_RENT_AVERAGE } from "./wardRents";
import { evaluateInvestment } from "./investment";
import { parseBatchText, parseMyosoku, appraiseBatch, resolveCity, resolveStructure, parsePrice, parseArea, parseBuildAge, parseWalkMinutes, judge } from "./batch";
import { appraiseHybrid, appraiseByComparables } from "./comparables";
import { capRateForWard } from "./investment";
import { runBacktest, optimizeCompWeight, ACTUAL_SAMPLES } from "./backtest";

describe("不動産: 補正係数", () => {
  it("駅近は加点・駅遠は減点される", () => {
    expect(walkFactor(3)).toBeGreaterThan(1);
    expect(walkFactor(10)).toBe(1);
    expect(walkFactor(30)).toBeLessThan(1);
  });

  it("建物残存率は下限10%を下回らない", () => {
    expect(buildingResidualRate(0, 22)).toBe(1);
    expect(buildingResidualRate(11, 22)).toBeCloseTo(0.5, 5);
    expect(buildingResidualRate(100, 22)).toBe(0.1);
  });
});

describe("不動産: 査定", () => {
  it("新築の戸建は土地＋建物の合計になる", () => {
    const r = appraiseRealEstate({
      propertyType: "house",
      city: "つくば市",
      landArea: 150,
      buildingArea: 100,
      buildAge: 0,
      structure: "wood",
      walkMinutes: 10,
    });
    // 土地: 150 × 95,000 × 1.0 = 14,250,000
    // 建物: 100 × 180,000 × 1.0 = 18,000,000
    expect(r.estimate).toBe(32250000);
    expect(r.low).toBeLessThan(r.estimate);
    expect(r.high).toBeGreaterThan(r.estimate);
    expect(r.breakdown).toHaveLength(2);
  });

  it("土地のみは建物価格を含まない", () => {
    const r = appraiseRealEstate({
      propertyType: "land",
      city: "水戸市",
      landArea: 200,
      buildingArea: 0,
      buildAge: 0,
      structure: "wood",
      walkMinutes: 12,
    });
    // 200 × 72,000 × 0.93 = 13,392,000
    expect(r.estimate).toBe(13390000);
    expect(r.breakdown).toHaveLength(1);
  });

  it("築古の戸建は新築より安くなる", () => {
    const base = {
      propertyType: "house" as const,
      city: "水戸市",
      landArea: 150,
      buildingArea: 100,
      structure: "wood" as const,
      walkMinutes: 8,
    };
    const fresh = appraiseRealEstate({ ...base, buildAge: 0 });
    const old = appraiseRealEstate({ ...base, buildAge: 30 });
    expect(old.estimate).toBeLessThan(fresh.estimate);
  });

  it("首都圏エリアは茨城県より高く査定される", () => {
    const base = {
      propertyType: "apartment" as const,
      landArea: 0,
      buildingArea: 70,
      buildAge: 15,
      structure: "rc" as const,
      walkMinutes: 8,
    };
    const ibaraki = appraiseRealEstate({ ...base, city: "水戸市" });
    const tokyo = appraiseRealEstate({ ...base, city: "東京23区（都心部）" });
    expect(tokyo.estimate).toBeGreaterThan(ibaraki.estimate);
  });

  it("東京23区の中古マンションは相場（数千万円台）に収まる", () => {
    const r = appraiseRealEstate({
      propertyType: "apartment",
      city: "東京23区（その他）",
      landArea: 0,
      buildingArea: 70,
      buildAge: 15,
      structure: "rc",
      walkMinutes: 8,
    });
    // 70 × (600,000×2.4) × 残存率(1-15/47≈0.681) × 駅補正1.08
    expect(r.estimate).toBeGreaterThan(50000000);
    expect(r.estimate).toBeLessThan(100000000);
  });

  it("栃木県の物件も査定できる（宇都宮市は県内で最も高い）", () => {
    const base = {
      propertyType: "land" as const,
      landArea: 150,
      buildingArea: 0,
      buildAge: 0,
      structure: "wood" as const,
      walkMinutes: 10,
    };
    const utsunomiya = appraiseRealEstate({ ...base, city: "宇都宮市" });
    const other = appraiseRealEstate({ ...base, city: "その他（栃木県）" });
    // 150 × 58,000 × 1.0 = 8,700,000
    expect(utsunomiya.estimate).toBe(8700000);
    expect(utsunomiya.estimate).toBeGreaterThan(other.estimate);
  });

  it("未知の市区町村は『その他』単価にフォールバックする", () => {
    const r = appraiseRealEstate({
      propertyType: "land",
      city: "存在しない市",
      landArea: 100,
      buildingArea: 0,
      buildAge: 0,
      structure: "wood",
      walkMinutes: 10,
    });
    // 100 × 35,000 × 1.0
    expect(r.estimate).toBe(3500000);
  });
});

describe("自動車: 補正係数", () => {
  it("残価率カーブは線形補間され単調減少する", () => {
    expect(ageResidualRate(0)).toBe(1);
    expect(ageResidualRate(1)).toBeCloseTo(0.8, 5);
    expect(ageResidualRate(1.5)).toBeCloseTo(0.74, 5); // 0.80→0.68 の中点
    expect(ageResidualRate(100)).toBe(0.04);
    expect(ageResidualRate(9)).toBeLessThan(ageResidualRate(7));
  });

  it("走行距離が標準なら係数1、過走行で減点される", () => {
    expect(mileageFactor(30000, 3)).toBeCloseTo(1, 5); // 標準 = 3万km
    expect(mileageFactor(130000, 3)).toBeLessThan(1);
    expect(mileageFactor(10000, 3)).toBeGreaterThan(1);
  });

  it("走行距離補正は下限0.6でクランプされる", () => {
    expect(mileageFactor(1000000, 1)).toBe(0.6);
  });
});

describe("自動車: 査定", () => {
  const base = {
    newPrice: 2750000,
    firstYear: 2021,
    currentYear: 2026,
    mileageKm: 50000,
    maker: "トヨタ",
    repairHistory: false,
    inspectionMonthsLeft: 12,
  };

  it("基本ケースで妥当なレンジを返す", () => {
    const r = appraiseCar(base);
    expect(r.estimate).toBeGreaterThan(0);
    expect(r.estimate).toBeLessThan(base.newPrice);
    expect(r.low).toBeLessThan(r.estimate);
    expect(r.high).toBeGreaterThan(r.estimate);
  });

  it("修復歴ありは無しより安くなる", () => {
    const clean = appraiseCar(base);
    const damaged = appraiseCar({ ...base, repairHistory: true });
    expect(damaged.estimate).toBeLessThan(clean.estimate);
  });

  it("年式が古いほど安くなる", () => {
    const newer = appraiseCar({ ...base, firstYear: 2024 });
    const older = appraiseCar({ ...base, firstYear: 2016 });
    expect(older.estimate).toBeLessThan(newer.estimate);
  });

  it("査定額は新車価格の3%（下限）を下回らない", () => {
    const r = appraiseCar({
      ...base,
      firstYear: 2000,
      mileageKm: 400000,
      repairHistory: true,
      inspectionMonthsLeft: 0,
    });
    expect(r.estimate).toBeGreaterThanOrEqual(Math.round((base.newPrice * 0.03) / 10000) * 10000);
  });
});

describe("東京23区 賃料（SUUMO連携データ）", () => {
  it("都心区は周辺区より㎡賃料が高い", () => {
    expect(WARD_RENT_PER_SQM["港区"]).toBeGreaterThan(WARD_RENT_PER_SQM["足立区"]);
  });

  it("想定月額家賃は ㎡賃料 × 面積 で算出される", () => {
    expect(estimateMonthlyRent("港区", 30)).toBe(WARD_RENT_PER_SQM["港区"] * 30);
  });

  it("未対応エリアは23区平均にフォールバックする", () => {
    expect(estimateMonthlyRent("該当しない区", 25)).toBe(WARD_RENT_AVERAGE * 25);
  });
});

describe("投資区分: 利回り評価", () => {
  const base = {
    price: 25800000,
    ward: "港区",
    areaSqm: 25,
    monthlyRent: 72200,
    monthlyCost: 12000,
    monthlyLoan: 90000,
  };

  it("表面利回り = 年間家賃 / 価格", () => {
    const r = evaluateInvestment(base);
    expect(r.grossYield).toBeCloseTo((72200 * 12) / 25800000 * 100, 4);
    expect(r.rentSource).toBe("input");
  });

  it("都心の低利回り・赤字物件は『要注意』判定", () => {
    const r = evaluateInvestment(base);
    expect(r.monthlyCashflow).toBeLessThan(0);
    expect(r.rating).toBe("poor");
  });

  it("高利回り・黒字の地方型は『良好』判定", () => {
    const r = evaluateInvestment({
      price: 4500000,
      ward: "足立区",
      areaSqm: 30,
      monthlyRent: 28300,
      monthlyCost: 5000,
      monthlyLoan: 0,
    });
    expect(r.grossYield).toBeGreaterThan(5);
    expect(r.monthlyCashflow).toBeGreaterThan(0);
    expect(r.rating).toBe("good");
  });

  it("家賃未入力ならエリア相場から推定する", () => {
    const r = evaluateInvestment({ ...base, monthlyRent: undefined });
    expect(r.rentSource).toBe("estimated");
    expect(r.monthlyRent).toBe(WARD_RENT_PER_SQM["港区"] * 25);
  });
});

describe("一括査定（マイソク方式）", () => {
  it("価格文字列を円に正規化する", () => {
    expect(parsePrice("2080")).toBe(20800000);
    expect(parsePrice("2,080万")).toBe(20800000);
    expect(parsePrice("20800000")).toBe(20800000);
    expect(parsePrice("3330万円")).toBe(33300000);
  });

  it("所在地を市区町村キーへ解決する", () => {
    expect(resolveCity("水戸市浜田町1丁目")).toBe("水戸市");
    expect(resolveCity("川崎市麻生区高石")).toBe("横浜市・川崎市");
    expect(resolveCity("東京都港区芝")).toBe("東京23区（その他）");
    expect(resolveCity("どこか不明な町")).toBe("その他（茨城県）");
  });

  it("構造文字列を解決する", () => {
    expect(resolveStructure("木造")).toBe("wood");
    expect(resolveStructure("鉄骨造")).toBe("steel");
    expect(resolveStructure("RC")).toBe("rc");
  });

  it("乖離率から判定する", () => {
    expect(judge(-20)).toBe("undervalued");
    expect(judge(0)).toBe("fair");
    expect(judge(30)).toBe("overvalued");
  });

  it("TSVをパースして一括査定する", () => {
    const text = [
      "名称\t所在地\t土地面積\t建物面積\t築年数\t構造\t駅徒歩\t価格",
      "A邸\t水戸市浜田町\t160\t110\t12\t木造\t10\t3330万",
      "B邸\tひたちなか市佐和\t180\t100\t18\t木造\t15\t2390万",
    ].join("\n");
    const { rows, errors } = parseBatchText(text);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2); // 見出し行はスキップ
    const results = appraiseBatch(rows);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("A邸");
    expect(results[0].city).toBe("水戸市");
    expect(results[0].estimate).toBeGreaterThan(0);
    expect(["undervalued", "fair", "overvalued"]).toContain(results[0].verdict);
  });

  it("列数不足の行はエラーに記録する", () => {
    const { rows, errors } = parseBatchText("不完全な行\t水戸市\t160");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});

describe("マイソク本文パーサ（表記ゆれ）", () => {
  it("価格は万・億表記を円に正規化する", () => {
    expect(parsePrice("3,330万円")).toBe(33300000);
    expect(parsePrice("1億2,000万円")).toBe(120000000);
    expect(parsePrice("1.2億")).toBe(120000000);
  });

  it("面積は㎡・坪を㎡に正規化する", () => {
    expect(parseArea("160.25㎡")).toBe(160.25);
    expect(parseArea("70m²")).toBe(70);
    expect(parseArea("48.5坪")).toBeCloseTo(160.33, 1);
  });

  it("築年は築X年・西暦・和暦から経過年数を出す", () => {
    expect(parseBuildAge("築12年", 2026)).toBe(12);
    expect(parseBuildAge("2012年3月", 2026)).toBe(14);
    expect(parseBuildAge("平成17年6月", 2026)).toBe(21); // 平成17=2005
    expect(parseBuildAge("新築", 2026)).toBe(0);
  });

  it("交通文字列から徒歩分を抽出する", () => {
    expect(parseWalkMinutes("JR常磐線 水戸駅 徒歩10分")).toBe(10);
    expect(parseWalkMinutes("バス乗車15分 バス停より徒歩3分")).toBe(3);
    expect(parseWalkMinutes("バスのみ")).toBe(0);
  });

  it("ラベル付きマイソク本文（空行区切り）を複数物件としてパースする", () => {
    const text = [
      "物件名：水戸ハウスA",
      "所在地：茨城県水戸市浜田町1丁目2-3",
      "価格：3,330万円",
      "土地面積：160.25㎡（48.5坪）",
      "建物面積：110.5㎡",
      "築年月：2012年3月",
      "構造：木造2階建",
      "交通：JR常磐線 水戸駅 徒歩10分",
      "",
      "物件名：麻生レジデンス",
      "所在地：神奈川県川崎市麻生区高石4丁目",
      "価格：4,190万円",
      "専有面積：70.2㎡",
      "築年月：平成17年6月",
      "構造：RC造",
      "交通：小田急線 新百合ヶ丘駅 徒歩6分",
    ].join("\n");
    const { rows, errors } = parseMyosoku(text, 2026);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: "水戸ハウスA",
      landArea: 160.25,
      buildingArea: 110.5,
      buildAge: 14,
      structure: "wood",
      walkMinutes: 10,
      askingPrice: 33300000,
    });
    expect(rows[1].structure).toBe("rc");
    expect(rows[1].buildingArea).toBe(70.2);

    const results = appraiseBatch(rows);
    expect(results[0].city).toBe("水戸市");
    expect(results[1].city).toBe("横浜市・川崎市");
  });

  it("所在地も価格も無いブロックはエラーに記録する", () => {
    const { rows, errors } = parseMyosoku("構造：木造\n交通：徒歩5分");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});

describe("精度向上 v2", () => {
  it("車種リセール補正：係数>1 は標準より高く査定される", () => {
    const base = {
      newPrice: 3000000, firstYear: 2021, currentYear: 2026, mileageKm: 50000,
      maker: "トヨタ", repairHistory: false, inspectionMonthsLeft: 12,
    };
    const plain = appraiseCar({ ...base, resaleFactor: 1 });
    const strong = appraiseCar({ ...base, resaleFactor: 1.15 });
    expect(strong.estimate).toBeGreaterThan(plain.estimate);
  });

  it("リフォーム済み・上位グレードは建物価値を加点する", () => {
    const base = {
      propertyType: "house" as const, city: "水戸市", landArea: 150, buildingArea: 100,
      buildAge: 10, structure: "wood" as const, walkMinutes: 10,
    };
    const plain = appraiseRealEstate(base);
    const reno = appraiseRealEstate({ ...base, renovated: true });
    const lux = appraiseRealEstate({ ...base, grade: "luxury" });
    expect(reno.estimate).toBeGreaterThan(plain.estimate);
    expect(lux.estimate).toBeGreaterThan(plain.estimate);
  });

  it("土地のみはリフォーム/グレード補正の影響を受けない", () => {
    const base = {
      propertyType: "land" as const, city: "水戸市", landArea: 150, buildingArea: 0,
      buildAge: 0, structure: "wood" as const, walkMinutes: 10,
    };
    expect(appraiseRealEstate({ ...base, renovated: true, grade: "luxury" }).estimate).toBe(
      appraiseRealEstate(base).estimate
    );
  });

  it("収益還元法：都心区ほど還元利回りが低く、理論価格を返す", () => {
    expect(capRateForWard("港区")).toBeLessThan(capRateForWard("足立区"));
    expect(capRateForWard("水戸市")).toBeGreaterThan(capRateForWard("足立区"));
    const r = evaluateInvestment({
      price: 25800000, ward: "港区", areaSqm: 25, monthlyRent: 100000, monthlyCost: 12000, monthlyLoan: 0,
    });
    expect(r.capRate).toBe(3.8);
    expect(r.incomePrice).toBeGreaterThan(0);
  });

  it("取引事例比較法：事例のあるエリアは結果を返し、無いエリアはnull", () => {
    const mito = appraiseByComparables({
      propertyType: "house", city: "水戸市", landArea: 170, buildingArea: 105,
      buildAge: 12, structure: "wood", walkMinutes: 12,
    });
    expect(mito).not.toBeNull();
    expect(mito!.n).toBeGreaterThanOrEqual(2);
    const kasama = appraiseByComparables({
      propertyType: "house", city: "笠間市", landArea: 170, buildingArea: 105,
      buildAge: 12, structure: "wood", walkMinutes: 12,
    });
    expect(kasama).toBeNull();
  });

  it("ハイブリッド査定：事例ありはブレンド、事例なしは原価法と一致", () => {
    const withComps = appraiseHybrid({
      propertyType: "house", city: "水戸市", landArea: 170, buildingArea: 105,
      buildAge: 12, structure: "wood", walkMinutes: 12,
    });
    expect(withComps.estimate).toBeGreaterThan(0);
    expect(withComps.low).toBeLessThan(withComps.estimate);
    expect(withComps.high).toBeGreaterThan(withComps.estimate);

    const noComps = {
      propertyType: "house" as const, city: "笠間市", landArea: 170, buildingArea: 105,
      buildAge: 12, structure: "wood" as const, walkMinutes: 12,
    };
    expect(appraiseHybrid(noComps).estimate).toBe(appraiseRealEstate(noComps).estimate);
  });

  it("バックテスト：誤差指標を算出する", () => {
    const report = runBacktest(ACTUAL_SAMPLES);
    expect(report.n).toBe(ACTUAL_SAMPLES.length);
    expect(Number.isFinite(report.mape)).toBe(true);
    expect(report.mape).toBeLessThan(60);
    expect(report.rows).toHaveLength(ACTUAL_SAMPLES.length);
    // 参考: コンソールに精度サマリを出力
    console.log(`[backtest] n=${report.n} MAPE=${report.mape.toFixed(1)}% ±15%命中=${report.within15.toFixed(0)}%`);
  });
});

describe("ブレンド比率の最適化", () => {
  it("MAPEを最小化する事例比較の重みを探索する（既定0.55以下のMAPE）", () => {
    const opt = optimizeCompWeight(ACTUAL_SAMPLES);
    expect(opt.bestWeight).toBeGreaterThanOrEqual(0);
    expect(opt.bestWeight).toBeLessThanOrEqual(1);
    // 探索した最適重みは、既定(0.55)以下のMAPEになるはず
    expect(opt.bestMape).toBeLessThanOrEqual(opt.baselineMape + 1e-9);
    console.log(`[blend] best weight=${opt.bestWeight} MAPE=${opt.bestMape.toFixed(1)}% (baseline 0.55 → ${opt.baselineMape.toFixed(1)}%)`);
  });

  it("compWeight=1 は事例比較のみ、0 は原価法のみに一致する", () => {
    const input = {
      propertyType: "house" as const, city: "水戸市", landArea: 170, buildingArea: 105,
      buildAge: 12, structure: "wood" as const, walkMinutes: 12,
    };
    const compOnly = appraiseHybrid(input, undefined, 1).estimate;
    const costOnly = appraiseHybrid(input, undefined, 0).estimate;
    const comp = appraiseByComparables(input)!;
    expect(compOnly).toBe(comp.estimate);
    expect(costOnly).toBe(appraiseRealEstate(input).estimate);
  });
});

describe("品質: 事例カバレッジ拡張", () => {
  it("追加エリア（土浦/日立/さいたま/千葉/都心マンション）でも事例比較が効く", () => {
    const houseCities = ["土浦市", "日立市", "さいたま市", "千葉市"];
    for (const city of houseCities) {
      const r = appraiseByComparables({
        propertyType: "house", city, landArea: 160, buildingArea: 100,
        buildAge: 14, structure: "wood", walkMinutes: 14,
      });
      expect(r, city).not.toBeNull();
      expect(r!.n).toBeGreaterThanOrEqual(2);
    }
    const condo = appraiseByComparables({
      propertyType: "apartment", city: "東京23区（都心部）", landArea: 0, buildingArea: 60,
      buildAge: 12, structure: "rc", walkMinutes: 6,
    });
    expect(condo).not.toBeNull();
  });

  it("価格0の事例は比較対象から除外される", () => {
    const r = appraiseByComparables(
      { propertyType: "house", city: "X市", landArea: 150, buildingArea: 100, buildAge: 10, structure: "wood", walkMinutes: 10 },
      [
        { city: "X市", propertyType: "house", totalPrice: 0, landArea: 150, buildingArea: 100, buildAge: 10, walkMinutes: 10, tradeYear: 2024 },
        { city: "X市", propertyType: "house", totalPrice: 30000000, landArea: 160, buildingArea: 100, buildAge: 10, walkMinutes: 10, tradeYear: 2024 },
      ]
    );
    expect(r).toBeNull(); // 有効事例が1件→2件未満でnull
  });
});
