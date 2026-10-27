/** Public connector definitions shared by Accounts and Electron. Never put credentials here. */
const scope = (name: string) => `https://www.googleapis.com/auth/${name}`;
export const GOOGLE_CONNECTORS = {
  drive: {
    name: "Google Drive",
    plugin: "google-drive",
    scopes: [scope("drive.readonly"), scope("drive.file")],
  },
  docs: {
    name: "Google Docs",
    plugin: "google-docs",
    scopes: [scope("documents")],
  },
  sheets: {
    name: "Google Sheets",
    plugin: "google-sheets",
    scopes: [scope("spreadsheets")],
  },
  slides: {
    name: "Google Slides",
    plugin: "google-slides",
    scopes: [scope("presentations")],
  },
  gmail: { name: "Gmail", plugin: "gmail", scopes: [scope("gmail.modify")] },
  calendar: {
    name: "Google Calendar",
    plugin: "google-calendar",
    scopes: [scope("calendar.calendarlist.readonly"), scope("calendar.events")],
  },
  classroom: {
    name: "Google Classroom",
    plugin: "google-classroom",
    scopes: [
      scope("classroom.courses"),
      scope("classroom.coursework.students"),
      scope("classroom.coursework.me.readonly"),
      scope("classroom.announcements"),
      scope("classroom.rosters.readonly"),
    ],
  },
} as const;
export type GoogleApp = keyof typeof GOOGLE_CONNECTORS;
export const GOOGLE_IDENTITY_SCOPES = [
  "openid",
  scope("userinfo.email"),
  scope("userinfo.profile"),
];
export function googleApp(value: unknown): GoogleApp | undefined {
  return typeof value === "string" && Object.hasOwn(GOOGLE_CONNECTORS, value)
    ? (value as GoogleApp)
    : undefined;
}
export function normalizeGoogleScopes(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\s+/)
        .filter(Boolean)
        .map((s) =>
          s === "email"
            ? scope("userinfo.email")
            : s === "profile"
              ? scope("userinfo.profile")
              : s,
        ),
    ),
  ].sort();
}
export function hasGoogleScopes(app: GoogleApp, granted: readonly string[]) {
  return [...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_CONNECTORS[app].scopes].every(
    (s) => granted.includes(s),
  );
}
export const GOOGLE_MCP_ORIGIN = "https://accounts.const.web.id";
export const googleMcpUrl = (app: GoogleApp) =>
  `${GOOGLE_MCP_ORIGIN}/mcp/google/${app}`;
