import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const run = promisify(execFile);

/** A listening socket is ready only when it belongs to this process tree. */
export async function ownsListeningPort(rootPid: number, port: number): Promise<boolean> {
  if (!Number.isSafeInteger(rootPid) || !Number.isInteger(port) || port < 1 || port > 65535) return false;
  if (process.platform === "win32") {
    const { stdout } = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `$owners = @(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess); ` +
      `$tree = @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId); ` +
      `@{owners=$owners;tree=$tree} | ConvertTo-Json -Compress`], { windowsHide: true, timeout: 10_000 });
    const data = JSON.parse(stdout) as { owners: number[]; tree: { ProcessId: number; ParentProcessId: number }[] };
    return hasOwnedListener(rootPid, data.owners, data.tree.map(p => [p.ProcessId, p.ParentProcessId]));
  }
  const { stdout } = await run("ps", ["-eo", "pid=,ppid="], { timeout: 3000 });
  const tree = stdout.trim().split(/\r?\n/).map(line => line.trim().split(/\s+/).map(Number) as [number, number]);
  if (process.platform === "linux") {
    const owned = descendants(rootPid, tree);
    const tables = await Promise.all(["/proc/net/tcp", "/proc/net/tcp6"].map(async file => {
      try { return await fs.readFile(file, "utf8"); }
      catch (error) { if (file.endsWith("tcp6") && (error as NodeJS.ErrnoException).code === "ENOENT") return ""; throw error; }
    }));
    const inodes = new Set(tables.flatMap(table => table.trim().split("\n").slice(1).flatMap(line => {
      const fields = line.trim().split(/\s+/);
      return fields[3] === "0A" && parseInt(fields[1]!.split(":")[1]!, 16) === port ? [fields[9]!] : [];
    })));
    for (const pid of owned) {
      let descriptors: string[];
      try { descriptors = await fs.readdir(`/proc/${pid}/fd`); } catch { continue; }
      for (const fd of descriptors) {
        try {
          const link = await fs.readlink(`/proc/${pid}/fd/${fd}`);
          if (inodes.has(link.replace(/^socket:\[|\]$/g, ""))) return true;
        } catch { /* A process may close a descriptor while it is inspected. */ }
      }
    }
    return false;
  }
  let listeners: { stdout: string };
  try { listeners = await run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { timeout: 3000 }); }
  catch (error) { if ((error as { code?: number }).code === 1) return false; throw error; }
  return hasOwnedListener(rootPid, listeners.stdout.trim().split(/\s+/).map(Number), tree);
}

function descendants(root: number, tree: number[][]): Set<number> {
  const result = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, parent] of tree) if (pid && parent && result.has(parent) && !result.has(pid)) {
      result.add(pid); changed = true;
    }
  }
  return result;
}

function hasOwnedListener(root: number, listeners: number[], tree: number[][]): boolean {
  const owned = descendants(root, tree);
  return listeners.some(pid => owned.has(pid));
}
