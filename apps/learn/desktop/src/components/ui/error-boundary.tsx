import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  title?: string;
  description?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[React ErrorBoundary caught error]:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full h-full min-h-[160px] flex flex-col items-center justify-center p-6 text-center bg-card/60 rounded-xl border border-destructive/30 font-sans select-none animate-in fade-in-0 duration-200">
          <div className="w-10 h-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {this.props.title || "Terjadi kendala pada tampilan"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mb-2 leading-relaxed">
            {this.props.description || "Komponen ini mengalami error saat proses rendering."}
          </p>
          {this.state.error?.message && (
            <p className="text-[11px] text-destructive/90 font-mono max-w-sm mb-4 break-words bg-destructive/10 px-2.5 py-1.5 rounded-lg border border-destructive/20 text-left">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors border border-border/60 cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Muat ulang komponen</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
