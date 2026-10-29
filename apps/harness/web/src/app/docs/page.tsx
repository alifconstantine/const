import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageIntro } from "@/components/ContentShell";
import { guides } from "@/content/docs";

export const metadata: Metadata = {
  title: "Documentation — Const Harness",
  description:
    "Set up Const Harness, connect models and tools, review projects, and use remote control and scheduled tasks.",
};

export default function DocsPage() {
  return (
    <>
      <PageIntro
        title="A little guidance. A lot you can do."
        description="Practical guides for the workbench, from your first model connection to the way your data moves."
      />
      <Link className="ch-docs-start" href="/docs/getting-started">
        <div>
          <h2>Start with your first task</h2>
          <p>Install, connect a model, and review a result.</p>
        </div>
        <ArrowUpRight size={24} aria-hidden="true" />
      </Link>
      <div className="ch-guide-list">
        {guides.slice(1).map((guide) => (
          <Link href={`/docs/${guide.slug}`} key={guide.slug}>
            <div>
              <h2>{guide.title}</h2>
              <p>{guide.description}</p>
            </div>
            <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
        ))}
      </div>
      <p className="ch-reading-note">
        Looking for API endpoints?{" "}
        <a href="https://router.const.web.id/docs">
          Read the Const Router API documentation.
        </a>
      </p>
    </>
  );
}
