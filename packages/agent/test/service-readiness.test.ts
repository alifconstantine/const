import { test, expect, vi, afterEach } from "vitest";
import fs from "node:fs/promises";
import { ownsListeningPort } from "../src/const/service-readiness.js";

const run = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({
  execFile: Object.assign(() => {}, { [Symbol.for("nodejs.util.promisify.custom")]: run }),
}));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); run.mockReset(); });

test("macOS treats lsof's no-listener exit as not ready rather than a verification error", async () => {
  vi.stubGlobal("process", { ...process, platform: "darwin" });
  run.mockResolvedValueOnce({ stdout: "100 1\n200 100\n300 1" }).mockRejectedValueOnce({ code: 1 });
  expect(await ownsListeningPort(100, 5000)).toBe(false);
});

test("macOS accepts a descendant's socket and refuses an unrelated process", async () => {
  vi.stubGlobal("process", { ...process, platform: "darwin" });
  for (const [listener, expected] of [["200", true], ["300", false]] as const) {
    run.mockResolvedValueOnce({ stdout: "100 1\n200 100\n300 1" }).mockResolvedValueOnce({ stdout: listener });
    expect(await ownsListeningPort(100, 5000)).toBe(expected);
  }
});

test("Linux can verify an IPv4 listener when the kernel has no tcp6 table", async () => {
  vi.stubGlobal("process", { ...process, platform: "linux" });
  run.mockResolvedValue({ stdout: "100 1\n200 100" });
  vi.spyOn(fs, "readFile").mockImplementation(async file => {
    if (String(file).endsWith("tcp6")) throw Object.assign(new Error("disabled"), { code: "ENOENT" });
    return "header\n0: 0100007F:1388 00000000:0000 0A 0:0 00:0 0 1000 0 1234 1";
  });
  vi.spyOn(fs, "readdir").mockImplementation(async directory => String(directory).includes("200") ? ["3"] : []);
  vi.spyOn(fs, "readlink").mockResolvedValue("socket:[1234]");
  expect(await ownsListeningPort(100, 5000)).toBe(true);
});
