// index.html に lib/screening.js を埋め込んで、1ファイルで送れる dist/LOAN_DESK.html を作る
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const lib = fs.readFileSync(path.join(root, "lib/screening.js"), "utf8");
const out = html.replace('<script src="lib/screening.js"></script>', () => "<script>\n" + lib + "\n</script>");
if (out === html) throw new Error("lib の script タグが見つかりません");
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/LOAN_DESK.html"), out);
console.log("dist/LOAN_DESK.html", out.length, "bytes");
