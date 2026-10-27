import CustomCursor from '../components/CustomCursor';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import Footer from '../components/Footer';

export default function HomePage() {
  return (
    <div className="landing-page min-h-screen flex flex-col justify-between">
      <CustomCursor />
      <Navbar />
      <div id="smooth-wrapper" className="flex-1 flex flex-col justify-center">
        <div id="smooth-content" className="smooth-scroll-wrapper">
          <main className="main astro-lcdefpme">
            <HeroSection />
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}
