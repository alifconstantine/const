import { app } from "electron";
import os from "node:os";
import path from "node:path";
import release from "../omp-release.json";

export function ompExecutable(): string {
  const windows = process.platform === "win32";
  if (app.isPackaged) return path.join(process.resourcesPath, "omp", windows ? "omp.exe" : "omp");
  const override = process.env.CONST_HARNESS_OMP_PATH;
  if (override && path.isAbsolute(override)) return override;
  const asset = windows ? `omp-windows-${process.arch}.exe` : `omp-${process.platform}-${process.arch}`;
  return path.join(os.homedir(), ".cache", "const-harness", "omp", release.version, asset);
}
