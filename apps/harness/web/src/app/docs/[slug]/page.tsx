import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleSections, PageIntro } from "@/components/ContentShell";
import { getGuide, guides } from "@/content/docs";
import { PageContents } from "@/components/PageContents";

export function generateStaticParams() {
  return guides.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  return guide
    ? {
        title: `${guide.title} — Const Harness Docs`,
        description: guide.description,
      }
    : {};
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const index = guides.indexOf(guide);
  const previous = guides[index - 1];
  const next = guides[index + 1];
  return (
    <>
      <PageIntro title={guide.title} description={guide.description} />
      <PageContents sections={guide.sections} className="ch-article-toc" />
      <ArticleSections sections={guide.sections} />
      <nav className="ch-article-pagination" aria-label="Other guides">
        <Link href={previous ? `/docs/${previous.slug}` : "/docs"}>
          <span>Previous</span>
          {previous?.title ?? "Documentation"}
        </Link>
        {next && (
          <Link href={`/docs/${next.slug}`}>
            <span>Next</span>
            {next.title}
          </Link>
        )}
      </nav>
    </>
  );
}
