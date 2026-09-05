"use client";

import { useState } from "react";
import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
  toast,
} from "@const/ui";
import { Copy, Check, Code2, X } from "lucide-react";
import { type ChatMessage } from "./chat-message-item";

interface ViewCodeDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  modelId: string;
  messages: ChatMessage[];
  systemInstruction?: string;
  temperature: number;
  thinkingLevel?: string;
}

export function ViewCodeDialog({
  open,
  onOpenChange,
  onClose,
  modelId,
  messages,
  systemInstruction,
  temperature,
  thinkingLevel,
}: ViewCodeDialogProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("curl");

  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };

  // Construct message payload for display
  const payloadMessages: Array<{ role: string; content: string }> = [];
  if (systemInstruction?.trim()) {
    payloadMessages.push({ role: "system", content: systemInstruction.trim() });
  }
  if (messages.length > 0) {
    messages.forEach((m) => {
      payloadMessages.push({ role: m.role, content: m.content });
    });
  } else {
    payloadMessages.push({ role: "user", content: "Hello! What can you do?" });
  }

  // 1. cURL snippet
  const curlCode = `curl https://router.const.web.id/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $CONST_API_KEY" \\
  -d '${JSON.stringify(
    {
      model: modelId,
      messages: payloadMessages,
      temperature,
      ...(thinkingLevel ? { reasoning_effort: thinkingLevel } : {}),
      stream: true,
    },
    null,
    2
  )}'`;

  // 2. Python (OpenAI SDK Compatible) snippet
  const pythonCode = `from openai import OpenAI

client = OpenAI(
    base_url="https://router.const.web.id/v1",
    api_key="sk-const-live-YOUR_API_KEY",
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=${JSON.stringify(payloadMessages, null, 4)},
    temperature=${temperature},${
    thinkingLevel ? `\n    reasoning_effort="${thinkingLevel}",` : ""
  }
    stream=True,
)

for chunk in response:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)
`;

  // 3. TypeScript / JavaScript snippet
  const tsCode = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://router.const.web.id/v1",
  apiKey: process.env.CONST_API_KEY || "sk-const-live-YOUR_API_KEY",
});

async function main() {
  const stream = await client.chat.completions.create({
    model: "${modelId}",
    messages: ${JSON.stringify(payloadMessages, null, 4)},
    temperature: ${temperature},${
    thinkingLevel ? `\n    reasoning_effort: "${thinkingLevel}",` : ""
  }
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}

main().catch(console.error);
`;

  const getActiveCode = () => {
    switch (activeTab) {
      case "python":
        return pythonCode;
      case "typescript":
        return tsCode;
      default:
        return curlCode;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    toast.success("Code snippet copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-[520px] md:max-w-[620px] p-0 flex flex-col bg-card border-l border-border/70 shadow-2xl z-50 gap-0"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center border border-border/70 text-foreground shrink-0">
              <Code2 className="h-4 w-4" />
            </div>
            <div>
              <SheetTitle className="font-sans text-base sm:text-lg font-semibold text-foreground">
                Get code
              </SheetTitle>
              <p className="text-xs text-muted-foreground font-normal">
                Ready-to-use client snippets with OpenAI SDK compatibility.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="h-8 rounded-full text-xs font-medium gap-1.5 border-border/70 cursor-pointer hover:bg-secondary"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-foreground" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copied" : "Copy code"}</span>
            </Button>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                aria-label="Close code panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </div>

        {/* Tabs & Code Viewport */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-4 sm:px-6 pt-3 pb-3 bg-secondary/20 shrink-0">
            <TabsList className="bg-secondary/60 rounded-full h-8 p-0.5 border border-border/40">
              <TabsTrigger
                value="curl"
                className="rounded-full text-xs h-7 px-3.5 data-[state=active]:bg-foreground data-[state=active]:text-background cursor-pointer font-sans"
              >
                cURL
              </TabsTrigger>
              <TabsTrigger
                value="python"
                className="rounded-full text-xs h-7 px-3.5 data-[state=active]:bg-foreground data-[state=active]:text-background cursor-pointer font-sans"
              >
                Python
              </TabsTrigger>
              <TabsTrigger
                value="typescript"
                className="rounded-full text-xs h-7 px-3.5 data-[state=active]:bg-foreground data-[state=active]:text-background cursor-pointer font-sans"
              >
                TypeScript
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto p-4 sm:p-6 bg-secondary/10">
            <TabsContent value="curl" className="mt-0 h-full">
              <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto leading-relaxed border border-border/60">
                <code>{curlCode}</code>
              </pre>
            </TabsContent>

            <TabsContent value="python" className="mt-0 h-full">
              <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto leading-relaxed border border-border/60">
                <code>{pythonCode}</code>
              </pre>
            </TabsContent>

            <TabsContent value="typescript" className="mt-0 h-full">
              <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto leading-relaxed border border-border/60">
                <code>{tsCode}</code>
              </pre>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
