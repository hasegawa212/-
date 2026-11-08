/* Halo Burst — ゲームのルール（純粋関数）。ブラウザでは window.HB、Node では require で使う。 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HB = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RULES = {
    duration: 60,          // 秒
    base: 100,             // 1 個あたりの基本点
    centerRatio: 0.35,     // 半径のこの割合より内側 = 中心ヒット（2倍）
    goldChance: 0.1,       // 金のリング（3倍）
    lifeStart: 1.9,        // リングが消えるまでの秒数（開始時）
    lifeEnd: 0.9,          //            （終了時）
    spawnStart: 0.9,       // 出現間隔（秒）
    spawnEnd: 0.38,
  };

  function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

  /** 経過時間 t 秒のときの難しさ */
  function difficulty(t) {
    var k = t / RULES.duration;
    return { life: lerp(RULES.lifeStart, RULES.lifeEnd, k), spawn: lerp(RULES.spawnStart, RULES.spawnEnd, k) };
  }

  /** コンボ倍率: 5 連続ごとに +1（最大 ×5） */
  function multiplier(combo) { return Math.min(5, 1 + Math.floor(combo / 5)); }

  /** リングの今の半径（出現時 r0 → 寿命で 0 に縮む） */
  function radiusAt(ring, now) {
    var k = (now - ring.born) / ring.life;
    return k >= 1 ? 0 : ring.r0 * (1 - k);
  }

  /**
   * クリック判定。いちばん手前（新しい）のリングから見る。
   * 戻り値: { index, center, points, combo } / 外れなら { index: -1, combo: 0 }
   */
  function hit(rings, x, y, now, combo) {
    for (var i = rings.length - 1; i >= 0; i--) {
      var g = rings[i], r = radiusAt(g, now);
      if (r <= 0) continue;
      var d = Math.hypot(x - g.x, y - g.y);
      if (d <= r) {
        var center = d <= r * RULES.centerRatio;
        var next = combo + 1;
        var pts = RULES.base * multiplier(next) * (center ? 2 : 1) * (g.gold ? 3 : 1);
        return { index: i, center: center, points: pts, combo: next };
      }
    }
    return { index: -1, center: false, points: 0, combo: 0 };
  }

  function rank(score) {
    if (score >= 30000) return "S";
    if (score >= 18000) return "A";
    if (score >= 9000) return "B";
    if (score >= 3000) return "C";
    return "D";
  }

  return { RULES: RULES, difficulty: difficulty, multiplier: multiplier, radiusAt: radiusAt, hit: hit, rank: rank };
});
