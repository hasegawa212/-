import SwiftUI
import UIKit
import CoreMotion

enum PadMode: String, CaseIterable, Identifiable {
    case trackpad, air
    var id: String { rawValue }
    var label: String { self == .trackpad ? "トラックパッド" : "エアマウス" }
}

/// タッチ操作（マルチタッチ）とジャイロを、マウス入力に変換する UIKit ビュー。
/// - トラックパッド: 1本指で移動 / タップ=クリック / 長押し→そのまま動かす=ドラッグ / 2本指スクロール / 2本指タップ=右クリック
/// - エアマウス: iPhone の向きでカーソル移動 / タップ=クリック / 押しっぱなし=ドラッグ / 2本指タップ=右クリック
final class TouchPadUIView: UIView {
    var peripheral: Peripheral?
    var mode: PadMode = .trackpad { didSet { mode == .air ? startMotion() : stopMotion() } }
    var sensitivity: Double = 1.0
    var onTouchState: ((Bool) -> Void)?

    private let haptic = UIImpactFeedbackGenerator(style: .light)
    private let motion = CMMotionManager()

    // 1 回のジェスチャーの状態
    private var fingers = 0
    private var maxFingers = 0
    private var startTime = CACurrentMediaTime()
    private var travelled: CGFloat = 0
    private var dragging = false
    private var holdTimer: Timer?
    private var lastCentroid: CGPoint = .zero

    override init(frame: CGRect) {
        super.init(frame: frame)
        isMultipleTouchEnabled = true
        backgroundColor = .clear
        haptic.prepare()
    }
    required init?(coder: NSCoder) { fatalError() }

    // MARK: - Touch

    private func centroid(_ event: UIEvent?) -> CGPoint {
        let ts = (event?.allTouches ?? []).filter { $0.phase != .ended && $0.phase != .cancelled }
        guard !ts.isEmpty else { return lastCentroid }
        let sum = ts.reduce(CGPoint.zero) { p, t in
            let l = t.location(in: self); return CGPoint(x: p.x + l.x, y: p.y + l.y)
        }
        return CGPoint(x: sum.x / CGFloat(ts.count), y: sum.y / CGFloat(ts.count))
    }

    private func activeCount(_ event: UIEvent?) -> Int {
        (event?.allTouches ?? []).filter { $0.phase != .ended && $0.phase != .cancelled }.count
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        let wasIdle = fingers == 0
        fingers = activeCount(event)
        maxFingers = max(maxFingers, fingers)
        lastCentroid = centroid(event)
        if wasIdle {
            startTime = CACurrentMediaTime()
            travelled = 0
            maxFingers = fingers
            onTouchState?(true)
            // 1本指のまま動かさずに一定時間 → ドラッグ開始（エアマウスは短め）
            let hold = mode == .air ? 0.22 : 0.38
            holdTimer?.invalidate()
            holdTimer = Timer.scheduledTimer(withTimeInterval: hold, repeats: false) { [weak self] _ in
                guard let self, self.fingers == 1, self.maxFingers == 1, self.travelled < 10 else { return }
                self.dragging = true
                self.peripheral?.setButton(1, down: true)
                self.haptic.impactOccurred(intensity: 0.9)
            }
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        let c = centroid(event)
        let dx = c.x - lastCentroid.x, dy = c.y - lastCentroid.y
        lastCentroid = c
        travelled += hypot(dx, dy)
        guard mode == .trackpad else { return }   // エアマウスは指の移動を使わない

        if fingers >= 2 {
            peripheral?.scroll(Double(dy) * 2.0 * sensitivity)
        } else {
            // 速く動かすほど遠くへ（ポインタ加速）
            let speed = Double(hypot(dx, dy))
            let gain = (1.6 + min(speed, 40) * 0.09) * sensitivity
            peripheral?.move(dx: Double(dx) * gain, dy: Double(dy) * gain)
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) { finish(event) }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) { finish(event) }

    private func finish(_ event: UIEvent?) {
        fingers = activeCount(event)
        lastCentroid = centroid(event)
        guard fingers == 0 else { return }
        holdTimer?.invalidate()
        onTouchState?(false)

        let quick = CACurrentMediaTime() - startTime < 0.3 && travelled < 12
        if dragging {
            peripheral?.setButton(1, down: false)
            dragging = false
        } else if quick {
            peripheral?.click(maxFingers >= 2 ? 2 : 1)
            haptic.impactOccurred()
        }
        maxFingers = 0
    }

    // MARK: - Air mouse（ジャイロ）

    private func startMotion() {
        guard motion.isDeviceMotionAvailable, !motion.isDeviceMotionActive else { return }
        motion.deviceMotionUpdateInterval = 1.0 / 120.0
        var last = CACurrentMediaTime()
        motion.startDeviceMotionUpdates(to: .main) { [weak self] dm, _ in
            guard let self, let dm else { return }
            let now = CACurrentMediaTime()
            let dt = min(now - last, 0.05); last = now
            // 画面を上にして、iPhone の上端を Mac に向けて持つ想定。
            // 左右に振る = z軸まわり、上下に振る = x軸まわりの回転。
            var rz = dm.rotationRate.z, rx = dm.rotationRate.x
            let dead = 0.015                         // 手ぶれ用の不感帯 (rad/s)
            rz = abs(rz) < dead ? 0 : rz
            rx = abs(rx) < dead ? 0 : rx
            let gain = 1400.0 * self.sensitivity     // px / rad
            self.peripheral?.move(dx: -rz * gain * dt, dy: -rx * gain * dt)
        }
    }

    private func stopMotion() { motion.stopDeviceMotionUpdates() }

    deinit { motion.stopDeviceMotionUpdates() }
}

struct TouchPad: UIViewRepresentable {
    let peripheral: Peripheral
    let mode: PadMode
    let sensitivity: Double
    @Binding var touching: Bool

    func makeUIView(context: Context) -> TouchPadUIView {
        let v = TouchPadUIView()
        v.peripheral = peripheral
        v.onTouchState = { t in DispatchQueue.main.async { touching = t } }
        v.mode = mode
        v.sensitivity = sensitivity
        return v
    }

    func updateUIView(_ v: TouchPadUIView, context: Context) {
        if v.mode != mode { v.mode = mode }
        v.sensitivity = sensitivity
    }
}
