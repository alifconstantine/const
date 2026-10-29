import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ContentShell, PageIntro } from "@/components/ContentShell";

export const metadata: Metadata = {
  title: "Integrations — Const Harness",
  description:
    "Connect models, reusable skills, plugins, MCP services, and browser tools to your Harness workspace.",
};

const connections = [
  {
    title: "Models on your terms",
    text: "Connect Const Router or a supported provider with your own credentials. Configure reasoning, speech, image, and video independently, with the endpoint and model that fit each task.",
    href: "/docs/models",
    label: "Connect a model",
  },
  {
    title: "Skills for repeatable work",
    text: "Keep a workflow in reusable instructions with supporting files. A skill can guide the agent through a report, a design task, or your project’s conventions without repeating the brief each time.",
    href: "/docs/tools#difference",
    label: "Understand skills",
  },
  {
    title: "MCP for tools and context",
    text: "Connect local or remote MCP servers from Settings. The agent can use the tools and resources they expose, subject to the server’s setup, authentication, and access.",
    href: "/docs/tools#connect",
    label: "Set up tools",
  },
  {
    title: "Plugins that bring it together",
    text: "Install packages that bundle skills and connections. Inspect the package and its requirements before enabling it. Third-party services may need their own account, permissions, or paid access.",
    href: "/docs/tools#control",
    label: "Review connected access",
  },
];

export default function IntegrationsPage() {
  return (
    <ContentShell>
      <div className="ch-shell ch-product-content">
        <PageIntro
          title="Your tools, in the same conversation."
          description="Bring in the context and capabilities your work needs. Start with a model, then add connections as the task grows."
        />
        <figure className="ch-integrations-cover">
          <img
            src="/assets/image/landing/capability-plugins.png"
            alt="Existing Const Harness plugins artwork"
            width={1400}
            height={934}
          />
        </figure>
        <div className="ch-integration-rows">
          {connections.map((item) => (
            <section key={item.title}>
              <h2>{item.title}</h2>
              <div>
                <p>{item.text}</p>
                <Link className="ch-inline-link" href={item.href}>
                  {item.label} <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </section>
          ))}
        </div>
        <section className="ch-product-continuity">
          <h2>See the page. Check the work.</h2>
          <div>
            <p>
              The built-in browser supports research and website verification.
              Computer-use helpers extend tasks to desktop apps where the
              operating system and configured permissions allow it.
            </p>
            <Link className="ch-inline-link" href="/docs/tools#browser">
              Browser & computer use{" "}
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </ContentShell>
  );
}
