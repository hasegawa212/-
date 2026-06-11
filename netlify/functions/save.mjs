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
    let target = url;
    let res;
    // 最大5回まで 302 を POST のまま手動追跡
    for (let i = 0; i < 5; i++) {
      res = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
        redirect: 'manual',
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) break;
        target = loc;
        continue;
      }
      break;
    }
    const text = await res.text();
    // GAS は JSON を返す想定。HTML が来たらエラーとして包む。
    try {
      JSON.parse(text);
      return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch {
      return json({ ok: false, error: 'GASがJSON以外を返しました', preview: text.slice(0, 200) });
    }
  } catch (e) {
    return json({ ok: false, error: String(e) });
  }
};
