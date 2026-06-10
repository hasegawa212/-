import { useState } from "react";
import { Calculator, FileText } from "lucide-react";
import { parseBatchText, appraiseBatch, type BatchResultRow } from "@/lib/valuation";

interface Props {
  onResult: (rows: BatchResultRow[], errors: string[]) => void;
}

const SAMPLE = [
  "名称\t所在地\t土地面積\t建物面積\t築年数\t構造\t駅徒歩\t価格",
  "A邸\t水戸市浜田町1丁目\t160\t110\t12\t木造\t10\t3330万",
  "B邸\tひたちなか市佐和\t180\t100\t18\t木造\t15\t2390万",
  "C邸\t宇都宮市平出町\t200\t105\t8\t木造\t12\t2590万",
  "Dマンション\t川崎市麻生区\t0\t70\t20\tRC\t6\t4190万",
].join("\n");

export function BatchForm({ onResult }: Props) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { rows, errors } = parseBatchText(text);
    onResult(appraiseBatch(rows), errors);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <FileText className="h-4 w-4 text-brand-600" />
          マイソク情報を貼り付け（1行1物件・タブ/カンマ区切り）
        </div>
        <button
          type="button"
          onClick={() => setText(SAMPLE)}
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          サンプルを挿入
        </button>
      </div>

      <p className="text-xs text-slate-400">
        列順：<code>名称, 所在地, 土地面積(㎡), 建物面積(㎡), 築年数, 構造, 駅徒歩(分), 価格</code>
        <br />
        ※ 建物面積0は土地として査定。価格は「2080」「2,080万」どちらでも可。構造は木造/鉄骨/RC。
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="A邸　水戸市浜田町1丁目　160　110　12　木造　10　3330万 …"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        <Calculator className="h-4 w-4" />
        一括査定する
      </button>
    </form>
  );
}
