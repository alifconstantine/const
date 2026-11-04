"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export const QUICKSTART_TABS = [
  {
    label: "cURL",
    code: `curl https://router.const.web.id/v1/chat/completions \\
  -H "Authorization: Bearer $CONST_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v4.1-flash",
    "messages": [{"role": "user", "content": "Hello, Const."}],
    "stream": false
  }'`,
  },
  {
    label: "Python",
    code: `import os
from openai import OpenAI

client = OpenAI(
    base_url="https://router.const.web.id/v1",
    api_key=os.environ["CONST_API_KEY"],
)

response = client.chat.completions.create(
    model="deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Hello, Const."}],
    stream=False,
)
print(response.choices[0].message.content)`,
  },
  {
    label: "TypeScript",
    code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://router.const.web.id/v1",
  apiKey: process.env.CONST_API_KEY,
});

const response = await client.chat.completions.create({
  model: "deepseek-v4.1-flash",
  messages: [{ role: "user", content: "Hello, Const." }],
  stream: false,
});
console.log(response.choices[0]?.message.content);`,
  },
];
export function CodeBlock({
  tabs,
  label = "Example",
}: {
  tabs: { label: string; code: string }[];
  label?: string;
}) {
  const [active, setActive] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const tab = tabs[active] ?? tabs[0]!;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tab.code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    setTimeout(() => setCopyState("idle"), 2500);
  };
  return (
    <div className="router-code-block" role="group" aria-label={label}>
      <div className="router-code-toolbar">
        <div
          className="router-code-tabs"
          role="group"
          aria-label="Example language"
        >
          {tabs.map((item, index) => (
            <button
              type="button"
              aria-pressed={active === index}
              key={item.label}
              onClick={() => {
                setActive(index);
                setCopyState("idle");
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="router-copy"
          onClick={copy}
          aria-label={`Copy ${tab.label} example`}
        >
          {copyState === "copied" ? <Check size={14} /> : <Copy size={14} />}
          <span aria-live="polite">
            {copyState === "copied"
              ? "Copied"
              : copyState === "error"
                ? "Try again"
                : "Copy"}
          </span>
        </button>
      </div>
      <pre tabIndex={0}>
        <code>{tab.code}</code>
      </pre>
    </div>
  );
}
