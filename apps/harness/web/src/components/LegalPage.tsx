import Link from "next/link";
import { ArticleSections, ContentShell, PageIntro } from "./ContentShell";
import { operator } from "@/content/legal";
import type { ArticleSection } from "@/content/docs";
import { PageContents } from "./PageContents";

export function LegalPage({
  title,
  description,
  sections,
  other,
}: {
  title: string;
  description: string;
  sections: ArticleSection[];
  other: { href: string; label: string };
}) {
  return (
    <ContentShell>
      <div className="ch-shell ch-legal-layout">
        <PageIntro title={title} description={description}>
          <p className="ch-policy-status">Draft · Updated {operator.updated}</p>
        </PageIntro>
        <div className="ch-legal-columns">
          <aside>
            <PageContents sections={sections} />
            <Link className="ch-inline-link" href={other.href}>
              {other.label}
            </Link>
          </aside>
          <article>
            <ArticleSections sections={sections} />
            <section
              className="ch-legal-contact"
              aria-labelledby="contact-heading"
            >
              <h2 id="contact-heading">Contact</h2>
              <p>
                {operator.name} · {operator.brand}
                <br />
                {operator.address}
              </p>
              <p>
                <code>{operator.email}</code>
                <br />
                <span>
                  Placeholder email — not monitored. Please do not send personal
                  information.
                </span>
              </p>
            </section>
          </article>
        </div>
      </div>
    </ContentShell>
  );
}
