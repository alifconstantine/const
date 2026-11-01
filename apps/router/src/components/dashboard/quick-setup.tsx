"use client";
import { useState } from "react";
import { Button, ScrollArea, toast, cn } from "@const/ui";
import { Copy, Check } from "lucide-react";
const QUICK_SETUP_CODE = {
  curl: `curl https://router.const.web.id/v1/chat/completions \\
  -H "Authorization: Bearer sk-const-live-YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4.1-flash:free",
    "messages": [{"role": "user", "content": "Hello world"}]
  }'`,
  python: `from openai import OpenAI

client = OpenAI(
    base_url="https://router.const.web.id/v1",
    api_key="sk-const-live-YOUR_API_KEY",
)

response = client.chat.completions.create(
    model="deepseek-v4.1-flash:free",
    messages=[{"role": "user", "content": "Hello world"}],
)
print(response.choices[0].message.content)`,
  javascript: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://router.const.web.id/v1",
  apiKey: process.env.CONST_API_KEY,
});

const response = await client.chat.completions.create({
  model: "deepseek-v4.1-flash:free",
  messages: [{ role: "user", content: "Hello world" }],
});
console.log(response.choices[0].message.content);`,
};

export function QuickSetup() {
  const [language, setLanguage] =
    useState<keyof typeof QUICK_SETUP_CODE>("curl");
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(QUICK_SETUP_CODE[language]);
      setCopied(true);
      toast.success("Snippet copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy snippet. Select and copy the code below.");
    }
  }
  return (
    <section className="min-w-0 space-y-4" aria-label="Quick setup">
      <h2 className="text-base font-medium">Make your first call</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border p-2">
          <div className="flex gap-1">
            {(
              [
                ["curl", "cURL"],
                ["python", "Python"],
                ["javascript", "Node.js"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={language === value}
                onClick={() => {
                  setLanguage(value);
                  setCopied(false);
                }}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-ring",
                  language === value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={copied ? "Snippet copied" : "Copy snippet"}
            onClick={copy}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
        <ScrollArea
          orientation="horizontal"
          viewportRef={(node) => {
            if (node) {
              node.tabIndex = 0;
              node.setAttribute("aria-label", "API setup example");
              node.setAttribute("role", "region");
            }
          }}
        >
          <pre className="p-4 text-[11px] leading-6 text-muted-foreground">
            <code>{QUICK_SETUP_CODE[language]}</code>
          </pre>
        </ScrollArea>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Use your API key with any OpenAI-compatible client.
      </p>
    </section>
  );
}
