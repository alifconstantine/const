import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { StatementSection } from "@/components/StatementSection";
import { TaskExplorerSection } from "@/components/TaskExplorerSection";
import { CapabilitySection } from "@/components/CapabilitySection";
import { PlatformSection } from "@/components/PlatformSection";
import { ComparisonSection } from "@/components/ComparisonSection";
import { GetStartedSection } from "@/components/GetStartedSection";
import { DownloadCtaSection } from "@/components/DownloadCtaSection";
import { FaqSection } from "@/components/FaqSection";
import { Footer } from "@/components/Footer";
import { SmoothScroll } from "@/components/SmoothScroll";

export default function HomePage() {
  return (
    <div className="landing-page">
      <Navbar />
      <SmoothScroll>
        <main id="main-content" tabIndex={-1}>
          <HeroSection />
          <StatementSection />
          <TaskExplorerSection />
          <CapabilitySection />
          <PlatformSection />
          <ComparisonSection />
          <GetStartedSection />
          <DownloadCtaSection />
          <FaqSection />
        </main>
        <Footer />
      </SmoothScroll>
    </div>
  );
}
