import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "@const/ui";
import App from "./App";
import { initThemeListener } from "./lib/theme";
import { I18nProvider } from "./lib/i18n";
import { initializeSkillStorage } from "./lib/skills/skills-service";
import "./index.css";

// Catch global uncaught errors and rejections to log them clearly
window.addEventListener("error", (e) => {
  console.error("[Desktop Uncaught Error]", e.error || e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[Desktop Unhandled Rejection]", e.reason);
});

// Initialize system theme listener & seed agent skills catalog
try {
  initThemeListener();
} catch (err) {
  console.warn("Failed to initialize theme listener:", err);
}

initializeSkillStorage().catch((err) => console.warn("Failed to initialize skills on startup:", err));

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AppErrorBoundary] Render crash:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    try {
      localStorage.removeItem("const_harness_current_project");
      localStorage.removeItem("const_harness_active_convo_id");
      localStorage.removeItem("const_harness_right_sidebar_open");
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-[#101011] text-white p-6 select-none font-sans">
          <div className="max-w-md w-full bg-[#18181a] border border-[#2e2e32] rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-amber-400">
              <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-base font-semibold text-white">Application Encountered an Error</h2>
            </div>
            <p className="text-xs text-[#a0a0a5] leading-relaxed">
              An unexpected error occurred during rendering. You can reload or reset the workspace cache to restore normal operation.
            </p>
            <div className="bg-[#121214] border border-[#27272a] rounded-lg p-3 max-h-36 overflow-auto font-mono text-[11px] text-red-300">
              {this.state.error?.message || String(this.state.error)}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleResetState}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#2a2a2e] hover:bg-[#38383e] text-[#d4d4d4] transition-colors cursor-pointer"
              >
                Reset State & Reload
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-neutral-200 text-black transition-colors cursor-pointer"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <I18nProvider>
          <App />
          <Toaster position="bottom-right" />
        </I18nProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}
