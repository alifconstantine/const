export interface Connection { sessionId: string; key: string; deviceName?: string }
const storageKey = "const_mobile_pairings";
type Pairings = { owner: string; connections: Connection[]; active?: string };

// Used only to scope local caches. Server authentication still verifies every grant.
function owner(token: string) {
  try {
    const encoded = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const subject = JSON.parse(atob(encoded)).sub;
    return typeof subject === "string" ? subject.split("|")[0]! : "";
  } catch { return ""; }
}
export function readPairings(token: string | null): Pairings | null {
  if (!token) return null;
  const account = owner(token);
  if (!account) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved?.owner !== account || !Array.isArray(saved.connections)) return null;
    return { ...saved, connections: saved.connections.filter((item: Connection) =>
      typeof item.sessionId === "string" && /^[A-Za-z0-9_-]+$/.test(item.sessionId) &&
      typeof item.key === "string" && /^[A-Za-z0-9_-]{43}$/.test(item.key)) };
  } catch { return null; }
}
export function savePairing(token: string, connection: Connection) {
  if (!owner(token)) return;
  const saved = readPairings(token);
  localStorage.setItem(storageKey, JSON.stringify({ owner: owner(token), active: connection.sessionId,
    connections: [...(saved?.connections || []).filter(item => item.sessionId !== connection.sessionId), connection] }));
}
export function leaveWorkspace(token: string | null, removeId?: string) {
  const saved = readPairings(token);
  if (!saved) return;
  delete saved.active;
  if (removeId) saved.connections = saved.connections.filter(item => item.sessionId !== removeId);
  localStorage.setItem(storageKey, JSON.stringify(saved));
  if (removeId) for (const prefix of ["const_remote_grant:", "const_remote_device_secret:", "const_remote_key:"]) {
    localStorage.removeItem(prefix + removeId);
    sessionStorage.removeItem(prefix + removeId);
  }
}
export function clearPairings() {
  localStorage.removeItem(storageKey);
  for (const key of Object.keys(localStorage)) if (key.startsWith("const_remote_")) localStorage.removeItem(key);
}
