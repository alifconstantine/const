import http from "node:http";
import os from "node:os";
import crypto from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { remoteCommandSchema, type RemoteCommand, type RemoteConnectedDevice, type RemoteDaemonStatus } from "../src/lib/remote-control";
import { createPairingPage } from "./remote-pairing-page";
import { RemoteRelay } from "./remote-relay";

type CommandHandler = (command: RemoteCommand, reply: (response: unknown) => void) => void | Promise<void>;
type Client = { ws: WebSocket; device: RemoteConnectedDevice; alive: boolean; pending: number };

function localAddress(): string {
  const candidates = Object.entries(os.networkInterfaces()).flatMap(([name, entries]) =>
    (entries ?? []).filter((entry) => entry.family === "IPv4" && !entry.internal &&
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address))
      .map((entry) => ({ name, address: entry.address })),
  );
  candidates.sort((a, b) => Number(/virtual|veth|docker|wsl|vpn|tun/i.test(a.name)) - Number(/virtual|veth|docker|wsl|vpn|tun/i.test(b.name)));
  if (!candidates[0]) throw new Error("NO_LAN_ADDRESS");
  return candidates[0].address;
}

/** Explicitly enabled LAN transport. Internet access requires a separate TLS relay. */
export class RemoteDaemon {
  readonly deviceId = `desktop-${os.hostname().replace(/[^a-zA-Z0-9-]/g, "").slice(0, 32) || "pc"}`;
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private origin: string | null = null;
  private sessionId: string | null = null;
  private secret: string | null = null;
  private expiresAt: number | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private clients = new Map<string, Client>();
  private listeners = new Set<(status: RemoteDaemonStatus) => void>();
  private handler: CommandHandler | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private relay: RemoteRelay | null = null;
  private relayOptions: { authToken: string; convexUrl: string; webOrigin: string } | null = null;

  constructor(private readonly address = localAddress) {}

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  getStatus(): RemoteDaemonStatus {
    if (this.relay) return this.relay.getStatus();
    return {
      status: !this.origin ? "idle" : this.clients.size ? "connected" : "waiting",
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      pairingUrl: this.origin ? `${this.origin}/r/${this.sessionId}#key=${this.secret}` : null,
      localBridgeUrl: this.origin ? this.origin.replace("http:", "ws:") + "/ws" : null,
      expiresAt: this.expiresAt,
      connectedDevices: Array.from(this.clients.values(), ({ device }) => device),
    };
  }

  onStatusChange(listener: (status: RemoteDaemonStatus) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  onCommand(handler: CommandHandler): void { this.handler = handler; }

  startRelay(options: { authToken: string; convexUrl: string; webOrigin: string }): Promise<RemoteDaemonStatus> {
    return this.serialize(async () => {
      if (this.relay?.getStatus().status !== "idle" && this.relay) return this.relay.getStatus();
      if (this.server) throw new Error("REMOTE_ALREADY_RUNNING");
      this.relayOptions = options;
      return this.connectRelay(options);
    });
  }
  private async connectRelay(options: { authToken: string; convexUrl: string; webOrigin: string }) {
    this.relay = new RemoteRelay(this.deviceId, () => this.notify(), async (command, reply) => {
      if (!this.handler) throw new Error("NOT_READY");
      await this.handler(command, reply);
    });
    return this.relay.start(options.authToken, options.convexUrl, options.webOrigin);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.getStatus());
  }

  private rotate(): void {
    this.disconnect();
    this.sessionId = crypto.randomUUID();
    this.secret = crypto.randomBytes(32).toString("hex");
    this.expiresAt = Date.now() + 15 * 60_000;
  }

  start(): Promise<RemoteDaemonStatus> {
    return this.serialize(async () => {
      if (this.origin) return this.getStatus();
      const address = this.address();
      const server = http.createServer((req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        if (!this.origin || req.headers.host !== new URL(this.origin).host || req.method !== "GET" || req.url !== `/r/${this.sessionId}`) {
          res.writeHead(404).end();
          return;
        }
        const nonce = crypto.randomBytes(18).toString("base64");
        res.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src ${this.origin.replace("http:", "ws:")}; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(createPairingPage(req.headers["accept-language"], nonce));
      });
      server.maxConnections = 32;
      server.headersTimeout = 10_000;
      server.requestTimeout = 10_000;
      const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });
      server.on("upgrade", (req, socket, head) => {
        let url: URL;
        try { url = new URL(req.url ?? "/", "http://localhost"); }
        catch { socket.destroy(); return; }
        const token = url.searchParams.get("key") ?? "";
        const valid = this.origin && req.headers.host === new URL(this.origin).host &&
          (!req.headers.origin || req.headers.origin === this.origin) && url.pathname === "/ws" &&
          this.secret && Buffer.byteLength(token) === Buffer.byteLength(this.secret) &&
          crypto.timingSafeEqual(Buffer.from(token), Buffer.from(this.secret)) &&
          url.searchParams.get("session") === this.sessionId && Date.now() < (this.expiresAt ?? 0) && this.clients.size < 4;
        if (!valid) {
          socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => this.connect(ws, req));
      });
      server.on("error", () => {});
      wss.on("error", () => {});
      try {
        await new Promise<void>((resolve, reject) => {
          server.once("error", reject);
          server.listen(0, address, () => { server.removeListener("error", reject); resolve(); });
        });
      } catch (error) {
        wss.close();
        server.close();
        throw error;
      }
      const bound = server.address();
      if (!bound || typeof bound === "string") throw new Error("REMOTE_BIND_FAILED");
      this.server = server;
      this.wss = wss;
      this.origin = `http://${address}:${bound.port}`;
      this.rotate();
      this.heartbeat = setInterval(() => {
        for (const [id, client] of this.clients) {
          if (!client.alive) { this.clients.delete(id); client.ws.terminate(); this.notify(); }
          else { client.alive = false; client.ws.ping(); }
        }
      }, 30_000);
      this.heartbeat.unref();
      this.notify();
      return this.getStatus();
    });
  }

  private connect(ws: WebSocket, req: http.IncomingMessage): void {
    const id = crypto.randomUUID();
    const device = { id, name: req.socket.remoteAddress ?? "", connectedAt: Date.now() };
    const client: Client = { ws, device, alive: true, pending: 0 };
    this.clients.set(id, client);
    ws.on("error", () => ws.terminate());
    ws.on("pong", () => { client.alive = true; });
    ws.on("close", () => { if (this.clients.delete(id)) this.notify(); });
    ws.on("message", async (data, binary) => {
      if (this.clients.get(id) !== client || ws.readyState !== WebSocket.OPEN) return;
      if (binary || client.pending >= 8) { ws.close(1008, "Invalid message"); return; }
      client.pending++;
      try {
        const parsed = remoteCommandSchema.safeParse(JSON.parse(data.toString()));
        if (!parsed.success) { this.send(ws, { type: "error", error: "INVALID_COMMAND" }); return; }
        const command = parsed.data;
        if (!this.handler) { this.send(ws, { type: "error", error: "NOT_READY" }); return; }
        await this.handler(command, (payload) => {
          if (this.clients.get(id) === client) this.send(ws, { type: "response", requestId: command.requestId, payload });
        });
      } catch {
        this.send(ws, { type: "error", error: "COMMAND_FAILED" });
      } finally { client.pending--; }
    });
    this.send(ws, { type: "handshake:ack", payload: { deviceId: this.deviceId } });
    this.notify();
  }

  private send(ws: WebSocket, data: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1024 * 1024) { ws.terminate(); return; }
    ws.send(JSON.stringify(data), (error) => { if (error) ws.terminate(); });
  }

  broadcast(message: { type: string; [key: string]: unknown }): void {
    this.relay?.broadcast(message);
    if (!this.clients.size) return;
    for (const { ws } of this.clients.values()) this.send(ws, message);
  }

  private disconnect(): void {
    const clients = Array.from(this.clients.values());
    this.clients.clear();
    for (const { ws } of clients) ws.terminate();
  }

  refresh(): Promise<RemoteDaemonStatus> {
    return this.serialize(async () => {
      if (this.relay && this.relayOptions) {
        await this.relay.stop();
        return this.connectRelay(this.relayOptions);
      }
      if (this.origin) { this.rotate(); this.notify(); }
      return this.getStatus();
    });
  }

  stop(): Promise<void> {
    return this.serialize(async () => {
      await this.relay?.stop();
      this.relay = null;
      this.relayOptions = null;
      this.disconnect();
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      this.origin = null;
      this.sessionId = this.secret = null;
      this.expiresAt = null;
      this.wss?.close();
      this.wss = null;
      const server = this.server;
      this.server = null;
      if (server) await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
      this.notify();
    });
  }
}

export const remoteDaemon = new RemoteDaemon();
