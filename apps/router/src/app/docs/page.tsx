import Link from "next/link";
import { ROUTER_ENDPOINTS } from "@/lib/api-contract";
import { FREE_MODEL_IDS, BUILTIN_MODELS } from "@/lib/model-specs";
import { Button, Badge, ScrollArea } from "@const/ui";
export default function DocsPage() {
  const snippet =
    'from openai import OpenAI\n\nclient = OpenAI(\n    base_url="https://router.const.web.id/v1",\n    api_key="YOUR_CONST_API_KEY",\n)\n\nstream = client.chat.completions.create(\n    model="deepseek-v4.1-flash:free",\n    messages=[{"role": "user", "content": "Hello"}],\n    stream=True,\n    max_tokens=1024,\n)\nfor event in stream:\n    if event.choices:\n        print(event.choices[0].delta.content or "", end="")';
  return (
    <main className="max-w-4xl mx-auto px-5 py-12 space-y-10">
      <header className="space-y-4">
        <Link href="/dashboard" className="text-sm text-muted-foreground">
          Const Router
        </Link>
        <h1 className="text-4xl font-medium tracking-tight">
          API documentation
        </h1>
        <p className="text-muted-foreground">
          Use the exact model IDs in the catalog. These examples describe the
          endpoints currently available on this Router.
        </p>
        <Button asChild variant="outline">
          <Link href="/keys">Create an API key</Link>
        </Button>
      </header>
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Authentication</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Send Authorization: Bearer YOUR_CONST_API_KEY. Keys are revealed once
          when created. Invalid, revoked, or daily-capped keys are rejected
          before model execution. The Playground uses your verified account
          session by default.
        </p>
        <p className="text-sm text-muted-foreground">
          The base URL is <code>https://router.const.web.id/v1</code>. For a
          local installation, use your Router origin followed by /v1.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Quickstart</h2>
        <ScrollArea orientation="horizontal" className="rounded-2xl bg-card">
          <pre className="p-6 text-xs leading-6 font-mono">{snippet}</pre>
        </ScrollArea>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Free and paid models</h2>
        <p className="text-sm text-muted-foreground">
          Free variants share a 7,000,000-token allowance per seven-day cycle.
          Input, cached input, and output count toward this allowance. Only
          these IDs are eligible:
        </p>
        <ul className="space-y-2">
          {FREE_MODEL_IDS.map((id) => (
            <li className="font-mono text-sm" key={id}>
              {id}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Other model IDs ending in :free are rejected. The same eligible models
          without :free are paid variants. All paid chat models debit your
          credit balance using their input, cached input, and output prices.
          Search is billed per request; transcription per minute. Unused
          reserved credit is released when the request ends. Top-ups are not
          available yet.
        </p>
        <Button asChild variant="outline">
          <Link href="/models">View prices and model IDs</Link>
        </Button>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Chat request</h2>
        <p className="text-sm text-muted-foreground">
          POST /v1/chat/completions accepts messages, model, stream,
          temperature, max_tokens or max_completion_tokens, tools, tool_choice,
          response_format, and reasoning_effort. If model, temperature, or
          stream is omitted, your saved account defaults are applied. Chat
          supports streaming and JSON responses. The default output reservation
          is 1,024 tokens; specify max_tokens when you need more.
        </p>
        <p className="text-sm text-muted-foreground">
          Use web_search: "research" or "deep-research" to add a billed search
          before chat. This requires credit even when the chat model is free.
          Requests reserve their input estimate and output limit; images reserve
          the model context capacity.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Combos always stream</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Use model: "combo/YOUR_SLUG". Combos always return server-sent events,
          including when stream is omitted or false. Use stream=True in SDK
          clients. Each selected target keeps its own free or paid billing mode.
          A :free target reduces weekly free quota; a paid target debits credit.
          Disabled combos cannot execute. Failed attempts before generation
          release their reservation; a stream already producing output is not
          replayed through another target.
        </p>
        <p className="text-sm text-muted-foreground">
          X-Const-Combo-Selected-Model identifies the executed target. Tool
          calls and tool result IDs are preserved. Priority, random, and
          round-robin strategies are resolved by the server.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Available endpoints</h2>
        <div className="rounded-2xl bg-card divide-y divide-border/40">
          {ROUTER_ENDPOINTS.map((e) => (
            <div key={e.path} className="p-4 space-y-2">
              <p className="font-mono text-xs">
                <Badge variant="secondary" className="mr-3">
                  {e.method}
                </Badge>
                {e.path}
              </p>
              <p className="text-xs text-muted-foreground">{e.description}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Audio, search, and extraction</h2>
        <p className="text-sm text-muted-foreground">
          Transcription uses multipart/form-data with file and
          model="whisper-large-v3-turbo". Upload up to 25 MB of audio. Supported
          output formats are json, verbose_json and text. A conservative
          duration is reserved from your balance; actual duration is used when
          supplied by the engine, otherwise the log is marked estimated.
        </p>
        <p className="text-sm text-muted-foreground">
          Search accepts query, mode="research" or "deep-research", and
          num_results (1–15). Fetch accepts url, crawl_subpages, and max_pages
          (1–25). Only public HTTP(S) pages are allowed. Transcript accepts a
          YouTube URL or video ID. These endpoints require authentication.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Usage, privacy, and limits</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Each completed or interrupted request has a unique X-Const-Request-Id.
          Usage settlement is idempotent. Paid cost is recorded in Usage logs
          and Transaction history. Free and paid filters show separate usage.
          Where the engine omits token usage, estimates use generated text and
          are labelled estimated. Cached tokens remain visible as part of input.
        </p>
        <p className="text-sm text-muted-foreground">
          Up to 8 active requests and 60 request attempts per minute are allowed
          per user. Model attempts have a 180-second deadline. Daily key limits
          reset at 00:00 UTC. Configure defaults, prompt retention,
          IP/user-agent anonymization and low-quota alerts in Settings.
          Disabling prompt retention does not remove previously saved logs or
          Playground history.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-medium">Errors</h2>
        <div className="text-sm text-muted-foreground space-y-2">
          {[
            [400, "Invalid request or unsupported model ID"],
            [401, "Missing, expired, invalid, or revoked credentials"],
            [402, "Insufficient available credit"],
            [413, "Upload or request too large"],
            [429, "Quota, daily key, concurrency, or request limit reached"],
            [502, "Upstream model failed"],
            [503, "Gateway or metering unavailable"],
            [504, "Request timed out"],
          ].map(([status, message]) => (
            <p key={status}>
              <code className="text-foreground mr-3">{status}</code>
              {message}
            </p>
          ))}
        </div>
      </section>
      <p className="text-xs text-muted-foreground">
        {BUILTIN_MODELS.length} model variants are listed. Responses, Anthropic
        Messages, embeddings, TTS, images, music, and video endpoints are not
        implemented.
      </p>
    </main>
  );
}
