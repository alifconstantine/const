"use client";
import React from "react";
import { Button } from "@const/ui";
export class QueryBoundary extends React.Component<
  { children: React.ReactNode; name?: string; compact?: boolean },
  { failed: boolean; version: number }
> {
  state = { failed: false, version: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("Router query unavailable", error);
  }
  render() {
    if (this.state.failed)
      return this.props.compact ? (
        <span className="text-xs text-muted-foreground">
          Balance unavailable
        </span>
      ) : (
        <div role="alert" className="rounded-2xl bg-card p-6 space-y-3">
          <h2 className="font-medium">
            {this.props.name ?? "Data"} could not be loaded
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg">
            Your data has not been changed. Retry the connection, or sign in
            again if your session has expired.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() =>
                this.setState((s) => ({
                  failed: false,
                  version: s.version + 1,
                }))
              }
            >
              Retry
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                window.location.assign(
                  "/login?continue=" +
                    encodeURIComponent(window.location.pathname),
                )
              }
            >
              Sign in again
            </Button>
          </div>
        </div>
      );
    return (
      <React.Fragment key={this.state.version}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
