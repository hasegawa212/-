import { useState } from "react";
import { Calculator, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import {
  parseBatchText,
  parseMyosoku,
  appraiseBatch,
  type BatchResultRow,
} from "@/lib/valuation";
import { SegmentedControl } from "./ui/SegmentedControl";

interface Props {
  onResult: (rows: BatchResultRow[], errors: string[]) => void;
}

type InputFormat = "table" | "myosoku";

const SAMPLE_TABLE = [
  "名称\t所在地\t土地面積\t建物面積\t築年数\t構造\t駅徒歩\t価格",
  "A邸\t水戸市浜田町1丁目\t160\t110\t12\t木造\t10\t3330万",
  "B邸\tひたちなか市佐和\t180\t100\t18\t木造\t15\t2390万",
  "C邸\t宇都宮市平出町\t200\t105\t8\t木造\t12\t2590万",
  "Dマンション\t川崎市麻生区\t0\t70\t20\tRC\t6\t4190万",
].join("\n");

const SAMPLE_MYOSOKU = [
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
  "土地面積：0㎡",
  "専有面積：70.2㎡",
  "築年月：平成17年6月",
  "構造：RC造",
  "交通：小田急線 新百合ヶ丘駅 徒歩6分",
].join("\n");

export function BatchForm({ onResult }: Props) {
  const [format, setFormat] = useState<InputFormat>("table");
  const [text, setText] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { rows, errors } = format === "myosoku" ? parseMyosoku(text) : parseBatchText(text);
    onResult(appraiseBatch(rows), errors);
  }

  function insertSample() {
    setText(format === "myosoku" ? SAMPLE_MYOSOKU : SAMPLE_TABLE);
  }

  function changeFormat(next: InputFormat) {
    setFormat(next);
    setText("");
  }

  /** マイソク画像をブラウザ内OCR（Tesseract.js）でテキスト化し、マイソク欄へ流し込む */
  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // 同じ画像を再選択できるように
    if (files.length === 0) return;
    setOcrBusy(true);
    setFormat("myosoku");
    try {
      // Tesseract は重いので動的import（初回のみCDNから日本語データ取得）
      const Tesseract = (await import("tesseract.js")).default;
      const blocks: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setOcrStatus(`画像 ${i + 1}/${files.length} を解析中…`);
        const { data } = await Tesseract.recognize(files[i], "jpn+eng", {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") {
              setOcrStatus(`画像 ${i + 1}/${files.length} を解析中… ${Math.round(m.progress * 100)}%`);
            }
          },
        });
        blocks.push((data.text || "").trim());
      }
      // 複数画像は空行区切り（＝マイソク本文パーサの物件区切り）で結合し、既存テキストに追記
      const ocr = blocks.filter(Boolean).join("\n\n");
      setText((prev) => (prev.trim() ? prev.trim() + "\n\n" + ocr : ocr));
      setOcrStatus("読み取り完了。内容を確認・修正してから査定してください。");
    } catch (err) {
      setOcrStatus("OCRに失敗しました。画質を上げるか、本文を手入力してください。");
    } finally {
      setOcrBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-brand-200/60 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <FileText className="h-4 w-4 text-brand-600" />
          マイソク情報を入力
        </div>
        <SegmentedControl
          options={[
            { value: "table", label: "表形式" },
            { value: "myosoku", label: "マイソク本文" },
          ]}
          value={format}
          onChange={(v) => changeFormat(v as InputFormat)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-brand-200 bg-brand-50/40 p-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 shadow-sm transition hover:border-gold-400">
          {ocrBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4 text-gold-500" />}
          マイソク画像から読み取り（β）
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={ocrBusy}
            onChange={handleImage}
          />
        </label>
        <span className="text-xs text-brand-400">
          {ocrStatus || "画像を選ぶと文字を自動抽出 → 下に流し込みます（精度は画質依存・要確認）。"}
        </span>
      </div>

      {format === "table" ? (
        <p className="text-xs text-slate-400">
          1行1物件・タブ/カンマ区切り。列順：
          <code>名称, 所在地, 土地面積(㎡), 建物面積(㎡), 築年数, 構造, 駅徒歩(分), 価格</code>
          <br />
          ※ 建物面積0は土地として査定。価格は「2080」「2,080万」どちらでも可。
        </p>
      ) : (
        <p className="text-xs text-slate-400">
          マイソク本文を貼り付け。<b>空行で物件を区切り</b>、各物件は「所在地：」「価格：」「土地面積：」
          「建物面積：」「築年月：」「構造：」「交通：」などのラベル行を自動抽出します。
          <br />
          ※ 坪/㎡・億/万・和暦（平成・令和）・徒歩◯分などの表記ゆれに対応。
        </p>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={format === "myosoku" ? 14 : 10}
        placeholder={format === "myosoku" ? "所在地：◯◯市…\n価格：3,330万円\n土地面積：160㎡ …" : "A邸　水戸市…　160　110　12　木造　10　3330万 …"}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={insertSample}
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          サンプルを挿入
        </button>
        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-brand-600 to-brand-700 px-5 py-2.5 text-sm font-semibold text-cream shadow-luxe ring-1 ring-gold-400/30 transition hover:from-brand-700 hover:to-brand-800"
        >
          <Calculator className="h-4 w-4" />
          一括査定する
        </button>
      </div>
    </form>
  );
}
