import { ChevronDown } from "lucide-react";

export function PageContents({
  sections,
  className,
}: {
  sections: { id: string; title: string }[];
  className?: string;
}) {
  const navigation = (
    <nav className={className} aria-label="On this page">
      {sections.map((section) => (
        <a key={section.id} href={`#${section.id}`}>
          {section.title}
        </a>
      ))}
    </nav>
  );
  return (
    <>
      <div className="ch-desktop-contents">{navigation}</div>
      <details className="ch-mobile-disclosure ch-page-contents">
        <summary>
          On this page <ChevronDown size={17} aria-hidden="true" />
        </summary>
        {navigation}
      </details>
    </>
  );
}
