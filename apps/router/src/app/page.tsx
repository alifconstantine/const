"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useRouterAuth } from "@/components/providers/convex-client-provider";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ParticleBackdrop } from "@/components/landing/ParticleBackdrop";
import { CodeBlock, QUICKSTART_TABS } from "@/components/landing/CodeBlock";
import { BUILTIN_MODELS } from "@/lib/model-specs";
import { ROUTER_ENDPOINTS } from "@/lib/api-contract";
import "./landing.css";

const chatModels = BUILTIN_MODELS.filter(
  (model) => model.category === "llm",
);

export default function HomePage() {
  const { isAuthenticated, signIn } = useRouterAuth();
  useEffect(() => {
    document.title = "Const Router — One API. Your choice of model.";
  }, []);
  const apiKeyAction = (label = "Get an API key") =>
    isAuthenticated ? (
      <Link className="router-button router-button-primary" href="/keys">
        {label}
        <ArrowUpRight size={17} />
      </Link>
    ) : (
      <button
        className="router-button router-button-primary"
        onClick={() => signIn("/keys")}
      >
        {label}
        <ArrowUpRight size={17} />
      </button>
    );

  return (
    <div className="router-public">
      <LandingNavbar />
      <main id="main-content">
        <section className="router-hero">
          <ParticleBackdrop />
          <div className="router-container router-hero-content">
            <div className="router-hero-copy">
              <h1>
                One API.
                <br />
                Your choice
                <br /> of model.
              </h1>
              <p>
                Build with frontier models through a single OpenAI-compatible
                API. Keep your client. Choose your model. See what each request
                costs.
              </p>
              <div className="router-actions">
                {apiKeyAction()}
                <Link className="router-text-link" href="/docs">
                  Read the docs <ArrowRight size={17} />
                </Link>
              </div>
              <div className="hero-mobile-config">
                <span>OpenAI-compatible base URL</span>
                <code>https://router.const.web.id/v1</code>
              </div>
              <div className="router-hero-caption">
                <span>OpenAI request format</span>
                <span>Streaming &amp; tool calls</span>
                <span>Pay per token</span>
              </div>
            </div>
            <div className="router-hero-integration">
              <div className="router-hero-connection">
                <span>Base URL</span>
                <code>https://router.const.web.id/v1</code>
              </div>
              <CodeBlock
                tabs={[QUICKSTART_TABS[0]!]}
                label="Make a real chat request"
              />
              <p>
                Set <code>CONST_API_KEY</code> to your API key.
                <br />
                Add credit to your account before making a request.
              </p>
            </div>
          </div>
          <a href="#start" className="router-hero-bottom router-container">
            <span>A shorter path from idea to inference.</span>
            <span>
              Start building <ArrowRight size={16} />
            </span>
          </a>
        </section>
        <section
          id="start"
          className="router-container router-section router-integration"
        >
          <div className="router-section-heading">
            <h2>
              Keep the code.
              <br />
              Change the connection.
            </h2>
            <p>
              Use the OpenAI client you already know. Point it to Const Router,
              add your key, and send your first request.
            </p>
          </div>
          <div className="router-integration-layout">
            <div className="router-setup-steps">
              <div>
                <span>Base URL</span>
                <code>https://router.const.web.id/v1</code>
              </div>
              <div>
                <span>Authentication</span>
                <p>Your Const API key, sent as a Bearer token.</p>
              </div>
              <div>
                <span>Model</span>
                <p>
                  An exact catalog ID, or your own <code>combo/</code> slug.
                </p>
              </div>
              <Link href="/docs#quickstart" className="router-text-link">
                Full quickstart <ArrowUpRight size={16} />
              </Link>
            </div>
            <CodeBlock tabs={QUICKSTART_TABS} label="Your first request" />
          </div>
        </section>
        <section id="features" className="router-capabilities">
          <div className="router-container">
            <div className="router-section-heading">
              <h2>
                One connection.
                <br />
                Room to build.
              </h2>
              <p>
                The gateway handles model access and usage accounting. You stay
                focused on the application.
              </p>
            </div>
            <div className="router-feature-row">
              <div>
                <h3>
                  A model is a choice.
                  <br />
                  Not a migration.
                </h3>
                <p>
                  Move between Claude, GPT, Gemini, DeepSeek, Qwen, GLM,
                  MiniMax, Kimi, and Grok using the same chat endpoint. Compare the
                  fit for each task without rebuilding your integration.
                </p>
                <Link href="#models" className="router-text-link">
                  Browse the models <ArrowRight size={16} />
                </Link>
              </div>
              <div
                className="router-route-diagram"
                role="group"
                aria-label="One chat endpoint can address different model IDs"
              >
                <code>POST /v1/chat/completions</code>
                <div>
                  <span>model</span>
                  <code>deepseek-v4.1-flash</code>
                </div>
                <div>
                  <span>model</span>
                  <code>gemini-3.8-flash</code>
                </div>
                <div>
                  <span>model</span>
                  <code>gpt-6.1-sol</code>
                </div>
              </div>
            </div>
            <div className="router-feature-row">
              <div>
                <h3>
                  Have a second
                  <br />
                  model in mind.
                </h3>
                <p>
                  Create a Virtual Combo with an ordered list of models. The
                  router tries another candidate when eligible requests fail
                  before a stream begins.
                </p>
                <Link href="/docs#combos" className="router-text-link">
                  How fallback works <ArrowRight size={16} />
                </Link>
              </div>
              <div className="router-combo-example">
                <div>
                  <code>combo/my-coding-stack</code>
                  <span>Example configuration</span>
                </div>
                <ol>
                  <li>
                    <span>Primary</span>
                    <code>deepseek-v4.1-flash</code>
                  </li>
                  <li>
                    <span>Fallback</span>
                    <code>qwen-3.8-27b</code>
                  </li>
                  <li>
                    <span>Fallback</span>
                    <code>gpt-6.1-sol</code>
                  </li>
                </ol>
              </div>
            </div>
            <div className="router-detail-list">
              <article>
                <h3>Stream the response.</h3>
                <p>
                  Receive chat output as server-sent events, with tool-call and
                  reasoning parameters passed to the selected model.
                </p>
              </article>
              <article>
                <h3>Give each project a key.</h3>
                <p>
                  Create named API keys, set daily token limits, and revoke
                  access from your dashboard.
                </p>
              </article>
              <article>
                <h3>Follow the usage.</h3>
                <p>
                  Review request tokens, costs, duration, and status in your
                  usage logs.
                </p>
              </article>
            </div>
          </div>
        </section>
        <section id="models" className="router-container router-section">
          <div className="router-section-heading">
            <h2>
              The model you need.
              <br />
              The rate in plain sight.
            </h2>
            <p>
              Published chat rates in USD per million tokens. Every model uses
              your wallet balance. Top up in rupiah with QRIS.
            </p>
          </div>
          <div id="pricing" className="router-model-table-wrap" role="region" aria-label="Chat model pricing" tabIndex={0}>
            <table className="router-model-table">
              <caption className="sr-only">
                Const Router chat model pricing per million tokens
              </caption>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">Context</th>
                  <th scope="col">Input / 1M</th>
                  <th scope="col">Cached / 1M</th>
                  <th scope="col">Output / 1M</th>
                </tr>
              </thead>
              <tbody>
                {chatModels.map((model) => (
                  <tr key={model.id}>
                    <th scope="row">
                      <span>{model.name}</span>
                      <code>{model.id}</code>
                    </th>
                    <td>{model.contextWindow}</td>
                    <td>{model.pricing?.input ?? "—"}</td>
                    <td>{model.pricing?.cache ?? "—"}</td>
                    <td>{model.pricing?.output ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="router-model-mobile-list" aria-label="Chat model rates per million tokens">
              {chatModels.map(model => <li key={model.id}>
                <div className="router-model-mobile-title">
                  <div><h3>{model.name}</h3><code>{model.id}</code></div>
                  <span>{model.contextWindow} context</span>
                </div>
                <dl>
                  <div><dt>Input / 1M</dt><dd>{model.pricing?.input ?? "—"}</dd></div>
                  <div><dt>Cached / 1M</dt><dd>{model.pricing?.cache ?? "—"}</dd></div>
                  <div><dt>Output / 1M</dt><dd>{model.pricing?.output ?? "—"}</dd></div>
                </dl>
              </li>)}
            </ul>
          </div>
          <div className="router-table-note">
            <span>Rates come from the same catalog used by the gateway.</span>
            <Link href="/models" className="router-text-link">
              Full model catalog <ArrowUpRight size={15} />
            </Link>
          </div>
          <div id="billing" className="router-allowance">
            <h3>One balance. Every model.</h3>
            <div><p>Add credit in USD and pay in rupiah through QRIS. See the exchange rate and total before checkout. Your balance updates after payment is verified.</p>
              <Link href="/credits" className="router-text-link">Add credit <ArrowRight size={16} /></Link>
            </div>
          </div>
        </section>
        <section className="router-endpoints router-container">
          <div className="router-section-heading">
            <h2>Beyond the chat.</h2>
            <p>
              Bring search, speech, and source content into your workflow
              through the same gateway.
            </p>
          </div>
          <div className="router-endpoint-list">
            {ROUTER_ENDPOINTS.filter(
              (endpoint) =>
                !["/v1/chat/completions", "/v1/models"].includes(endpoint.path),
            ).map((endpoint) => (
              <Link
                href={`/docs#${({ "/v1/audio/transcriptions": "audio-transcription", "/v1/search": "web-search-api", "/v1/fetch": "web-fetch-api", "/v1/transcript": "youtube-transcript-api" } as Record<string, string>)[endpoint.path]}`}
                key={endpoint.path}
              >
                <span>{endpoint.name}</span>
                <code>
                  {endpoint.method} {endpoint.path}
                </code>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
        </section>
        <section className="router-container router-closing">
          <h2>
            Your next idea
            <br />
            starts with a request.
          </h2>
          <div>
            {apiKeyAction("Start building")}
            <p>
              Add credit. Explore the API.
              <br />
              Build from there.
            </p>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
