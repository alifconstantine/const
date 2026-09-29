import CustomCursor from '../components/CustomCursor';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import VideoSection from '../components/VideoSection';
import AgentFirstSection from '../components/AgentFirstSection';
import FeatureExplorerSection from '../components/FeatureExplorerSection';
import DownloadCtaSection from '../components/DownloadCtaSection';
import FaqSection from '../components/FaqSection';
import Footer from '../components/Footer';

export default function HomePage() {
  return (
    <div className="landing-page">
      <CustomCursor />
      <Navbar />
      <div id="smooth-wrapper">
        <div id="smooth-content" className="smooth-scroll-wrapper">
          <main className="main astro-lcdefpme">
            <HeroSection />
            <VideoSection />
            <AgentFirstSection />
            <FeatureExplorerSection />
            <DownloadCtaSection />
            <FaqSection />
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
