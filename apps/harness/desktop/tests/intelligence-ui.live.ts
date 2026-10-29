import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_MODELS } from "../../../../packages/agent/src/const/models";
import { INTELLIGENCE_UI_PROMPT } from "../src/components/intelligence-ui/prompt";
import {
  readCompletionStream,
  validateGeneratedUi,
} from "./intelligence-ui-live-support";

interface LiveConfig {
  activeModel?: string;
  activeProvider?: string;
  providers?: Record<string, { baseUrl?: string; apiKey?: string }>;
  customModels?: Array<{
    id: string;
    displayName: string;
    provider: string;
    baseUrl?: string;
  }>;
}

async function run() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check-config");
  const outputIndex = args.indexOf("--output");
  if (args.includes("--help")) {
    console.log(
      "Live, tool-free UI generation test. Uses desktop provider configuration; sends synthetic data only.\nOptions: --check-config, --output <path>.\nOverrides: INTELLIGENCE_UI_MODEL, INTELLIGENCE_UI_BASE_URL, CONST_ROUTER_API_KEY.",
    );
    return;
  }
  if (
    outputIndex >= 0 &&
    (!args[outputIndex + 1] || args[outputIndex + 1]!.startsWith("--"))
  )
    throw new Error("--output requires a file path.");
  const configPath = [
    path.join(os.homedir(), ".const/harness/config.json"),
    path.join(os.homedir(), ".const/config.json"),
  ].find((file) => fs.existsSync(file));
  const config: LiveConfig = configPath
    ? JSON.parse(fs.readFileSync(configPath, "utf8"))
    : {};
  const model =
    process.env.INTELLIGENCE_UI_MODEL ||
    config.activeModel ||
    "gemini-3.8-flash";
  const modelDef = [...DEFAULT_MODELS, ...(config.customModels || [])].find(
    (item) => item.id === model || item.displayName === model,
  );
  const providerId = modelDef?.provider || config.activeProvider || "const";
  const provider = config.providers?.[providerId] || config.providers?.const;
  const baseUrl =
    process.env.INTELLIGENCE_UI_BASE_URL ||
    modelDef?.baseUrl ||
    provider?.baseUrl ||
    "https://router.const.web.id/v1";
  const credential = process.env.CONST_ROUTER_API_KEY || provider?.apiKey || "";
  const endpoint = baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const summary = {
    model,
    provider: providerId,
    endpointHost: new URL(endpoint).host,
    credentialConfigured: Boolean(credential),
  };
  if (checkOnly) {
    console.log(JSON.stringify(summary));
    return;
  }

  const prompt =
    "Gunakan Intelligent UI dalam satu blok untuk data proyek berikut. Alpha: selesai 12, delta anggaran -30; Bima: selesai 8, delta 120; Cakra: selesai 15, delta -2; Damar: selesai 6, delta 12; Elang: selesai 10, delta 0; Fajar: selesai 9, delta 25. Semua delta dalam juta rupiah. Buat Card ringkasan berisi Text dan Metric jumlah proyek, Table seluruh enam proyek, BarChart delta termasuk nilai negatif dan nol, dan Form berisi pilihan prioritas (select) serta catatan (text), tombol Kirim pilihan. Tunggu submit sebelum membuat rencana. Berikan pengantar Markdown. Gunakan hanya data yang diberikan tanpa menyimpulkan arti positif/negatif delta. Jangan menjalankan tool atau mengubah file.";
  const started = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: INTELLIGENCE_UI_PROMPT },
        { role: "user", content: prompt },
      ],
      stream: true,
      max_tokens: 4096,
      max_completion_tokens: 4096,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `Provider rejected the live request (HTTP ${response.status}). Check its connection, model, and authentication settings.`,
    );
  }
  if (
    !response.body ||
    !response.headers.get("content-type")?.includes("text/event-stream")
  ) {
    await response.body?.cancel();
    throw new Error("The provider did not return the requested event stream.");
  }
  const completion = await readCompletionStream(response.body);
  const validation = validateGeneratedUi(completion.content);
  const output =
    outputIndex >= 0
      ? path.resolve(args[outputIndex + 1]!)
      : path.join(
          fs.mkdtempSync(path.join(os.tmpdir(), "const-intelligence-ui-")),
          "live-result.json",
        );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(
    output,
    JSON.stringify(
      { model, ...completion, ...validation, durationMs: Date.now() - started },
      null,
      2,
    ),
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      ...summary,
      events: completion.events,
      usage: completion.usage,
      ...validation,
      output,
      durationMs: Date.now() - started,
    }),
  );
  if (validation.errors.length) process.exitCode = 1;
}

run().catch((error: unknown) => {
  // Never print provider payloads, authorization headers, or credentials.
  console.error(
    error instanceof Error &&
      (error.message.startsWith("Provider rejected") ||
        error.message.startsWith("The provider") ||
        error.message.startsWith("The stream") ||
        error.message.startsWith("Generation") ||
        error.message.startsWith("Unexpected") ||
        error.message.startsWith("--output"))
      ? error.message
      : "Live UI test failed. Check the provider configuration and output path.",
  );
  process.exitCode = 1;
});
