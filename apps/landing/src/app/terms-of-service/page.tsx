import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service — Const',
  description: 'Terms of Service for Const Platform (const.web.id) and integrated services.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-6 pt-32 pb-20 w-full">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-4xl sm:text-5xl font-medium tracking-tight mb-4">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: October 2026
          </p>
        </div>

        <div className="prose dark:prose-invert max-w-none space-y-8 text-muted-foreground leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Const Platform (<strong>const.web.id</strong>) and any affiliated applications or services, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please refrain from using the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">2. Description of Services</h2>
            <p>
              Const Platform provides an intelligent software ecosystem featuring AI research workflows, universal API routing, educational applications, and developer workbench tooling.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">3. User Accounts and Authentication</h2>
            <p>
              Users may authenticate with their Google Account using Google OAuth. You are responsible for maintaining the confidentiality of your credentials and for all activities conducted under your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">4. Acceptable Use Policy</h2>
            <p>
              You agree not to misuse Const services or assist anyone else in doing so. This includes attempts to disrupt service infrastructure, bypass authentication or security controls, or transmit unlawful, infringing, or malicious content.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">5. Intellectual Property</h2>
            <p>
              All trademarks, design assets, and codebase elements belonging to Const Platform remain the property of Const and its contributors. You retain ownership of any research data or content you create or import.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">6. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Const Platform and its developers shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your access to or inability to use the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">7. Contact Information</h2>
            <p>
              For any questions regarding these Terms of Service, please reach out to{' '}
              <a
                href="mailto:support@const.web.id"
                className="text-foreground underline underline-offset-4"
              >
                support@const.web.id
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
