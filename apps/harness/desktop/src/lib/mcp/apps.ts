export interface McpAppRef {
  id: string;
  title: string;
  filePath?: string;
}
export interface McpAppView extends McpAppRef {
  html: string;
  resourceUri: string;
  csp: { resourceDomains?: string[]; connectDomains?: string[] };
  arguments: Record<string, unknown>;
  result: { content: any[]; structuredContent?: Record<string, unknown> };
  scene?: {
    elements: any[];
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
  };
}

export function messageApps(message: {
  toolCalls?: any[];
  traceSteps?: any[];
}): McpAppRef[] {
  const found = new Map<string, McpAppRef>();
  for (const item of [
    ...(message.toolCalls ?? []),
    ...(message.traceSteps ?? []),
  ]) {
    if (item.isError) continue;
    try {
      const result =
        typeof item.result === "string" ? JSON.parse(item.result) : item.result;
      const app = result?.constMcpApp;
      if (
        typeof app?.id === "string" &&
        /^[a-f0-9-]{36}$/.test(app.id) &&
        typeof app.title === "string"
      )
        found.set(app.id, app);
    } catch {
      /* Ordinary text results have no app view. */
    }
  }
  return [...found.values()];
}

/** Opaque-origin iframe with explicit CSP. Server HTML never runs in the Electron renderer. */
export function sandboxHtml(html: string, csp: McpAppView["csp"]) {
  const domains = (values: string[] | undefined) =>
    (values ?? [])
      .filter((value) => {
        try {
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            url.origin === value &&
            !/[;'"\s]/.test(value)
          );
        } catch {
          return false;
        }
      })
      .join(" ");
  const policy = `default-src 'none'; script-src 'unsafe-inline' ${domains(csp.resourceDomains)}; style-src 'unsafe-inline' ${domains(csp.resourceDomains)}; img-src data: blob: ${domains(csp.resourceDomains)}; font-src data: ${domains(csp.resourceDomains)}; connect-src ${domains(csp.connectDomains) || "'none'"}; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  // Put our policy before any server markup. Additional CSP tags can only narrow it.
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy.replaceAll('"', "&quot;")}">${html}`;
}
