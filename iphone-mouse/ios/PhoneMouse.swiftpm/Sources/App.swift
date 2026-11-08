import SwiftUI

@main
struct PhoneMouseApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}

struct ContentView: View {
    @StateObject private var ble = Peripheral()
    @AppStorage("mode") private var modeRaw = PadMode.trackpad.rawValue
    @AppStorage("sensitivity") private var sensitivity = 1.0
    @State private var touching = false

    private var mode: PadMode { PadMode(rawValue: modeRaw) ?? .trackpad }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.06, green: 0.05, blue: 0.12), .black],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(spacing: 14) {
                status
                Picker("モード", selection: $modeRaw) {
                    ForEach(PadMode.allCases) { Text($0.label).tag($0.rawValue) }
                }
                .pickerStyle(.segmented)

                HStack {
                    Image(systemName: "tortoise").foregroundStyle(.secondary)
                    Slider(value: $sensitivity, in: 0.3...3.0)
                    Image(systemName: "hare").foregroundStyle(.secondary)
                }

                pad
                buttons
            }
            .padding()
        }
        .preferredColorScheme(.dark)
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }   // 操作中にスリープしない
    }

    private var status: some View {
        let (text, color): (String, Color) = {
            switch ble.state {
            case .connected:    return ("Mac と接続中", .green)
            case .advertising:  return ("Mac を待っています…（Mac で PhoneMouseMac を起動）", .orange)
            case .unauthorized: return ("Bluetooth の許可が必要です（設定 › PhoneMouse）", .red)
            case .off:          return ("Bluetooth をオンにしてください", .red)
            }
        }()
        return HStack(spacing: 8) {
            Circle().fill(color).frame(width: 10, height: 10)
            Text(text).font(.subheadline)
            Spacer()
        }
    }

    private var pad: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 28)
                .fill(Color.white.opacity(touching ? 0.10 : 0.05))
                .overlay(RoundedRectangle(cornerRadius: 28).stroke(Color.white.opacity(0.12)))
            VStack(spacing: 10) {
                Image(systemName: mode == .air ? "scope" : "hand.point.up.left")
                    .font(.system(size: 44, weight: .light))
                Text(mode == .air ? "iPhone を Mac に向けて動かす" : "指でなぞって移動")
                    .font(.headline)
                Text(mode == .air
                     ? "タップ = クリック ・ 押しっぱなし = ドラッグ\n2本指タップ = 右クリック"
                     : "タップ = クリック ・ 長押し→動かす = ドラッグ\n2本指 = スクロール ・ 2本指タップ = 右クリック")
                    .font(.caption).multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }
            .allowsHitTesting(false)
            TouchPad(peripheral: ble, mode: mode, sensitivity: sensitivity, touching: $touching)
        }
        .frame(maxHeight: .infinity)
    }

    private var buttons: some View {
        HStack(spacing: 12) {
            PressButton(title: "左クリック") { ble.setButton(1, down: $0) }
            PressButton(title: "右クリック") { ble.setButton(2, down: $0) }
        }
        .frame(height: 64)
    }
}

/// 押している間ずっとボタンを押下状態にする（ドラッグにも使える）
struct PressButton: View {
    let title: String
    let onChange: (Bool) -> Void
    @State private var down = false

    var body: some View {
        RoundedRectangle(cornerRadius: 18)
            .fill(Color.white.opacity(down ? 0.22 : 0.08))
            .overlay(Text(title).font(.subheadline.weight(.semibold)))
            .gesture(DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !down { down = true; onChange(true); UIImpactFeedbackGenerator(style: .medium).impactOccurred() }
                }
                .onEnded { _ in down = false; onChange(false) })
    }
}
