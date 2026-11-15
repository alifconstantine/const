import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ContentShell, PageIntro } from "@/components/ContentShell";
import { WorkbenchPreview } from "@/components/WorkbenchPreview";
import { TaskShowcase } from "@/components/showcases/TaskShowcase";
import { CapabilityShowcase } from "@/components/showcases/CapabilityShowcase";

export const metadata: Metadata = {
  title: "The workbench — Const Harness",
  description:
    "An AI workbench with project files, browser tools, terminal execution, and review beside the conversation.",
};

const workflows = [
  {
    key: "coding",
    title: "Work where your files are.",
    text: "Open a project, give the agent a clear outcome, and let it investigate the relevant files. Code, research, documents, and creative work can share the same conversation and working directory.",
    href: "/docs/projects",
    label: "Projects & review",
  },
  {
    key: "browser",
    title: "Give the task the tools it needs.",
    text: "Use a browser to inspect a page, a terminal to run checks, or a connected MCP service to bring in context. Add reusable skills and plugins for work you do often.",
    href: "/integrations",
    label: "Explore integrations",
  },
  {
    key: "analysis",
    title: "Keep the result in view.",
    text: "Read files, review a diff, inspect tool activity, and open Intelligence UI charts or tables beside the conversation. Delegate independent work to subagents when useful, then check the combined result before using it.",
    href: "/docs/projects#review",
    label: "How review works",
  },
] as const;

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
        <div className="ch-product-cover">
          <WorkbenchPreview />
        </div>
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
              {item.key === "coding" ? (
                <TaskShowcase mode="coding" />
              ) : item.key === "browser" ? (
                <CapabilityShowcase kind="browser" />
              ) : (
                <TaskShowcase mode="analysis" />
              )}
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
