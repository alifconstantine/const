import { test, expect } from "vitest";
import { spawn } from "node:child_process";
import { checkBashInterception } from "../src/const/bash-interceptor.js";
import { executeNativeTool } from "../src/const/tools.js";

test.skipIf(process.platform === "win32")("Bash heredocs and Bash syntax work with Fish as the inherited login shell", async () => {
  const modulePath = new URL("../src/const/tools.ts", import.meta.url).href;
  // A child process keeps shell discovery's cache and environment isolated from
  // other tests. This invokes the real tool, not a source-text assertion.
  const command = "value=ok\ncat <<'END'\nheredoc works\nEND\n[[ \"$value\" == ok ]] && echo bash-syntax-works";
  const program = `import {executeNativeTool,getShellConfig} from ${JSON.stringify(modulePath)};
    const result = await executeNativeTool('bash',{command:${JSON.stringify(command)}},process.cwd());
    console.log(JSON.stringify({shell:getShellConfig().shell,...result}));`;
  const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", program], {
    cwd: new URL("../../../apps/harness/desktop/", import.meta.url), env: { ...process.env, SHELL: "/usr/bin/fish" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let stderr = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  const code = await new Promise<number | null>((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  expect(code, stderr).toBe(0);
  const result = JSON.parse(output.trim().split("\n").at(-1)!);
  expect(result.shell).toMatch(/\/bash$/);
  expect(result.isError).toBe(false);
  expect(result.result).toContain("heredoc works");
  expect(result.result).toContain("bash-syntax-works");
});

test.each([
  "python3 - <<'PY'\nprint(True & False)\nPY",
  'python3 - <<"PY"\nprint(True & False)\nPY',
  "python3 - <<PY\nprint(True & False)\nPY",
  "python3 - <<-E\"OF\"\n\tprint(True & False)\n\tEOF",
  "cat <<'A' <<'B'\nliteral &\nA\nother &\nB",
  "echo 'literal &' # nohup ignored &\nprintf okay",
  "printf okay 2>&1 | cat",
  "printf okay |& cat",
  'echo "$(( 1 & 2 ))"',
])("does not confuse embedded data/redirection with detached jobs: %s", command => {
  expect(checkBashInterception(command).intercepted).toBe(false);
});

test.each([
  "python3 - <<'PY'\nprint(True & False)\nPY\nsleep 1 &",
  "cat <<'PY' &\nliteral &\nPY",
  "cat <<EOF\n$(sleep 1 &)\nEOF",
  'echo "$(sleep 1 &)"',
  'echo "`sleep 1 &`"',
  "printf okay # literal &\nnohup program",
])("still rejects detached jobs outside/expanded within heredocs: %s", command => {
  expect(checkBashInterception(command).intercepted).toBe(true);
});

test.skipIf(process.platform === "win32")("real executor runs bitwise heredocs and exposes verification pipeline failures without changing ordinary Bash", async () => {
  const cwd = process.cwd();
  const bitwise = await executeNativeTool("bash", { command: "python3 - <<'PY'\nprint(True & False)\nPY" }, cwd);
  expect(bitwise.isError).toBe(false);
  expect(bitwise.result).toContain("False");
  const command = 'python3 -c "raise RuntimeError(\'AUDIT_ONLY\')" 2>&1 | tail -3';
  const ordinary = await executeNativeTool("bash", { command }, cwd);
  expect(ordinary.isError).toBe(false);
  const verification = await executeNativeTool("bash", { command, verify: true }, cwd);
  expect(verification.isError).toBe(true);
  expect(verification.result).toContain("AUDIT_ONLY");
  const pass = await executeNativeTool("bash", { command: "printf passed | cat", verify: true }, cwd);
  expect(pass.isError).toBe(false);
  const intentional = await executeNativeTool("bash", { command: "seq 100000 | head -n 1" }, cwd);
  expect(intentional.isError).toBe(false);
});
