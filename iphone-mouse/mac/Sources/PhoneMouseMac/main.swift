import Foundation
import CoreBluetooth

/// Mac 側: iPhone（PhoneMouse アプリ）を Bluetooth で探してつなぎ、届いた入力でカーソルを動かす。
final class Central: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private var manager: CBCentralManager!
    private var phone: CBPeripheral?
    private let driver = MouseDriver()

    override init() {
        super.init()
        manager = CBCentralManager(delegate: self, queue: .main)
    }

    private func log(_ s: String) {
        let t = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        print("[\(t)] \(s)")
    }

    private func scan() {
        guard manager.state == .poweredOn else { return }
        log("iPhone を探しています…（iPhone で PhoneMouse を開いてください）")
        manager.scanForPeripherals(withServices: [CBUUID(string: PM.serviceUUID)], options: nil)
    }

    // MARK: - CBCentralManagerDelegate

    func centralManagerDidUpdateState(_ c: CBCentralManager) {
        switch c.state {
        case .poweredOn: scan()
        case .unauthorized: log("Bluetooth の許可がありません。システム設定 › プライバシーとセキュリティ › Bluetooth で、このアプリ（またはターミナル）を許可してください。")
        case .poweredOff: log("Bluetooth がオフです。")
        default: break
        }
    }

    func centralManager(_ c: CBCentralManager, didDiscover p: CBPeripheral, advertisementData: [String: Any], rssi: NSNumber) {
        guard phone == nil else { return }
        log("見つけました: \(p.name ?? "PhoneMouse")（電波 \(rssi) dBm）→ 接続します")
        phone = p
        c.stopScan()
        c.connect(p, options: nil)
    }

    func centralManager(_ c: CBCentralManager, didConnect p: CBPeripheral) {
        p.delegate = self
        p.discoverServices([CBUUID(string: PM.serviceUUID)])
    }

    func centralManager(_ c: CBCentralManager, didFailToConnect p: CBPeripheral, error: Error?) {
        log("接続に失敗しました: \(error?.localizedDescription ?? "-")")
        phone = nil
        scan()
    }

    func centralManager(_ c: CBCentralManager, didDisconnectPeripheral p: CBPeripheral, error: Error?) {
        log("切断されました。もう一度探します。")
        driver.releaseAll()
        phone = nil
        scan()
    }

    // MARK: - CBPeripheralDelegate

    func peripheral(_ p: CBPeripheral, didDiscoverServices error: Error?) {
        guard let s = p.services?.first(where: { $0.uuid == CBUUID(string: PM.serviceUUID) }) else { return }
        p.discoverCharacteristics([CBUUID(string: PM.inputUUID)], for: s)
    }

    func peripheral(_ p: CBPeripheral, didDiscoverCharacteristicsFor s: CBService, error: Error?) {
        guard let ch = s.characteristics?.first(where: { $0.uuid == CBUUID(string: PM.inputUUID) }) else { return }
        p.setNotifyValue(true, for: ch)
        log("接続しました。iPhone でカーソルを動かせます。（終了は Ctrl+C）")
    }

    func peripheral(_ p: CBPeripheral, didUpdateValueFor ch: CBCharacteristic, error: Error?) {
        guard let d = ch.value, let packet = MousePacket.decode(d) else { return }
        driver.apply(packet)
    }
}

print("PhoneMouseMac — iPhone を Mac のマウスにする（Bluetooth のみ・サーバー不要）")
if !MouseDriver.ensureTrusted() {
    print("""
    ⚠️  アクセシビリティの許可が必要です。
       システム設定 › プライバシーとセキュリティ › アクセシビリティ で、
       このアプリを起動したもの（ターミナル / iTerm / Xcode など）をオンにして、起動し直してください。
    """)
}
let central = Central()
signal(SIGINT) { _ in exit(0) }
RunLoop.main.run()
