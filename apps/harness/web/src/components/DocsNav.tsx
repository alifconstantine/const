"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useRef } from "react";

// This reading surface is English until editorial translations are available.
export function DocsNav({
  guides,
}: {
  guides: { slug: string; title: string }[];
}) {
  const pathname = usePathname();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const navigation = (
    <nav
      aria-label="Documentation"
      onClick={() => disclosure.current?.removeAttribute("open")}
    >
      <Link
        href="/docs"
        className="ch-docs-home"
        aria-current={pathname === "/docs" ? "page" : undefined}
      >
        Documentation
      </Link>
      {guides.map((guide) => (
        <Link
          key={guide.slug}
          href={`/docs/${guide.slug}`}
          aria-current={pathname === `/docs/${guide.slug}` ? "page" : undefined}
        >
          {guide.title}
        </Link>
      ))}
    </nav>
  );
  return (
    <aside className="ch-docs-sidebar" lang="en">
      <div className="ch-docs-desktop-nav">{navigation}</div>
      <details className="ch-mobile-disclosure" ref={disclosure}>
        <summary>
          Browse guides <ChevronDown size={17} aria-hidden="true" />
        </summary>
        {navigation}
      </details>
      <p>Guides are currently available in English.</p>
    </aside>
  );
}
