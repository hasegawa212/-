import Foundation
import CoreBluetooth

/// iPhone を BLE ペリフェラルにして、Mac（セントラル）へマウス入力を通知(notify)で送る。
/// サーバーもWi-Fiも使わない。
final class Peripheral: NSObject, ObservableObject, CBPeripheralManagerDelegate {
    enum State: Equatable { case off, unauthorized, advertising, connected }

    @Published private(set) var state: State = .off

    private var manager: CBPeripheralManager!
    private var input: CBMutableCharacteristic?
    private var subscribers = Set<UUID>()

    /// 送信待ち。移動は同じボタン状態のあいだ合算してまとめる。ボタンの変化は必ず別パケットで残す。
    private var queue: [MousePacket] = []
    private var buttons: UInt8 = 0
    private var accX: Double = 0, accY: Double = 0, accScroll: Double = 0
    private var timer: Timer?

    override init() {
        super.init()
        manager = CBPeripheralManager(delegate: self, queue: .main)
        // 60Hz で溜まった移動量をパケットにする
        timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in self?.tick() }
    }

    // MARK: - 入力 API（UI から呼ぶ）

    func move(dx: Double, dy: Double) { accX += dx; accY += dy }
    func scroll(_ dy: Double) { accScroll += dy }

    func setButton(_ bit: UInt8, down: Bool) {
        let next = down ? (buttons | bit) : (buttons & ~bit)
        guard next != buttons else { return }
        flushMotion()                      // 押す前までの移動は古いボタン状態で送る
        buttons = next
        enqueue(MousePacket(buttons: buttons), mergeable: false)
    }

    func click(_ bit: UInt8) {
        setButton(bit, down: true)
        setButton(bit, down: false)
    }

    // MARK: - 送信

    private func tick() {
        flushMotion()
        pump()
    }

    private func flushMotion() {
        let ix = Int(accX.rounded(.towardZero)), iy = Int(accY.rounded(.towardZero)), isc = Int(accScroll.rounded(.towardZero))
        guard ix != 0 || iy != 0 || isc != 0 else { return }
        accX -= Double(ix); accY -= Double(iy); accScroll -= Double(isc)   // 端数は次回へ持ち越す
        enqueue(MousePacket(buttons: buttons, dx: clamp16(ix), dy: clamp16(iy), scroll: clamp16(isc)), mergeable: true)
    }

    private func enqueue(_ p: MousePacket, mergeable: Bool) {
        guard !subscribers.isEmpty else { return }   // 未接続中の入力は捨てる（接続した瞬間に暴れないように）
        if mergeable, var last = queue.last, last.buttons == p.buttons {
            last.dx = clamp16(Int(last.dx) + Int(p.dx))
            last.dy = clamp16(Int(last.dy) + Int(p.dy))
            last.scroll = clamp16(Int(last.scroll) + Int(p.scroll))
            queue[queue.count - 1] = last
        } else {
            queue.append(p)
        }
        if queue.count > 256 { queue.removeFirst(queue.count - 256) }
    }

    private func pump() {
        guard let input, !subscribers.isEmpty else { return }
        while let p = queue.first {
            // false = 送信バッファが一杯。peripheralManagerIsReady で再開する
            guard manager.updateValue(p.encode(), for: input, onSubscribedCentrals: nil) else { return }
            queue.removeFirst()
        }
    }

    private func clamp16(_ v: Int) -> Int16 { Int16(max(Int(Int16.min), min(Int(Int16.max), v))) }

    // MARK: - CBPeripheralManagerDelegate

    func peripheralManagerDidUpdateState(_ p: CBPeripheralManager) {
        switch p.state {
        case .poweredOn: setup()
        case .unauthorized: state = .unauthorized
        default: state = .off
        }
    }

    private func setup() {
        manager.removeAllServices()
        let c = CBMutableCharacteristic(type: CBUUID(string: PM.inputUUID),
                                        properties: [.notify, .read],
                                        value: nil,
                                        permissions: [.readable])
        let s = CBMutableService(type: CBUUID(string: PM.serviceUUID), primary: true)
        s.characteristics = [c]
        input = c
        manager.add(s)
    }

    func peripheralManager(_ p: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        guard error == nil else { return }
        p.startAdvertising([
            CBAdvertisementDataServiceUUIDsKey: [CBUUID(string: PM.serviceUUID)],
            CBAdvertisementDataLocalNameKey: "PhoneMouse",
        ])
        state = .advertising
    }

    func peripheralManager(_ p: CBPeripheralManager, central: CBCentral, didSubscribeTo c: CBCharacteristic) {
        subscribers.insert(central.identifier)
        p.setDesiredConnectionLatency(.low, for: central)   // 遅延を最小に
        queue.removeAll(); accX = 0; accY = 0; accScroll = 0
        state = .connected
    }

    func peripheralManager(_ p: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom c: CBCharacteristic) {
        subscribers.remove(central.identifier)
        if subscribers.isEmpty {
            queue.removeAll(); buttons = 0
            state = .advertising
        }
    }

    func peripheralManagerIsReady(toUpdateSubscribers p: CBPeripheralManager) { pump() }

    func peripheralManager(_ p: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
        request.value = MousePacket(buttons: buttons).encode()
        p.respond(to: request, withResult: .success)
    }
}
