"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ConstLogoIcon } from "@const/ui";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { CodeBlock, QUICKSTART_TABS } from "@/components/landing/CodeBlock";
import { ROUTER_ENDPOINTS } from "@/lib/api-contract";
import { BUILTIN_MODELS, FREE_MODEL_IDS } from "@/lib/model-specs";
import "../landing.css";

const groups = [
  {
    title: "Start building",
    items: [
      ["quickstart", "Quickstart"],
      ["authentication", "Authentication"],
      ["models-allowance", "Models & allowance"],
      ["sdks", "SDK configuration"],
      ["agents-setup", "Coding agents"],
    ],
  },
  {
    title: "Chat API",
    items: [
      ["chat", "Chat completions"],
      ["streaming", "Streaming"],
      ["reasoning-effort", "Reasoning effort"],
      ["web-search-grounding", "Search grounding"],
      ["vision", "Multimodal inputs"],
      ["tools-json", "Tools & JSON output"],
    ],
  },
  {
    title: "Utility APIs",
    items: [
      ["models-api", "Model catalog"],
      ["audio-transcription", "Audio transcription"],
      ["web-search-api", "Web search"],
      ["web-fetch-api", "Web content"],
      ["youtube-transcript-api", "YouTube transcript"],
    ],
  },
  {
    title: "Routing & usage",
    items: [
      ["combos", "Virtual Combos"],
      ["headers", "Response headers"],
      ["keys-guardrails", "API key limits"],
      ["errors", "Errors & recovery"],
      ["metering", "Metering & billing"],
    ],
  },
];
const base = "https://router.const.web.id";
const request = (path: string, body: object) => `curl ${base}${path} \\
  -H "Authorization: Bearer $CONST_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body, null, 2)}'`;
const snippet = (code: string, label = "cURL") => (
  <CodeBlock tabs={[{ label, code }]} />
);
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="router-docs-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Table({
  headings,
  rows,
}: {
  headings: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="router-docs-table-wrap" tabIndex={0} role="region" aria-label={`${headings.join(", ")} reference`}>
      <table className="router-docs-table">
        <thead>
          <tr>
            {headings.map((heading) => (
              <th scope="col" key={heading}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  const [active, setActive] = useState("quickstart");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => {
    document.title = "API documentation — Const Router";
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sections = [...document.querySelectorAll<HTMLElement>(".router-docs-section")];
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
        const section = atBottom ? sections[sections.length - 1]
          : sections.filter(item => item.getBoundingClientRect().top <= 180).pop() || sections[0];
        if (section) setActive(section.id);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("hashchange", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("hashchange", update);
    };
  }, []);
  const copyBase = async () => {
    try {
      await navigator.clipboard.writeText(`${base}/v1`);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
    setTimeout(() => {
      setCopied(false);
      setCopyError(false);
    }, 2500);
  };
  return (
    <div className="router-docs">
      <header className="router-docs-header">
        <Link href="/" className="router-brand" aria-label="Const Router home">
          <ConstLogoIcon size="md" />
          <span>
            Const<span className="router-brand-product">Router</span>
          </span>
        </Link>
        <div>
          <Link className="router-text-link" href="/models">
            Models &amp; pricing
          </Link>
          <Link className="router-nav-cta" href="/keys">
            Get an API key <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>
      <div className="router-docs-topic-picker">
        <label htmlFor="docs-topic">On this page</label>
        <select
          id="docs-topic"
          value={active}
          onChange={(event) => {
            setActive(event.target.value);
            window.location.hash = event.target.value;
          }}
        >
          {groups.map((group) => (
            <optgroup label={group.title} key={group.title}>
              {group.items.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="router-docs-shell">
        <aside className="router-docs-sidebar">
          <nav aria-label="Documentation topics">
            {groups.map((group) => (
              <div key={group.title}>
                <h2>{group.title}</h2>
                {group.items.map(([id, title]) => (
                  <a
                    href={`#${id}`}
                    key={id}
                    aria-current={active === id ? "true" : undefined}
                    onClick={() => setActive(id!)}
                  >
                    {title}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <main id="main-content" className="router-docs-main">
          <header>
            <h1>Build with Const Router.</h1>
            <p>
              One gateway for chat models, streaming, tools, and research
              utilities. This guide takes you from your first API key to a
              working request.
            </p>
            <div className="router-docs-base">
              <code>{base}/v1</code>
              <button
                className="router-copy"
                type="button"
                onClick={copyBase}
                aria-label="Copy API base URL"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span aria-live="polite">
                  {copied ? "Copied" : copyError ? "Try again" : "Copy"}
                </span>
              </button>
            </div>
          </header>
          <Section id="quickstart" title="Your first request">
            <p>
              <Link href="/keys">Create an API key</Link>, save it as{" "}
              <code>CONST_API_KEY</code> in your server environment, and send a
              request. This example uses a free model and explicitly requests a
              non-streaming response.
            </p>
            <CodeBlock tabs={QUICKSTART_TABS} />
            <p>
              Install the <code>openai</code> package for the Python or
              TypeScript example. Keep your API key on your server.
            </p>
          </Section>
          <Section id="authentication" title="Authentication">
            <p>
              Send an active Const API key in the <code>Authorization</code>{" "}
              header. Keys begin with <code>sk-const-live-</code> and are shown
              once when you create them.
            </p>
            {snippet(
              "Authorization: Bearer sk-const-live-YOUR_API_KEY",
              "HTTP header",
            )}
            <p>
              Create, name, and revoke keys in{" "}
              <Link href="/keys">API Keys</Link>. The backend stores a SHA-256
              hash for verification. Invalid or revoked keys receive an
              authentication error.
            </p>
          </Section>
          <Section id="models-allowance" title="Models & free allowance">
            <p>
              The default free chat allowance is 7 million tokens per 7-day
              period, shared across the listed <code>:free</code> variants. The
              dashboard shows your remaining allowance and next reset.
            </p>
            <div className="router-free-models">
              {FREE_MODEL_IDS.map((id) => (
                <code key={id}>{id}</code>
              ))}
            </div>
            <div className="router-docs-callout">
              <p>
                <strong>The exact model ID determines billing.</strong>{" "}
                <code>deepseek-v4.1-flash:free</code> uses the free allowance.{" "}
                <code>deepseek-v4.1-flash</code> uses wallet credit. Adding{" "}
                <code>:free</code> to an unlisted model does not make it free.
              </p>
            </div>
            <p>
              Paid model requests reserve credit before inference and settle
              against recorded usage. See{" "}
              <Link href="/models">the model catalog</Link> for input, cached
              input, output, and utility rates.
            </p>
          </Section>
          <Section id="sdks" title="Configure your SDK">
            <p>
              The chat endpoint accepts the OpenAI chat-completions format. Set
              the base URL to <code>https://router.const.web.id/v1</code> and
              provide your Const API key.
            </p>
            {snippet(
              `# Python
client = OpenAI(
    base_url="https://router.const.web.id/v1",
    api_key=os.environ["CONST_API_KEY"],
)

// TypeScript
const client = new OpenAI({
  baseURL: "https://router.const.web.id/v1",
  apiKey: process.env.CONST_API_KEY,
});`,
              "Client configuration",
            )}
            <p>
              Compatibility is with the documented endpoints and parameters on
              this page. A Claude model in the catalog is called through chat
              completions.
            </p>
          </Section>
          <Section id="agents-setup" title="Connect a coding agent">
            <p>
              For an agent or editor that supports an OpenAI-compatible
              provider, configure these three fields. Select a model ID from the
              catalog.
            </p>
            {snippet(
              `Provider:  OpenAI compatible
Base URL:  https://router.const.web.id/v1
API key:   sk-const-live-YOUR_API_KEY
Model ID:  deepseek-v4.1-flash:free`,
              "Provider settings",
            )}
            <p>
              If your tool requires a different API protocol, check its provider
              support before connecting.
            </p>
          </Section>
          <Section id="chat" title="Chat completions">
            <p>
              <code>POST /v1/chat/completions</code> accepts a model and
              conversation messages. Roles include <code>system</code>,{" "}
              <code>developer</code>, <code>user</code>, <code>assistant</code>,
              and <code>tool</code>.
            </p>
            {snippet(
              request("/v1/chat/completions", {
                model: FREE_MODEL_IDS[0],
                messages: [
                  {
                    role: "system",
                    content: "You are a concise software architect.",
                  },
                  { role: "user", content: "Compare two caching strategies." },
                ],
                temperature: 0.2,
                max_tokens: 1024,
                stream: false,
              }),
            )}
            <Table
              headings={["Parameter", "Behavior"]}
              rows={[
                [
                  <code key="m">messages</code>,
                  "Required; between 1 and 500 messages.",
                ],
                [
                  <code key="model">model</code>,
                  "An exact catalog ID or combo/slug. When omitted, account settings supply the default.",
                ],
                [
                  <code key="temp">temperature</code>,
                  "A number between 0 and 2.",
                ],
                [
                  <code key="max">max_tokens / max_completion_tokens</code>,
                  "An integer between 1 and 128,000, subject to model support.",
                ],
                [
                  <code key="s">stream</code>,
                  "A boolean. When omitted, account streaming settings apply.",
                ],
              ]}
            />
          </Section>
          <Section id="streaming" title="Streaming responses">
            <p>
              Set <code>stream: true</code> to receive server-sent events. The
              router passes upstream frames through and sends keep-alive
              comments. Usage frames can contain an empty <code>choices</code>{" "}
              array; check it before reading a delta.
            </p>
            {snippet(
              `stream = client.chat.completions.create(
    model="deepseek-v4.1-flash:free",
    messages=[{"role": "user", "content": "Explain a cache miss."}],
    stream=True,
)

for chunk in stream:
    if chunk.choices:
        content = chunk.choices[0].delta.content
        if content:
            print(content, end="", flush=True)`,
              "Python",
            )}
            <p>
              The gateway requests upstream usage data. When it is absent, usage
              is estimated and recorded as estimated. A stream that ends without
              a terminal frame returns an <code>incomplete_stream</code> error
              event; handle errors while consuming the stream.
            </p>
          </Section>
          <Section id="reasoning-effort" title="Reasoning effort">
            <p>
              Pass <code>reasoning_effort</code> to models that support
              thinking. The catalog records support and default effort. Accepted
              behavior depends on the selected upstream model.
            </p>
            {snippet(
              `response = client.chat.completions.create(
    model="deepseek-v4.1-flash:free",
    messages=[{"role": "user", "content": "Review this locking strategy."}],
    reasoning_effort="high",
    stream=False,
)`,
              "Python",
            )}
            <p>
              Catalog thinking levels include <code>low</code>,{" "}
              <code>medium</code>, <code>high</code>, <code>xhigh</code>, and{" "}
              <code>max</code>. The gateway also accepts{" "}
              <code>reasoning: {'{"effort": "high"}'}</code> as an alias.
            </p>
          </Section>
          <Section id="web-search-grounding" title="Ground a chat with search">
            <p>
              Add <code>web_search: true</code> for research or{" "}
              <code>web_search: "deep-research"</code> for deeper search. The
              router searches the latest user text and prepends source
              references to the conversation. Search is billed separately from
              model tokens.
            </p>
            {snippet(
              request("/v1/chat/completions", {
                model: FREE_MODEL_IDS[0],
                messages: [
                  {
                    role: "user",
                    content: "Find recent research on battery recycling.",
                  },
                ],
                web_search: "deep-research",
                stream: false,
              }),
            )}
          </Section>
          <Section id="vision" title="Multimodal inputs">
            <p>
              Send content parts to a model whose catalog entry supports that
              input type. Image, audio, and video support varies by model.
            </p>
            {snippet(
              request("/v1/chat/completions", {
                model: FREE_MODEL_IDS[0],
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: "Describe this image." },
                      {
                        type: "image_url",
                        image_url: { url: "https://example.com/image.jpg" },
                      },
                    ],
                  },
                ],
                stream: false,
              }),
            )}
            <p>
              Replace the example URL with your accessible image. Media inputs
              can reserve a larger token budget than text, so check available
              quota or credit first.
            </p>
          </Section>
          <Section id="tools-json" title="Tool calls & JSON output">
            <p>
              The gateway forwards <code>tools</code>, <code>tool_choice</code>,{" "}
              <code>parallel_tool_calls</code>, and <code>response_format</code>
              . Support depends on the selected model. Your application executes
              returned tool calls and sends results back as tool messages.
            </p>
            {snippet(
              request("/v1/chat/completions", {
                model: FREE_MODEL_IDS[0],
                messages: [
                  {
                    role: "user",
                    content: "Return a JSON object with a greeting.",
                  },
                ],
                response_format: { type: "json_object" },
                stream: false,
              }),
            )}
            {snippet(
              `tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Read weather for a city",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}]`,
              "Python tool definition",
            )}
          </Section>
          <Section id="models-api" title="Discover available models">
            <p>
              <code>GET /v1/models</code> returns the public model catalog.
              Authenticate to include your active Virtual Combos.
            </p>
            {snippet(`curl ${base}/v1/models`)}
            <Table
              headings={["Method", "Endpoint", "Purpose"]}
              rows={ROUTER_ENDPOINTS.map((endpoint) => [
                endpoint.method,
                <code key={endpoint.path}>{endpoint.path}</code>,
                endpoint.description,
              ])}
            />
          </Section>
          <Section id="audio-transcription" title="Audio transcription">
            <p>
              Upload an audio or video file of up to 25 MB to{" "}
              <code>POST /v1/audio/transcriptions</code>. Select{" "}
              <code>whisper-large-v3-turbo</code>. Supported response formats
              are <code>json</code>, <code>verbose_json</code>, and{" "}
              <code>text</code>.
            </p>
            {snippet(`curl ${base}/v1/audio/transcriptions \\
  -H "Authorization: Bearer $CONST_API_KEY" \\
  -F "file=@meeting.mp3" \\
  -F "model=whisper-large-v3-turbo" \\
  -F "response_format=verbose_json"`)}
            <p>
              Transcription is charged per audio minute at{" "}
              {BUILTIN_MODELS.find(
                (model) => model.id === "whisper-large-v3-turbo",
              )?.pricing?.input ?? "the published catalog rate"}
              . Duration is estimated when the upstream response omits it.
            </p>
          </Section>
          <Section id="web-search-api" title="Web search">
            <p>
              <code>POST /v1/search</code> accepts <code>query</code>,{" "}
              <code>mode</code> (<code>research</code> or{" "}
              <code>deep-research</code>), and <code>num_results</code> (1–15).
              Queries must contain at most 4,000 characters. GET requests accept
              the same query parameters.
            </p>
            {snippet(
              request("/v1/search", {
                query: "Recent battery recycling research",
                mode: "research",
                num_results: 5,
              }),
            )}
            <p>
              Search costs{" "}
              {BUILTIN_MODELS.find((model) => model.id === "const-search")
                ?.pricing?.input ?? "the published catalog rate"}{" "}
              per request. The response contains upstream search results.
            </p>
          </Section>
          <Section id="web-fetch-api" title="Extract web content">
            <p>
              <code>POST /v1/fetch</code> extracts text and headings from public
              HTML pages. Set <code>crawl</code> to fetch linked pages on the
              same origin. <code>max_pages</code> accepts 1–25 and defaults to
              10.
            </p>
            {snippet(
              request("/v1/fetch", {
                url: "https://docs.github.com/en/actions",
                crawl: true,
                max_pages: 5,
              }),
            )}
            <p>
              The response includes the root URL, title, content, and collected
              pages. The endpoint requires authentication; individual pages can
              fail or be unavailable.
            </p>
          </Section>
          <Section id="youtube-transcript-api" title="YouTube transcripts">
            <p>
              <code>POST /v1/transcript</code> accepts a public video URL or a{" "}
              <code>videoId</code>. It returns available timestamped captions
              with video metadata. Videos without accessible caption tracks
              cannot be transcribed by this endpoint.
            </p>
            {snippet(
              request("/v1/transcript", {
                url: "https://www.youtube.com/watch?v=YOUR_VIDEO_ID",
              }),
            )}
          </Section>
          <Section id="combos" title="Route with Virtual Combos">
            <p>
              Create an ordered model list in{" "}
              <Link href="/combos">Virtual Combos</Link>, then call it with{" "}
              <code>model: "combo/your-slug"</code>. Combos always return a
              stream, so consume them as streaming responses.
            </p>
            {snippet(
              `stream = client.chat.completions.create(
    model="combo/my-coding-stack",
    messages=[{"role": "user", "content": "Review this database query."}],
    stream=True,
)`,
              "Python",
            )}
            <p>
              Before a stream is returned, the router can try the next model on
              eligible quota, credit, capacity, timeout, or upstream errors.
              Fallback does not restart a stream that has already begun. The
              selected model and fallback count are returned in response
              headers.
            </p>
          </Section>
          <Section id="headers" title="Response headers">
            <p>
              Chat responses include a trace ID. Combo responses also identify
              which model was selected.
            </p>
            <Table
              headings={["Header", "Meaning"]}
              rows={[
                [
                  <code key="req">X-Const-Request-Id</code>,
                  "Request identifier for logs and troubleshooting.",
                ],
                [
                  <code key="selected">X-Const-Combo-Selected-Model</code>,
                  "Exact model ID selected by a Virtual Combo.",
                ],
                [
                  <code key="fallbacks">X-Const-Combo-Fallbacks</code>,
                  "Index of the selected candidate; 0 means the first model.",
                ],
              ]}
            />
            <p>
              Use <Link href="/logs">usage logs</Link> for settled billing
              amounts.
            </p>
          </Section>
          <Section id="keys-guardrails" title="API key limits">
            <p>
              You can create up to 25 API keys. Give each key a name and an
              optional positive daily token limit. Daily counters reset at 00:00
              UTC. Revoke a key to block further requests.
            </p>
            <p>
              The gateway checks reservations against your key limit, free
              allowance, and wallet before inference. A request can be rejected
              when its reserved budget exceeds the remaining amount, even if the
              final response would have used fewer tokens.
            </p>
          </Section>
          <Section id="errors" title="Errors & recovery">
            <p>
              Gateway errors use an error object with a message, type, and code.
              Check HTTP status and handle error events during streaming.
            </p>
            <Table
              headings={["Status", "Meaning", "Next step"]}
              rows={[
                [
                  "400",
                  "Invalid input or unknown model",
                  "Check JSON, parameters, and the exact model ID.",
                ],
                [
                  "401 / 403",
                  "Authentication or access denied",
                  "Check the key and account access.",
                ],
                [
                  "402",
                  "Insufficient credit or free allowance",
                  "Check your credits, choose an eligible free model, or wait for the allowance to reset.",
                ],
                [
                  "413",
                  "Payload exceeds the limit",
                  "Keep chat below 4,000,000 bytes; audio files at most 25 MB.",
                ],
                [
                  "429",
                  "Daily key limit or no available combo candidate",
                  "Check limits or retry after capacity recovers.",
                ],
                [
                  "502 / 503 / 504",
                  "Upstream failure, unavailable service, or timeout",
                  "Retry with backoff; inspect the request trace ID.",
                ],
              ]}
            />
            {snippet(
              JSON.stringify(
                {
                  error: {
                    message: "Sign in or supply an active Const API key.",
                    type: "authentication_error",
                    code: 401,
                  },
                },
                null,
                2,
              ),
              "JSON",
            )}
            <p>
              Chat timeouts are configured by the gateway. Utility endpoints
              have their own timeouts.
            </p>
          </Section>
          <Section id="metering" title="Metering & billing">
            <p>
              Chat usage uses upstream token reports when available, including
              cached input tokens. When upstream usage is missing, the gateway
              estimates tokens and marks that usage as estimated.
            </p>
            <p>
              Credit is reserved before a request and reconciled after
              settlement. Interrupted requests can still include billable tokens
              already processed. Free variants deduct token usage from your
              allowance instead of wallet credit.
            </p>
            <p>
              Review tokens, duration, status, and cost in{" "}
              <Link href="/logs">request logs</Link>, and wallet transactions in{" "}
              <Link href="/credits">credits</Link>. Internal amounts use
              nano-USD: one US dollar equals 1,000,000,000 nano-USD.
            </p>
          </Section>
        </main>
      </div>
    </div>
  );
}
