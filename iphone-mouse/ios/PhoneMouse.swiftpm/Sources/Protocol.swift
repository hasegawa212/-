import Foundation

// iPhone → Mac の通信仕様（mac/Sources/PhoneMouseMac/Protocol.swift と同じ内容に保つこと）
// test/protocol.test.js が UUID とパケット長の一致を確認する。
enum PM {
    static let serviceUUID = "6E1B0001-5A4F-4C2B-9F2E-3B7C1D0A9E51"
    static let inputUUID   = "6E1B0002-5A4F-4C2B-9F2E-3B7C1D0A9E51"
    static let packetSize  = 8
}

/// 8 バイト固定・リトルエンディアン
/// [0] buttons (bit0 = 左, bit1 = 右)  [1] 予約(0)
/// [2-3] dx Int16  [4-5] dy Int16  [6-7] scroll Int16
/// ボタンは「押されているかどうかの状態」を毎回送る。Mac 側が前回との差分で押した/離したを作る。
struct MousePacket: Equatable {
    var buttons: UInt8 = 0
    var dx: Int16 = 0
    var dy: Int16 = 0
    var scroll: Int16 = 0

    func encode() -> Data {
        var d = Data(count: PM.packetSize)
        d[0] = buttons
        d[1] = 0
        func put(_ v: Int16, _ at: Int) {
            let u = UInt16(bitPattern: v)
            d[at] = UInt8(u & 0xff)
            d[at + 1] = UInt8(u >> 8)
        }
        put(dx, 2); put(dy, 4); put(scroll, 6)
        return d
    }

    static func decode(_ d: Data) -> MousePacket? {
        guard d.count >= PM.packetSize else { return nil }
        let b = [UInt8](d)
        func get(_ at: Int) -> Int16 { Int16(bitPattern: UInt16(b[at]) | (UInt16(b[at + 1]) << 8)) }
        return MousePacket(buttons: b[0], dx: get(2), dy: get(4), scroll: get(6))
    }
}
