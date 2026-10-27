import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — Const',
  description: 'Privacy Policy for Const Platform (const.web.id) and integrated services.',
};

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: October 2026
          </p>
        </div>

        <div className="prose dark:prose-invert max-w-none space-y-8 text-muted-foreground leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">1. Overview</h2>
            <p>
              Welcome to Const Platform (<strong>const.web.id</strong>). This Privacy Policy explains how Const collects, uses, and safeguards your information when you access our websites, applications, and services, including authentication mechanisms powered by Google Identity / OAuth 2.0.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">2. Information We Collect</h2>
            <p>
              When you sign in using Google Authentication, we may collect basic profile information made available through your Google Account consent, which includes:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your primary email address</li>
              <li>Your full name and display name</li>
              <li>Your profile picture URL</li>
            </ul>
            <p>
              We do not request or store sensitive Google account data, and we do not access your private files or search history.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">3. How We Use Information</h2>
            <p>
              The information collected is used solely to authenticate your identity, establish and manage your Const account profile, and deliver access to services within the Const ecosystem (such as Const Accounts, Const Learn, and Const Router).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">4. Data Protection & Sharing</h2>
            <p>
              Const does not sell, rent, or trade your personal information with third parties for marketing purposes. All user data is encrypted in transit and at rest in accordance with industry best practices.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">5. Google API Services User Data Policy</h2>
            <p>
              Const&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-foreground">6. Contact Information</h2>
            <p>
              If you have any questions about this Privacy Policy or data handling practices, please contact us at{' '}
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
