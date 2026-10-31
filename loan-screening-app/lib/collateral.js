// 担保評価と物件の適格性。中古戸建は積算評価（土地＝路線価×面積、建物＝再調達単価×延床×残存年数÷耐用年数）
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LSA = root.LSA || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PROPERTY = {
    newHouse: { label: "新築戸建", house: true, isNew: true },
    usedHouse: { label: "中古戸建", house: true, isNew: false },
    landBuild: { label: "土地＋注文住宅", house: true, isNew: true },
    newMansion: { label: "新築マンション", house: false, isNew: true },
    usedMansion: { label: "中古マンション", house: false, isNew: false },
  };
  const STRUCTURE = { wood: "木造", steel: "鉄骨造", rc: "鉄筋コンクリート造" };
  const ZONE = { urban: "市街化区域", chosei: "市街化調整区域", none: "非線引き区域" };
  const PURPOSE = { own: "本人が住む", second: "セカンドハウス", invest: "投資用（人に貸す）" };

  const pick = (table, age) => { for (const [lim, r] of table) if (age < lim) return r; return table[table.length - 1][1]; };

  function appraise(x, P) {
    const price = +x.price || 0;
    const age = Math.max(0, +x.builtYears || 0);
    const p = PROPERTY[x.property] || PROPERTY.newHouse;
    if (+x.collateral > 0) return { method: "手入力", land: null, building: null, value: +x.collateral, rate: null };
    if (p.house && !p.isNew && +x.landArea > 0 && +x.rosenka > 0) {
      const st = STRUCTURE[x.structure] ? x.structure : "wood";
      const land = (+x.landArea) * (+x.rosenka) / 10000;
      const life = P.life[st], unit = P.unitCost[st];
      let building = unit * (+x.floor || 0) * Math.max(0, life - age) / life;
      if (x.oldQuake) building = 0;
      return { method: "積算", land, building, value: land + building, rate: null, life, unit };
    }
    let rate = p.isNew ? P.simpleRate.new : pick(p.house ? P.simpleRate.used : P.simpleRate.mansionUsed, age);
    if (x.oldQuake) rate -= P.simpleRate.oldQuake;
    return { method: p.isNew ? "価格" : "簡易", land: null, building: null, value: price * rate / 100, rate };
  }

  function eligibility(x, P) {
    const p = PROPERTY[x.property] || PROPERTY.newHouse;
    const knockouts = [];
    const checks = [];
    const add = (key, label, rule, value, status) => checks.push({ key, label, rule, value, status });

    const purpose = PURPOSE[x.purpose] ? x.purpose : "own";
    add("purpose", "用途", "本人が住むこと", PURPOSE[purpose], purpose === "invest" ? "ng" : purpose === "second" ? "warn" : "ok");
    if (purpose === "invest") knockouts.push("投資用（人に貸す）の物件には住宅ローンは使えない");

    if (p.house) {
      const road = x.road == null || x.road === "" ? 4 : +x.road;
      add("road", "接道", "幅4m以上の道路に2m以上接する", road + "m", road < 2 ? "ng" : "ok");
      if (road < 2) knockouts.push(`接道 ${road}m（建築基準法の接道義務2mを満たさない）`);
    }
    add("saikenchiku", "再建築", "建て替えができること", x.saikenchiku ? "再建築不可" : "可", x.saikenchiku ? "ng" : "ok");
    if (x.saikenchiku) knockouts.push("再建築不可の物件（担保として不適格）");

    add("overBuild", "建ぺい率・容積率", "超過していないこと", x.overBuild ? "超過あり" : "超過なし", x.overBuild ? "ng" : "ok");
    const zone = ZONE[x.zone] ? x.zone : "urban";
    add("zone", "区域", P.allowChosei ? "調整区域は個別に確認" : "市街化調整区域は原則不可", ZONE[zone], zone === "chosei" ? (P.allowChosei ? "warn" : "ng") : "ok");
    add("leasehold", "土地の権利", P.allowLeasehold ? "借地権は個別に確認" : "所有権であること", x.leasehold ? "借地権" : "所有権", x.leasehold ? (P.allowLeasehold ? "warn" : "ng") : "ok");
    const minF = p.house ? P.minFloorHouse : P.minFloorMansion;
    const floor = +x.floor || 0;
    if (floor > 0) add("floor", "床面積", `${minF}㎡以上`, floor + "㎡", floor >= minF ? "ok" : "ng");
    if (x.oldQuake) add("quake", "耐震基準", P.requireNewQuake ? "新耐震、または耐震評価で基準に適合" : "新耐震（1981年6月以降の建築確認）", "旧耐震", P.requireNewQuake ? "ng" : "warn");
    return { knockouts, checks };
  }

  return { PROPERTY, STRUCTURE, ZONE, PURPOSE, appraise, eligibility };
});
