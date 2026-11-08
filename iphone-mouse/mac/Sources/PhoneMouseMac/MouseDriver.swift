import Foundation
import CoreGraphics
import ApplicationServices

/// 受け取ったパケットを、本物のマウスと同じ macOS のイベント（CGEvent）に変換して流す。
/// 移動量(delta)も入れるので、ブラウザのポインタロック（movementX/Y）を使うゲームでも動く。
final class MouseDriver {
    private var buttons: UInt8 = 0
    private var lastDown: (bit: UInt8, time: TimeInterval, pos: CGPoint)?
    private var clickCount: Int64 = 1
    private let source = CGEventSource(stateID: .hidSystemState)

    /// アクセシビリティ許可がないとイベントを流せない。初回はシステム設定のダイアログを出す。
    static func ensureTrusted() -> Bool {
        let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
        return AXIsProcessTrustedWithOptions([key: true] as CFDictionary)
    }

    func apply(_ p: MousePacket) {
        // ボタンの変化を先に（同じパケット内の移動は「押した後」の移動）
        for bit: UInt8 in [1, 2] where (p.buttons & bit) != (buttons & bit) {
            let down = (p.buttons & bit) != 0
            buttons = down ? (buttons | bit) : (buttons & ~bit)
            post(button: bit, down: down)
        }
        if p.dx != 0 || p.dy != 0 { move(dx: Int(p.dx), dy: Int(p.dy)) }
        if p.scroll != 0 { scroll(Int(p.scroll)) }
    }

    /// 接続が切れたら押しっぱなしを解除する
    func releaseAll() {
        for bit: UInt8 in [1, 2] where buttons & bit != 0 {
            buttons &= ~bit
            post(button: bit, down: false)
        }
    }

    // MARK: -

    private var location: CGPoint { CGEvent(source: nil)?.location ?? .zero }

    private func move(dx: Int, dy: Int) {
        let to = clampToScreens(CGPoint(x: location.x + CGFloat(dx), y: location.y + CGFloat(dy)))
        let type: CGEventType
        let button: CGMouseButton
        if buttons & 1 != 0 { type = .leftMouseDragged; button = .left }
        else if buttons & 2 != 0 { type = .rightMouseDragged; button = .right }
        else { type = .mouseMoved; button = .left }
        guard let e = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: to, mouseButton: button) else { return }
        e.setIntegerValueField(.mouseEventDeltaX, value: Int64(dx))
        e.setIntegerValueField(.mouseEventDeltaY, value: Int64(dy))
        e.post(tap: .cghidEventTap)
    }

    private func post(button bit: UInt8, down: Bool) {
        let pos = location
        let isLeft = bit == 1
        let type: CGEventType = isLeft ? (down ? .leftMouseDown : .leftMouseUp) : (down ? .rightMouseDown : .rightMouseUp)
        if down {
            // ダブルクリック判定（同じボタン・短い間隔・ほぼ同じ場所）
            let now = ProcessInfo.processInfo.systemUptime
            if let l = lastDown, l.bit == bit, now - l.time < NSEventDoubleClickInterval(), hypot(l.pos.x - pos.x, l.pos.y - pos.y) < 6 {
                clickCount += 1
            } else {
                clickCount = 1
            }
            lastDown = (bit, now, pos)
        }
        guard let e = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: pos,
                              mouseButton: isLeft ? .left : .right) else { return }
        e.setIntegerValueField(.mouseEventClickState, value: clickCount)
        e.post(tap: .cghidEventTap)
    }

    private func scroll(_ dy: Int) {
        // 2本指を下へ動かす(dy>0) = 内容も下へ動く（ナチュラルスクロール）
        guard let e = CGEvent(scrollWheelEvent2Source: source, units: .pixel, wheelCount: 1,
                              wheel1: Int32(dy), wheel2: 0, wheel3: 0) else { return }
        e.post(tap: .cghidEventTap)
    }

    /// カーソルを全ディスプレイの範囲内に収める
    private func clampToScreens(_ p: CGPoint) -> CGPoint {
        var count: UInt32 = 0
        CGGetActiveDisplayList(0, nil, &count)
        var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
        CGGetActiveDisplayList(count, &ids, &count)
        let rects = ids.map { CGDisplayBounds($0) }
        if rects.contains(where: { $0.contains(p) }) { return p }
        // 外に出たら、いちばん近い画面の端へ
        var best = p, bestD = CGFloat.greatestFiniteMagnitude
        for r in rects {
            let q = CGPoint(x: min(max(p.x, r.minX), r.maxX - 1), y: min(max(p.y, r.minY), r.maxY - 1))
            let d = hypot(q.x - p.x, q.y - p.y)
            if d < bestD { bestD = d; best = q }
        }
        return best
    }
}

/// AppKit を読み込まずにダブルクリック間隔を得る（既定 0.5 秒）
private func NSEventDoubleClickInterval() -> TimeInterval {
    let v = UserDefaults.standard.double(forKey: "com.apple.mouse.doubleClickThreshold")
    return v > 0 ? v : 0.5
}
