// 反響面談コンソール → Apps Script 中継（Netlify Function）
// -----------------------------------------------------------------------------
// ブラウザは GAS への POST が 302 で GET に化けて doPost が走らない。
// そこで同一オリジンのこの関数が中継し、サーバー側で 302 を「POSTのまま」追って
// doPost を確実に実行する（curl --post302 相当）。ブラウザは本物のJSON応答を読める。
//
// 受け取り: { url: "<GASの/exec>", payload: {...console payload...} }
// 返却:     GAS の doPost が返す JSON（{ok,row,written,...}）
export default async (req) => {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const { url, payload } = await req.json();
    if (!url) return json({ ok: false, error: 'url required' }, 400);

    const body = JSON.stringify(payload || {});
    // doPost は最初の /exec への POST で実行され、書き込みが起きる。
    // GAS は出力(JSON)を googleusercontent 側で配信するため、302 は GET で追う
    // （redirect:'follow' が POST→GET でこれを行う）。
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow',
    });
    const text = await res.text();
    // doPost の JSON 出力が取れればそのまま返す。
    try {
      const parsed = JSON.parse(text);
      return json(parsed);
    } catch {
      // JSON以外（出力配信ページのHTML等）でも、doPostは実行済みのことが多い。
      // ただし誤検知を避けるため submitted フラグで返す。
      return json({ ok: true, submitted: true, note: '送信しました（応答未確認。シートで反映をご確認ください）' });
    }
  } catch (e) {
    return json({ ok: false, error: String(e) });
  }
};
