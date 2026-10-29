import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { RemoteHub } from "@/components/remote/RemoteHub";
import { DEFAULT_CONVEX_URL } from "@const/remote/config";

export const metadata: Metadata = {
  title: "Remote Workspaces — Const Harness",
  description:
    "Connect to your desktop Const Harness workspace remotely via 6-digit pairing code or direct pairing link.",
};

export default function Page() {
  return (
    <div className="landing-page ch-remote-page min-h-screen flex flex-col justify-between">
      <Navbar />
      <main className="flex-1 pt-24 sm:pt-28 pb-16">
        <RemoteHub
          convexUrl={process.env.NEXT_PUBLIC_CONVEX_URL || DEFAULT_CONVEX_URL}
          accountsUrl={
            process.env.NEXT_PUBLIC_ACCOUNTS_URL || "https://accounts.const.web.id"
          }
        />
      </main>
      <Footer />
    </div>
  );
}
