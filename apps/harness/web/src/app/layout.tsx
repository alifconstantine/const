import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/context/I18nContext";
import { en } from "@/i18n/en";
import "./globals.css";
import "./landing.css";

export const metadata: Metadata = {
  title: "Const Harness — Local-first agentic workbench for developers",
  description: en["meta.description"],
  applicationName: "Const Harness",
  openGraph: {
    title: "Const Harness — Local-first agentic workbench for developers",
    description: en["meta.description"],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
