import fs from "node:fs/promises";
import path from "node:path";

export interface SpooledOutputResult {
  output: string;
  isSpooled: boolean;
  artifactPath?: string;
  totalChars: number;
  totalLines: number;
}

/**
 * Spools massive process output to disk if it exceeds inline limits,
 * preserving token budgets while allowing full inspection via 'read'.
 */
export async function spoolLargeOutput(
  rawOutput: string,
  workspacePath: string,
  options: {
    maxChars?: number;
    headChars?: number;
    tailChars?: number;
    prefix?: string;
  } = {}
): Promise<SpooledOutputResult> {
  const maxChars = options.maxChars ?? 45000;
  const headChars = options.headChars ?? 20000;
  const tailChars = options.tailChars ?? 15000;
  const prefix = options.prefix ?? "output";

  const totalChars = rawOutput.length;
  const lines = rawOutput.split(/\r?\n/);
  const totalLines = lines.length;

  if (totalChars <= maxChars) {
    return {
      output: rawOutput,
      isSpooled: false,
      totalChars,
      totalLines,
    };
  }

  // Ensure artifacts directory exists
  const artifactsDir = path.join(workspacePath, ".const", "artifacts");
  let artifactRelPath = "";
  try {
    await fs.mkdir(artifactsDir, { recursive: true });
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.log`;
    const fullPath = path.join(artifactsDir, fileName);
    await fs.writeFile(fullPath, rawOutput, "utf-8");
    artifactRelPath = path.relative(workspacePath, fullPath);
  } catch {
    // If writing fails, fall back to inline truncation without file link
  }

  const head = rawOutput.slice(0, headChars);
  const tail = rawOutput.slice(-tailChars);

  const fileNotice = artifactRelPath
    ? `Full unclipped output (${(totalChars / 1024).toFixed(1)} KB) saved to: '${artifactRelPath}'\nUse the 'read' tool with offset/limit to inspect specific sections.`
    : `Total output size: ${(totalChars / 1024).toFixed(1)} KB across ${totalLines} lines.`;

  const formatted = [
    head,
    `\n\n... [OUTPUT TRUNCATED: ${totalChars} characters (${totalLines} lines)] ...`,
    `[Notice: ${fileNotice}]`,
    `... [LAST ${tailChars} CHARACTERS] ...\n`,
    tail,
  ].join("\n");

  return {
    output: formatted,
    isSpooled: true,
    artifactPath: artifactRelPath,
    totalChars,
    totalLines,
  };
}
