// index.html のスクリプトを1ファイルに入れる
//   node tools/bundle.js file → dist/loan-desk-file.html（パソコンで直接開く・配る）
//   node tools/bundle.js page → dist/loan-desk-page.html（claude.ai のページとして出す。DOCTYPE・html・head・body を外す）
// dist/ は .gitignore 済み。お客様の情報は入らない（読み込むのは画面から）
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

function bundle(target) {
  let h = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  h = h.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
    const js = fs.readFileSync(path.resolve(ROOT, src), "utf8").replace(/<\/script/gi, "<\\/script");
    return `<script>/* ${src} */\n${js}\n</script>`;
  });
  if (target === "file") return h;
  if (target !== "page") throw new Error("target は file か page");
  const head = h.slice(h.indexOf("<head>") + 6, h.indexOf("</head>"));
  const body = h.slice(h.indexOf("<body>") + 6, h.lastIndexOf("</body>"));
  // ページ側が charset・viewport を入れるので、それ以外（title・robots・style）を先頭に置く
  const keep = head.replace(/<meta charset[^>]*>\s*/i, "").replace(/<meta name="viewport"[^>]*>\s*/i, "").trim();
  const title = keep.match(/<title>[\s\S]*?<\/title>/)[0];
  return title + "\n" + keep.replace(title, "").trim() + "\n" + body.trim() + "\n";
}

function write(target, out) {
  const file = path.resolve(out || path.join(DIST, `loan-desk-${target}.html`));
  if (!file.startsWith(DIST + path.sep)) throw new Error("書き出し先は loan-desk-internal/dist/ の中だけ");
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(file, bundle(target));
  return file;
}

module.exports = { bundle, write };
if (require.main === module) {
  for (const t of process.argv.slice(2).length ? process.argv.slice(2) : ["file", "page"]) console.log(write(t));
}
