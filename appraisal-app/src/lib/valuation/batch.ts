import { CITY_LAND_PRICE, STRUCTURE_SPEC } from "./data";
import { appraiseRealEstate } from "./realEstate";
import type { Structure } from "./types";

// マイソク方式の精密一括査定
//
// マイソク（物件概要書）の実スペック（所在地・土地/建物面積・築年・構造・駅徒歩・価格）を
// 貼り付けて、各物件を査定エンジンにかけ、提案価格との乖離から割安/適正/割高を判定する。

export type BatchVerdict = "undervalued" | "fair" | "overvalued";

export interface BatchRow {
  name: string;
  /** 生の所在地文字列（cityへ解決する） */
  rawLocation: string;
  landArea: number;
  buildingArea: number;
  buildAge: number;
  structure: Structure;
  walkMinutes: number;
  /** 提案価格（円） */
  askingPrice: number;
}

export interface BatchResultRow {
  name: string;
  city: string;
  askingPrice: number;
  estimate: number;
  low: number;
  high: number;
  /** (提案価格 − 査定額) / 査定額 × 100 */
  deviationPct: number;
  verdict: BatchVerdict;
}

export interface ParseOutcome {
  rows: BatchRow[];
  errors: string[];
}

/** 生の所在地文字列を CITY_LAND_PRICE のキーへ解決する */
export function resolveCity(raw: string): string {
  const keys = Object.keys(CITY_LAND_PRICE).filter((k) => !k.startsWith("その他") && !k.startsWith("東京"));
  // 市区町村名の直接マッチ（長いキー優先）
  const hit = keys
    .filter((k) => raw.includes(k.replace(/（.*）/, "")))
    .sort((a, b) => b.length - a.length)[0];
  if (hit) return hit;
  // 都県フォールバック
  if (raw.includes("東京")) return "東京23区（その他）";
  if (raw.includes("横浜") || raw.includes("川崎") || raw.includes("神奈川")) return "横浜市・川崎市";
  if (raw.includes("さいたま")) return "さいたま市";
  if (raw.includes("埼玉")) return "その他（埼玉県）";
  if (raw.includes("千葉")) return "その他（千葉県）";
  if (raw.includes("栃木")) return "その他（栃木県）";
  return "その他（茨城県）";
}

/** 構造文字列を Structure へ解決する */
export function resolveStructure(raw: string): Structure {
  const s = raw.toUpperCase();
  if (s.includes("RC") || raw.includes("鉄筋") || raw.includes("ＲＣ")) return "rc";
  if (raw.includes("鉄骨") || raw.includes("軽量") || raw.includes("重量") || s.includes("S造")) return "steel";
  return "wood";
}

/** 価格文字列を円へ正規化（"2080" / "2,080万" / "1億2,000万円" → 円） */
export function parsePrice(raw: string): number {
  const s = String(raw).replace(/[,，\s円]/g, "");
  // 1億2000万 / 1.2億
  const oku = s.match(/([\d.]+)億(?:([\d.]+)万)?/);
  if (oku) {
    let v = parseFloat(oku[1]) * 1e8;
    if (oku[2]) v += parseFloat(oku[2]) * 1e4;
    return Math.round(v);
  }
  const man = s.match(/([\d.]+)\s*万/);
  if (man) return Math.round(parseFloat(man[1]) * 10000);
  const num = s.match(/([\d.]+)/);
  if (!num) return 0;
  let v = parseFloat(num[1]);
  if (v < 100000) v = v * 10000; // 小さい値は万円表記とみなす
  return Math.round(v);
}

/** 面積文字列を㎡へ正規化（"160.25㎡" / "48.5坪" / "70m²" → ㎡） */
export function parseArea(raw: string): number {
  const s = String(raw).replace(/[,，\s]/g, "");
  const sqm = s.match(/([\d.]+)\s*(?:㎡|平米|平方メートル|m2|m²)/i);
  if (sqm) return parseFloat(sqm[1]);
  const tsubo = s.match(/([\d.]+)\s*坪/);
  if (tsubo) return Math.round(parseFloat(tsubo[1]) * 3.30578 * 100) / 100;
  const n = s.match(/([\d.]+)/);
  return n ? parseFloat(n[1]) : 0;
}

/** 築年（表記ゆれ対応: "築12年" / "2012年3月" / "平成24年" → 経過年数） */
export function parseBuildAge(raw: string, currentYear = new Date().getFullYear()): number {
  const s = String(raw);
  if (/新築/.test(s)) return 0;
  const chiku = s.match(/築\s*([\d]+)\s*年/);
  if (chiku) return parseInt(chiku[1], 10);
  // 西暦
  const seireki = s.match(/((?:19|20)\d{2})\s*年/);
  if (seireki) return Math.max(0, currentYear - parseInt(seireki[1], 10));
  // 和暦
  const wareki = s.match(/(令和|平成|昭和)\s*(元|\d+)\s*年/);
  if (wareki) {
    const n = wareki[2] === "元" ? 1 : parseInt(wareki[2], 10);
    const base: Record<string, number> = { 令和: 2018, 平成: 1988, 昭和: 1925 };
    return Math.max(0, currentYear - (base[wareki[1]] + n));
  }
  return 0;
}

/** 交通文字列から最寄駅徒歩分を抽出（"JR水戸駅 徒歩10分" → 10）。バスは0扱い。 */
export function parseWalkMinutes(raw: string): number {
  const m = String(raw).match(/徒歩\s*([\d]+)\s*分/);
  return m ? parseInt(m[1], 10) : 0;
}

function num(raw: string): number {
  const m = String(raw).replace(/[,，\s]/g, "").match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

/**
 * 貼り付けテキスト（TSV/CSV）を BatchRow[] に変換する。
 * 列順: 名称, 所在地, 土地面積, 建物面積, 築年数, 構造, 駅徒歩分, 価格
 * 先頭行が見出し（「名称」「所在地」「価格」を含む）なら読み飛ばす。
 */
export function parseBatchText(text: string): ParseOutcome {
  const rows: BatchRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  lines.forEach((line, i) => {
    // 見出し行はスキップ
    if (i === 0 && /名称|物件名/.test(line) && /所在地|住所/.test(line)) return;

    const cols = line.split(/\t|,|，/).map((c) => c.trim());
    if (cols.length < 8) {
      errors.push(`${i + 1}行目: 列数が不足しています（8列必要、実際 ${cols.length} 列）: ${line}`);
      return;
    }
    const [name, rawLocation, land, building, age, structure, walk, price] = cols;
    rows.push({
      name: name || `物件${i + 1}`,
      rawLocation,
      landArea: num(land),
      buildingArea: num(building),
      buildAge: num(age),
      structure: resolveStructure(structure),
      walkMinutes: num(walk),
      askingPrice: parsePrice(price),
    });
  });

  return { rows, errors };
}

/** ラベル付きブロックから、最初にマッチしたラベルの値を取り出す */
function pickLabel(block: string, labels: string[]): string {
  for (const label of labels) {
    // 「ラベル：値」「ラベル 値」（全角/半角コロン・空白・タブ区切り）
    const re = new RegExp(`(?:^|\\n)\\s*${label}\\s*[:：\\t]\\s*(.+)`);
    const m = block.match(re);
    if (m && m[1].trim()) return m[1].trim();
  }
  return "";
}

/**
 * マイソク本文（ラベル形式）を BatchRow[] に変換する。
 * 1物件 = 1ブロック。空行で物件を区切る。各物件は以下のようなラベル行を持つ:
 *   物件名：◯◯ / 所在地：◯◯ / 価格：3,330万円 / 土地面積：160㎡ /
 *   建物面積：110㎡ / 築年月：2012年3月 / 構造：木造 / 交通：◯◯駅 徒歩10分
 * 表記ゆれ（坪・億・和暦・徒歩分・各種ラベル別名）に対応する。
 */
export function parseMyosoku(text: string, currentYear = new Date().getFullYear()): ParseOutcome {
  const rows: BatchRow[] = [];
  const errors: string[] = [];
  // 空行でブロック分割。空行が無ければ全体を1物件とみなす。
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  blocks.forEach((block, i) => {
    const rawLocation = pickLabel(block, ["所在地", "住所", "所在"]);
    const priceRaw = pickLabel(block, ["販売価格", "売買価格", "価格", "金額"]);
    if (!rawLocation && !priceRaw) {
      errors.push(`${i + 1}番目のブロック: 所在地・価格が読み取れませんでした。`);
      return;
    }
    const landRaw = pickLabel(block, ["土地面積", "敷地面積", "土地"]);
    const buildingRaw = pickLabel(block, ["建物面積", "延床面積", "専有面積", "建物"]);
    const ageRaw = pickLabel(block, ["築年月", "建築年月", "築年数", "完成時期", "完成", "築年"]);
    const structureRaw = pickLabel(block, ["建物構造", "構造"]);
    const accessRaw = pickLabel(block, ["交通", "最寄駅", "最寄り駅", "アクセス"]);

    rows.push({
      name: pickLabel(block, ["物件名称", "物件名", "名称", "建物名"]) || `物件${i + 1}`,
      rawLocation,
      landArea: parseArea(landRaw),
      buildingArea: parseArea(buildingRaw),
      buildAge: parseBuildAge(ageRaw, currentYear),
      structure: resolveStructure(structureRaw),
      walkMinutes: parseWalkMinutes(accessRaw),
      askingPrice: parsePrice(priceRaw),
    });
  });

  return { rows, errors };
}

/** 乖離率から割安/適正/割高を判定する */
export function judge(deviationPct: number): BatchVerdict {
  if (deviationPct <= -5) return "undervalued";
  if (deviationPct >= 10) return "overvalued";
  return "fair";
}

/** BatchRow を査定して結果行を返す */
export function appraiseBatch(rows: BatchRow[]): BatchResultRow[] {
  return rows.map((r) => {
    const city = resolveCity(r.rawLocation);
    const res = appraiseRealEstate({
      propertyType: r.buildingArea > 0 ? "house" : "land",
      city,
      landArea: r.landArea,
      buildingArea: r.buildingArea,
      buildAge: r.buildAge,
      structure: r.structure,
      walkMinutes: r.walkMinutes,
    });
    const deviationPct = res.estimate > 0 ? ((r.askingPrice - res.estimate) / res.estimate) * 100 : 0;
    return {
      name: r.name,
      city,
      askingPrice: r.askingPrice,
      estimate: res.estimate,
      low: res.low,
      high: res.high,
      deviationPct,
      verdict: judge(deviationPct),
    };
  });
}

// STRUCTURE_SPEC を re-export 用途で参照（UIのラベル表示などで使う場合に備える）
export const BATCH_STRUCTURE_LABELS = Object.fromEntries(
  (Object.keys(STRUCTURE_SPEC) as Structure[]).map((k) => [k, STRUCTURE_SPEC[k].label])
) as Record<Structure, string>;
