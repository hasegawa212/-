// swift-tools-version: 5.8
// Xcode（または iPad/Mac の Swift Playgrounds）でこのフォルダを開くと、そのまま iPhone アプリとしてビルドできる。
import PackageDescription
import AppleProductTypes

let package = Package(
    name: "PhoneMouse",
    platforms: [.iOS("16.0")],
    products: [
        .iOSApplication(
            name: "PhoneMouse",
            targets: ["AppModule"],
            bundleIdentifier: "com.example.phonemouse",
            displayVersion: "1.0",
            bundleVersion: "1",
            accentColor: .presetColor(.purple),
            supportedDeviceFamilies: [.phone],
            supportedInterfaceOrientations: [.portrait],
            capabilities: [
                .bluetoothAlways(purposeString: "Mac とBluetoothでつないで、iPhoneをマウスとして使うために必要です。")
            ]
        )
    ],
    targets: [
        .executableTarget(name: "AppModule", path: "Sources")
    ]
)
