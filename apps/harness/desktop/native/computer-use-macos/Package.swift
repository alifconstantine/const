// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "ConstComputerUseMacOS",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "ConstComputerUseMacOSCore",
            targets: ["ConstComputerUseMacOSCore"]
        ),
        .executable(
            name: "const-computer-use-macos",
            targets: ["ConstComputerUseMacOS"]
        )
    ],
    targets: [
        .target(
            name: "ConstComputerUseMacOSCore",
            path: "Sources/ConstComputerUseMacOSCore"
        ),
        .executableTarget(
            name: "ConstComputerUseMacOS",
            dependencies: ["ConstComputerUseMacOSCore"],
            path: "Sources/ConstComputerUseMacOS"
        ),
        .testTarget(
            name: "ConstComputerUseMacOSTests",
            dependencies: ["ConstComputerUseMacOSCore"],
            path: "Tests/ConstComputerUseMacOSTests"
        )
    ]
)

