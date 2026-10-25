import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { I18nProvider } from '../context/I18nContext';
import ClientEnvironment from '../components/ClientEnvironment';
import './globals.css';
import './landing.css';
import './footer-faq.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Const Learn — Understand Anything',
  description: 'Actionable AI Research, Native Learning Agent & Interactive Learning Hub',
  icons: {
    icon: [
      { url: '/const-logo-dark.png', type: 'image/png', sizes: '256x256' },
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

const earlyInitScript = `
  (function() {
    window.__constLoaded = true;
    window.dataLayer = window.dataLayer || [];
    function isIgnorable(e) {
      if (!e) return true;
      var t = e.target;
      if (t && (t instanceof HTMLScriptElement || t instanceof HTMLLinkElement || t instanceof HTMLImageElement || t instanceof HTMLVideoElement || t instanceof HTMLAudioElement)) return true;
      if (!(e instanceof ErrorEvent) && !(e instanceof Error) && (e.type === 'error' || String(e) === '[object Event]')) return true;
      if (e.reason && (e.reason instanceof Event || e.reason.name === 'AbortError' || (e.reason.message && e.reason.message.indexOf('interrupted') !== -1))) return true;
      return false;
    }
    window.addEventListener('error', function(e) {
      if (isIgnorable(e)) {
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (e.preventDefault) e.preventDefault();
        return true;
      }
    }, true);
    window.addEventListener('unhandledrejection', function(e) {
      if (isIgnorable(e)) {
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (e.preventDefault) e.preventDefault();
        return true;
      }
    }, true);
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: earlyInitScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-[#0066ff]/25 selection:text-white" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <I18nProvider>
            <ClientEnvironment />
            {children}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
