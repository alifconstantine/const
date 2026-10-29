import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { privacySections } from "@/content/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Const Harness",
  description:
    "How Harness uses local workspace data, model connections, account services, and the remote relay.",
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="Where your information goes, why it is used, and the choices you have."
      sections={privacySections}
      other={{ href: "/terms-of-service", label: "Terms of Service" }}
    />
  );
}
