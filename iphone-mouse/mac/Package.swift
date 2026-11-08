// swift-tools-version: 5.8
// Mac 側の受信アプリ（コマンドライン）。`swift run -c release` で起動。
import PackageDescription

let package = Package(
    name: "PhoneMouseMac",
    platforms: [.macOS(.v12)],
    targets: [
        .executableTarget(
            name: "PhoneMouseMac",
            path: "Sources/PhoneMouseMac",
            exclude: ["Info.plist"],
            linkerSettings: [
                // Bluetooth の利用目的（NSBluetoothAlwaysUsageDescription）を実行ファイルに埋め込む
                .unsafeFlags(["-Xlinker", "-sectcreate", "-Xlinker", "__TEXT",
                              "-Xlinker", "__info_plist", "-Xlinker", "Sources/PhoneMouseMac/Info.plist"])
            ]
        )
    ]
)
