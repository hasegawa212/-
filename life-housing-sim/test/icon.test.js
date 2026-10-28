// TDD：ホーム画面のアイコン（iPhone「ホーム画面に追加」・Android・ブラウザのタブ）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const png = (f) => { const b = fs.readFileSync(path.join(root, f)); assert.equal(b.toString("hex", 1, 4), "504e47", f + " は PNG"); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test("アイコンの画像：180（iPhone）・192・512（Android）・32（タブ）、正方形", () => {
  assert.deepEqual(png("img/icon-180.png"), [180, 180]);
  assert.deepEqual(png("img/icon-192.png"), [192, 192]);
  assert.deepEqual(png("img/icon-512.png"), [512, 512]);
  assert.deepEqual(png("img/icon-32.png"), [32, 32]);
});

test("iPhone：apple-touch-icon と、ホーム画面の名前は「ライフルート」", () => {
  assert.match(html, /<link rel="apple-touch-icon" href="img\/icon-180\.png">/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="ライフルート">/);
  assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="img\/icon-32\.png">/);
  assert.match(html, /<meta name="theme-color" content="#0b1a38">/);
});

test("Android：manifest に名前・アイコン 192／512・開くページ", () => {
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  const m = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  assert.equal(m.name, "LIFE ROUTE（ライフルート）");
  assert.equal(m.short_name, "ライフルート");
  assert.equal(m.start_url, "./");
  assert.deepEqual(m.icons.map((i) => i.sizes).sort(), ["192x192", "512x512"]);
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(root, i.src)), i.src);
});
