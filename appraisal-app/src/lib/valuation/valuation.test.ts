import { describe, it, expect } from "vitest";
import { appraiseRealEstate, walkFactor, buildingResidualRate } from "./realEstate";
import { appraiseCar, ageResidualRate, mileageFactor } from "./car";
import { estimateMonthlyRent, WARD_RENT_PER_SQM, WARD_RENT_AVERAGE } from "./wardRents";

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
