import React from "react";
import { useTranslation } from "../lib/i18n";

function Recovery() {
  const { t } = useTranslation();
  return (
    <div className="remote-gate" role="alert">
      <h1>{t("remoteControl.renderError")}</h1>
      <p>{t("remoteControl.renderErrorHint")}</p>
      <button type="button" onClick={() => location.reload()}>
        {t("common.refresh")}
      </button>
    </div>
  );
}

/** This renderer is a separate React root; Next's boundaries cannot catch its errors. */
export class RemoteWorkspaceBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[RemoteWorkspace] Render failed", error, info.componentStack);
  }
  render() { return this.state.failed ? <Recovery /> : this.props.children; }
}
