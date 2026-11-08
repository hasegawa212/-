const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ios = fs.readFileSync(path.join(__dirname, "../ios/PhoneMouse.swiftpm/Sources/Protocol.swift"), "utf8");
const mac = fs.readFileSync(path.join(__dirname, "../mac/Sources/PhoneMouseMac/Protocol.swift"), "utf8");
// 1行目のコメント（相手側ファイルへの参照）以外はまったく同じであること
const body = (s) => s.split("\n").filter((l) => !l.includes("と同じ内容に保つこと")).join("\n");

test("iPhone と Mac の通信仕様（UUID・パケット）が一致している", () => {
  assert.strictEqual(body(ios), body(mac));
  const uuids = ios.match(/[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/g);
  assert.strictEqual(uuids.length, 2);
  assert.notStrictEqual(uuids[0], uuids[1]);
  assert.match(ios, /packetSize\s*=\s*8/);
});

// Swift の encode/decode と同じ並びを JS で再現し、往復と符号を確かめる
function encode(p) {
  const b = Buffer.alloc(8);
  b[0] = p.buttons; b.writeInt16LE(p.dx, 2); b.writeInt16LE(p.dy, 4); b.writeInt16LE(p.scroll, 6);
  return b;
}
function decode(b) { return { buttons: b[0], dx: b.readInt16LE(2), dy: b.readInt16LE(4), scroll: b.readInt16LE(6) }; }

test("パケットのエンコード/デコード（負の値・最大値）", () => {
  for (const p of [{ buttons: 0, dx: 0, dy: 0, scroll: 0 }, { buttons: 1, dx: -5, dy: 12, scroll: -3 },
                   { buttons: 3, dx: 32767, dy: -32768, scroll: 1 }]) {
    assert.deepStrictEqual(decode(encode(p)), p);
  }
  // Swift 側: UInt16(bitPattern:) の下位→上位バイト = リトルエンディアン
  assert.deepStrictEqual([...encode({ buttons: 1, dx: -2, dy: 0, scroll: 0 })], [1, 0, 0xfe, 0xff, 0, 0, 0, 0]);
});
