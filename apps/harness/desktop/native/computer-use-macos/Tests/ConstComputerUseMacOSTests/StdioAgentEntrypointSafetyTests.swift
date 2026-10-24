import XCTest

final class StdioAgentEntrypointSafetyTests: XCTestCase {
    func testInheritedPipeModeRequiresTheActualConstParent() throws {
        let source = try entrypointSource()
        XCTAssertTrue(source.contains("parent == getppid()"))
        XCTAssertTrue(source.contains("NSRunningApplication(processIdentifier: parent)"))
        XCTAssertTrue(source.contains("bundleId == \"id.web.const.harness.desktop\""))
        XCTAssertTrue(source.contains("guard packagedParent || developmentParent else"))
        XCTAssertTrue(source.contains("computer-use stdio agent refused an untrusted parent application"))
    }

    func testDefaultStdioRemainsDisabledAndTheAgentOwnsAnApplicationRunLoop() throws {
        let source = try entrypointSource()
        XCTAssertTrue(source.contains("private func runStdio()"))
        XCTAssertTrue(source.contains("must be launched by Const in app-agent mode"))
        XCTAssertTrue(source.contains("application.delegate = delegate"))
        XCTAssertTrue(source.contains("application.run()"))
        XCTAssertTrue(source.contains("writeJSON([\"ready\": true], to: nil)"))
        XCTAssertTrue(source.contains("while let line = readLine(from: STDIN_FILENO)"))
    }

    private func entrypointSource() throws -> String {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        return try String(contentsOf: root.appendingPathComponent("Sources/ConstComputerUseMacOS/main.swift"), encoding: .utf8)
    }
}
