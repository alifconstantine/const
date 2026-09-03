import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Const Learn — EduTech Platform",
  description: "Actionable AI Research & Interactive Learning Hub",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
