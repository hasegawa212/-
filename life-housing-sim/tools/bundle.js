// index.html と lib/engine.js・lib/share.js を1つのHTMLにまとめる（メール・LINEで送って、そのまま開けるように）
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
let out = html;
for (const f of ["lib/engine.js", "lib/share.js"]) {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  const next = out.replace(`<script src="${f}"></script>`, () => `<script>\n${src}\n</script>`);
  if (next === out) throw new Error(`${f} の script タグが見つからない`);
  out = next;
}
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/ライフルート.html"), out);
console.log("dist/ライフルート.html");
