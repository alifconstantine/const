import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { termsSections } from "@/content/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Const Harness",
  description:
    "Terms for using Harness, authorizing agent actions, connecting services, and reviewing generated work.",
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="The terms for working with Const Harness and its connected features."
      sections={termsSections}
      other={{ href: "/privacy-policy", label: "Privacy Policy" }}
    />
  );
}
