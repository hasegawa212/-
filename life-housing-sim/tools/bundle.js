// index.html と lib/engine.js を1つのHTMLにまとめる（メール・LINEで送って、そのまま開けるように）
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const engine = fs.readFileSync(path.join(root, "lib/engine.js"), "utf8");
const out = html.replace('<script src="lib/engine.js"></script>', () => `<script>\n${engine}\n</script>`);
if (out === html) throw new Error("engine の script タグが見つからない");
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/住まいの一生シミュレーター.html"), out);
console.log("dist/住まいの一生シミュレーター.html");
