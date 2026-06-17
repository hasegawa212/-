/** 円を「○○万円」「○億○○万円」形式に整形する（査定額表示用） */
export function formatYen(value: number): string {
  const man = Math.round(value / 10000);
  if (man === 0) return "0円";
  const oku = Math.floor(man / 10000);
  const rest = man % 10000;
  if (oku > 0) {
    return rest > 0 ? `${oku}億${rest.toLocaleString()}万円` : `${oku}億円`;
  }
  return `${man.toLocaleString()}万円`;
}

/** 円を桁区切りの「￥1,234,567」形式に整形する（内訳表示用） */
export function formatYenFull(value: number): string {
  const sign = value < 0 ? "−" : "";
  return `${sign}￥${Math.abs(Math.round(value)).toLocaleString()}`;
}
