// index.html と lib/engine.js・lib/share.js を1つのHTMLにまとめる（メール・LINEで送って、そのまま開けるように）
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
let out = html;
for (const f of ["lib/engine.js", "lib/share.js", "lib/customers.js"]) {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  const next = out.replace(`<script src="${f}"></script>`, () => `<script>\n${src}\n</script>`);
  if (next === out) throw new Error(`${f} の script タグが見つからない`);
  out = next;
}
// 画像も1つのファイルに入れる（送った先でそのまま表示されるように）
// 絵のファイル名は lib/engine.js の rentImage() にある → 1つのファイルに入れるときは中身（data URI）に置き換える
for (const img of ["img/rent-mechanism.jpg", "img/rent-mechanism-single.jpg", "img/space-single.jpg", "img/top-hero.jpg", "img/icon-180.png", "img/icon-32.png"]) {
  const data = `data:image/${img.endsWith(".png") ? "png" : "jpeg"};base64,` + fs.readFileSync(path.join(root, img)).toString("base64");
  const next = out.split(`"${img}"`).join(`"${data}"`);
  if (next === out) throw new Error(`${img} が見つからない`);
  out = next;
}
// 1つのファイルで送るときは manifest（別ファイル）は読めないので外す。アイコンは上で埋め込み済み
out = out.replace(/<link rel="manifest"[^>]*>\n/, "");
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/ライフルート.html"), out);
console.log("dist/ライフルート.html");
