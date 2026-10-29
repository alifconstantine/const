import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ContentShell, PageIntro } from "@/components/ContentShell";
import { LINKS } from "@/lib/links";

export const metadata: Metadata = {
  title: "The Const ecosystem — Const Harness",
  description:
    "Meet Harness, Learn, Router, and Accounts: the products that make up Const.",
};

const products = [
  {
    name: "Harness",
    purpose: "Make and deliver.",
    text: "A desktop workbench for agents, project files, tools, and review. Built for coding, research, and creative work, with paired remote access from a browser or phone.",
    href: "/product",
    label: "Explore Harness",
  },
  {
    name: "Learn",
    purpose: "Turn sources into understanding.",
    text: "A learning workspace organized around your sources and collections. Chat with your material and create study artifacts such as quizzes, flashcards, mind maps, reports, presentations, and audio.",
    href: LINKS.learn,
    label: "Explore Learn",
  },
  {
    name: "Router",
    purpose: "One connection to your models.",
    text: "An AI gateway with an OpenAI-compatible API, model combos, API keys, quotas, usage logs, and credits. It also exposes search, page extraction, transcription, and transcript endpoints.",
    href: LINKS.router,
    label: "Explore Router",
  },
  {
    name: "Accounts",
    purpose: "Your Const identity.",
    text: "The shared sign-in service for connected Const products, with Google sign-in and email links. It also hosts managed OAuth flows used by supported integrations.",
    href: LINKS.accounts,
    label: "Open Accounts",
  },
];

export default function EcosystemPage() {
  return (
    <ContentShell>
      <div className="ch-shell ch-product-content">
        <PageIntro
          title="Different ways to work. Connected by Const."
          description="Build with Harness, study with Learn, connect through Router, and sign in with Accounts. Each product has a clear job in the same ecosystem."
        />
        <div className="ch-ecosystem-list">
          {products.map((product) => (
            <section key={product.name}>
              <h2>
                {product.name}
                <span>{product.purpose}</span>
              </h2>
              <div>
                <p>{product.text}</p>
                <Link className="ch-inline-link" href={product.href}>
                  {product.label} <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </section>
          ))}
        </div>
        <section className="ch-product-continuity">
          <h2>Built in the open.</h2>
          <div>
            <p>
              The Const monorepo contains these products and the shared packages
              behind them. Start with its product READMEs to find your way
              around the source.
            </p>
            <a className="ch-inline-link" href={LINKS.repository}>
              Explore the repository{" "}
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
    </ContentShell>
  );
}
