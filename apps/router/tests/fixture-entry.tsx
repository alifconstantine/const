// Browser-only, synthetic authenticated fixture. Not part of Next's routing tree.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@const/ui";
import DashboardLayout, { DashboardShell } from "../src/app/(dashboard)/layout";
import DashboardPage, {
  OverviewView,
} from "../src/app/(dashboard)/dashboard/page";
import CreditsPage, { CreditsView } from "../src/app/(dashboard)/credits/page";
import ModelsPage from "../src/app/(dashboard)/models/page";
import BenchmarkPage from "../src/app/(dashboard)/benchmark/page";
import EndpointsPage from "../src/app/(dashboard)/endpoints/page";
import SettingsPage from "../src/app/(dashboard)/settings/page";
import GenerationPage from "../src/app/(dashboard)/generation/page";
import KeysPage from "../src/app/(dashboard)/keys/page";
import LogsPage from "../src/app/(dashboard)/logs/page";
import CombosPage from "../src/app/(dashboard)/combos/page";
import { usePathname } from "./fixture-navigation";
import { analytics, logs, quota, transactions, wallet } from "./fixture-data";
import { TopUp } from "../src/components/dashboard/top-up";
import { fixtureCounters } from "./fixture-convex";
import "../src/app/globals.css";

(window as any).__routerFixture = fixtureCounters;
document.documentElement.style.setProperty(
  "--font-sans",
  "Manrope, Arial, sans-serif",
);
// Intercept only the preview origin's generation request; never call a paid API.
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, options) => {
  if (typeof input === "string" && input === "/api/generation/chat") {
    fixtureCounters.generationRequests.push(
      JSON.parse(String(options?.body || "{}")),
    );
    const event = JSON.stringify({
      choices: [
        {
          delta: {
            content:
              "This is a synthetic response from the local UI fixture. Your request controls are working.",
          },
          finish_reason: "stop",
        },
      ],
    });
    return new Response(`data: ${event}\n\ndata: [DONE]\n\n`, {
      headers: { "Content-Type": "text/event-stream" },
    });
  }
  return originalFetch(input, options);
};
function Fixture() {
  const path = usePathname();
  const [range, setRange] = useState("7d");
  const state = new URLSearchParams(window.location.search).get("state");
  const empty = state === "empty";
  const loading = state === "loading";
  const overview =
    state === "error" ? (
      <DashboardPage />
    ) : (
      <OverviewView
        range={range}
        onRangeChange={(next) => {
          fixtureCounters.ranges.push(next);
          setRange(next);
        }}
        analytics={
          loading
            ? undefined
            : empty
              ? {
                  ...analytics,
                  kpi: {
                    ...analytics.kpi,
                    totalRequests: 0,
                    totalTokens: 0,
                    freeTokens: 0,
                    paidTokens: 0,
                    costUsd: 0,
                  },
                  timeline: [],
                  modelBreakdown: [],
                }
              : analytics
        }
        wallet={loading ? undefined : wallet}
        logs={loading ? undefined : empty ? [] : logs}
      />
    );
  const view =
    path === "/credits" ? (
      state === "error" ? (
        <CreditsPage />
      ) : (
        <CreditsView
          wallet={
            loading
              ? undefined
              : empty
                ? {
                    ...wallet,
                    balanceUsd: 0,
                    availableUsd: 0,
                    reservedUsd: 0,
                    totalDepositedUsd: 0,
                    totalSpentUsd: 0,
                  }
                : wallet
          }
          topUp={<TopUp />}
          transactions={empty || loading ? [] : transactions}
          loading={loading}
        />
      )
    ) : path === "/models" ? (
      <ModelsPage />
    ) : path === "/benchmark" ? (
      <BenchmarkPage />
    ) : path === "/endpoints" ? (
      <EndpointsPage />
    ) : path === "/settings" ? (
      <SettingsPage />
    ) : path === "/generation" ? (
      <GenerationPage />
    ) : path === "/keys" ? (
      <KeysPage />
    ) : path === "/logs" ? (
      <LogsPage />
    ) : path === "/combos" ? (
      <CombosPage />
    ) : (
      overview
    );
  const titles: Record<string, string> = {
    "/dashboard": "Overview",
    "/models": "Models & pricing",
    "/credits": "Credits & balance",
    "/endpoints": "API endpoints",
    "/settings": "Settings",
    "/generation": "Playground",
    "/keys": "API Keys",
    "/logs": "Usage logs",
    "/combos": "Combos",
  };
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {path === "/benchmark" ? (
        <DashboardLayout>{view}</DashboardLayout>
      ) : (
        <DashboardShell
          currentTitle={titles[path] || "Overview"}
          isGeneration={path === "/generation"}
        >
          {view}
        </DashboardShell>
      )}
      <Toaster />
    </ThemeProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
