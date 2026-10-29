import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ContentShell, PageIntro } from "@/components/ContentShell";

export const metadata: Metadata = {
  title: "The workbench — Const Harness",
  description:
    "An AI workbench with project files, browser tools, terminal execution, and review beside the conversation.",
};

const workflows = [
  {
    title: "Work where your files are.",
    text: "Open a project, give the agent a clear outcome, and let it investigate the relevant files. Code, research, documents, and creative work can share the same conversation and working directory.",
    href: "/docs/projects",
    label: "Projects & review",
    image: "task-coding.png",
    alt: "Existing Const Harness coding workflow artwork",
  },
  {
    title: "Give the task the tools it needs.",
    text: "Use a browser to inspect a page, a terminal to run checks, or a connected MCP service to bring in context. Add reusable skills and plugins for work you do often.",
    href: "/integrations",
    label: "Explore integrations",
    image: "capability-browser.png",
    alt: "Existing browser-control workflow artwork",
  },
  {
    title: "Keep the result in view.",
    text: "Read files, review a diff, inspect tool activity, and open the output beside the conversation. Delegate independent work to subagents when useful, then check the combined result before using it.",
    href: "/docs/projects#review",
    label: "How review works",
    image: "task-analysis.png",
    alt: "Existing analysis workflow artwork",
  },
];

export default function ProductPage() {
  return (
    <ContentShell>
      <div className="ch-shell ch-product-content">
        <PageIntro
          title="From a conversation to work you can use."
          description="Const Harness brings your project, models, and tools into one desktop workbench. Plan, make, inspect, and refine without losing the thread."
        >
          <div className="ch-page-actions">
            <Link
              className="ch-button ch-button-primary ch-button-lg"
              href="/download"
            >
              Download Harness
            </Link>
            <Link className="ch-inline-link" href="/docs/getting-started">
              Your first task <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </PageIntro>
        <figure className="ch-product-cover">
          <img
            src="/assets/image/landing/hero-workbench.png"
            alt="Illustrative workspace preview using existing Const imagery"
            width={1920}
            height={1080}
          />
        </figure>
        <div className="ch-story-rows">
          {workflows.map((item) => (
            <section className="ch-story-row" key={item.title}>
              <div>
                <h2>{item.title}</h2>
                <p>{item.text}</p>
                <Link className="ch-inline-link" href={item.href}>
                  {item.label} <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <img
                src={`/assets/image/landing/${item.image}`}
                alt={item.alt}
                width={1400}
                height={934}
                loading="lazy"
              />
            </section>
          ))}
        </div>
        <section className="ch-product-continuity">
          <h2>A desktop that stays connected.</h2>
          <div>
            <p>
              Continue from a browser or phone through a paired remote session.
              Set up recurring tasks for research and project checks while
              Harness is running on your computer.
            </p>
            <div className="ch-page-actions">
              <Link className="ch-inline-link" href="/docs/remote-control">
                Remote control <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <Link className="ch-inline-link" href="/docs/scheduled-tasks">
                Scheduled tasks <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <p className="ch-reading-note">
              Local-first describes the workspace. Models and connected tools
              can still send context to external services.{" "}
              <Link href="/docs/privacy-and-data">Understand your data.</Link>
            </p>
          </div>
        </section>
      </div>
    </ContentShell>
  );
}
