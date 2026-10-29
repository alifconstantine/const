import type { ReactNode } from "react";
import { ContentShell } from "@/components/ContentShell";
import { DocsNav } from "@/components/DocsNav";
import { guides } from "@/content/docs";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <ContentShell>
      <div className="ch-shell ch-docs-layout">
        <DocsNav guides={guides.map(({ slug, title }) => ({ slug, title }))} />
        <div className="ch-docs-body">{children}</div>
      </div>
    </ContentShell>
  );
}
