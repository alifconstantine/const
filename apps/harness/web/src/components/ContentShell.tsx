import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import type { ArticleSection } from "@/content/docs";

export function ContentShell({ children }: { children: ReactNode }) {
  return (
    <div className="landing-page ch-content-page">
      <Navbar />
      <main id="main-content" tabIndex={-1} lang="en">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export function PageIntro({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="ch-page-intro">
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function ArticleSections({ sections }: { sections: ArticleSection[] }) {
  return (
    <div className="ch-prose">
      {sections.map((section) => (
        <section id={section.id} key={section.id}>
          <h2>
            <a href={`#${section.id}`}>{section.title}</a>
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.steps && (
            <ol>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          {section.code && (
            <pre>
              <code>{section.code}</code>
            </pre>
          )}
          {section.link && (
            <Link className="ch-inline-link" href={section.link.href}>
              {section.link.label} <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          )}
        </section>
      ))}
    </div>
  );
}
