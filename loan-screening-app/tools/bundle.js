// index.html に lib/*.js を埋め込んで、1ファイルで送れる dist/LOAN_DESK.html を作る
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const name of ["policy", "income", "credit", "collateral", "flat35", "fees", "screening"]) {
  const tag = `<script src="lib/${name}.js"></script>`;
  if (!html.includes(tag)) throw new Error(`${tag} が見つかりません`);
  const lib = fs.readFileSync(path.join(root, `lib/${name}.js`), "utf8");
  html = html.replace(tag, () => "<script>\n" + lib + "\n</script>");
}
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/LOAN_DESK.html"), html);
console.log("dist/LOAN_DESK.html", html.length, "bytes");
