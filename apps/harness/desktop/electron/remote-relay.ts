import { ConvexClient } from "convex/browser";
import { WebSocket } from "ws";
import {
  broker,
  commandSchema,
  type RemoteCommand,
  type RemotePacket,
} from "@const/remote/protocol";
import {
  digest,
  generatePairingCode,
  randomSecret,
  seal,
  sealWithCode,
} from "@const/remote/crypto";
import { packTransfer, unpackTransfer } from "@const/remote/transfer";
import type { RemoteDaemonStatus } from "../src/lib/remote-control";

export class RemoteRelay {
  private client: ConvexClient | null = null;
  private credentials: { sessionId: string; hostHash: string } | null = null;
  private secret = "";
  private status: RemoteDaemonStatus;
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe?: () => void;
  private processing = new Set<string>();
  private events: RemotePacket[] = [];
  private publishing = false;
  private stopped = false;

  constructor(
    private deviceId: string,
    private notify: (status: RemoteDaemonStatus) => void,
    private command: (
      command: RemoteCommand,
      reply: (value: unknown) => void,
    ) => void | Promise<void>,
    private createClient: (url: string) => ConvexClient = (url) =>
      new ConvexClient(url, { webSocketConstructor: WebSocket as any }),
  ) {
    this.status = {
      status: "idle",
      deviceId,
      sessionId: null,
      pairingUrl: null,
      localBridgeUrl: null,
      expiresAt: null,
      connectedDevices: [],
      transport: "relay",
    };
  }
  getStatus() {
    return this.status;
  }
  async start(authToken: string, convexUrl: string, webOrigin: string) {
    const origin = new URL(webOrigin);
    if (
      origin.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(origin.hostname)
    )
      throw new Error("REMOTE_HTTPS_REQUIRED");
    this.client = this.createClient(convexUrl);
    this.client.setAuth(async () => authToken);
    this.secret = randomSecret();
    const pairingCode = generatePairingCode();
    const encryptedSecret = await sealWithCode(pairingCode, this.secret);
    const hostHash = await digest(randomSecret());
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      let sessionId: string;
      try {
        sessionId = (await Promise.race([
          this.client.mutation(broker.create, {
            deviceName: this.deviceId,
            hostHash,
            pairHash: await digest(this.secret),
            pairingCode,
            encryptedSecret,
          }),
          new Promise<never>((_resolve, reject) => {
            startupTimer = setTimeout(
              () => reject(new Error("REMOTE_TIMEOUT")),
              20_000,
            );
          }),
        ])) as string;
      } catch (mutationError: any) {
        if (startupTimer) clearTimeout(startupTimer);
        const errMsg = String(mutationError?.data?.code || mutationError?.message || mutationError || "");
        if (errMsg.includes("REMOTE_UNAUTHORIZED") || errMsg.includes("UNAUTHORIZED")) {
          console.error(`[RemoteRelay] Unauthorized on Convex relay (${convexUrl}):`, errMsg);
          throw new Error("REMOTE_UNAUTHORIZED");
        }
        // Fallback in case connected Convex relay has older arguments schema
        sessionId = (await Promise.race([
          this.client.mutation(broker.create, {
            deviceName: this.deviceId,
            hostHash,
            pairHash: await digest(this.secret),
          }),
          new Promise<never>((_resolve, reject) => {
            startupTimer = setTimeout(
              () => reject(new Error("REMOTE_TIMEOUT")),
              20_000,
            );
          }),
        ])) as string;
      }
      if (startupTimer) clearTimeout(startupTimer);
      this.credentials = { sessionId, hostHash };
      this.status = {
        ...this.status,
        status: "waiting",
        sessionId,
        pairingUrl: `${origin.origin}/r/${sessionId}#key=${this.secret}`,
        pairingCode,
        expiresAt: Date.now() + 15 * 60_000,
      };
      this.unsubscribe = this.client.onUpdate(
        broker.hostInbox,
        this.credentials,
        (inbox: any) => {
          if (this.stopped) return;
          this.status = {
            ...this.status,
            status: inbox.devices.length ? "connected" : "waiting",
            connectedDevices: inbox.devices,
          };
          this.notify(this.status);
          for (const command of inbox.commands) void this.handle(command);
        },
        () => {
          if (!this.stopped) void this.stop();
        },
      );
      this.timer = setInterval(() => {
        void this.client
          ?.mutation(broker.heartbeat, this.credentials!)
          .catch(() => this.stop());
      }, 15_000);
      this.notify(this.status);
      return this.status;
    } catch (error) {
      if (startupTimer) clearTimeout(startupTimer);
      await this.stop();
      throw error;
    }
  }
  private async handle(row: {
    _id: string;
    requestId: string;
    packet: string;
  }) {
    if (this.processing.has(row._id) || !this.client || !this.credentials)
      return;
    this.processing.add(row._id);
    const client = this.client,
      credentials = this.credentials;
    try {
      if (
        !(await client.mutation(broker.claim, {
          ...credentials,
          commandId: row._id,
        }))
      )
        return;
      const raw = await unpackTransfer(
        this.secret,
        `${credentials.sessionId}:command:${row.requestId}`,
        row.packet,
        (index) => client.query(broker.commandChunk, { ...credentials, commandId: row._id, index }),
      );
      const command = commandSchema.parse(raw);
      if (command.requestId !== row.requestId || this.stopped) return;
      let response: unknown = { success: false, error: "UNSUPPORTED_COMMAND" };
      try {
        await this.command(command, (value) => {
          response = value;
        });
      } catch {
        response = { success: false, error: "COMMAND_FAILED" };
      }
      const encrypted = await packTransfer(
        this.secret,
        `${credentials.sessionId}:response:${row.requestId}`,
        response,
        row._id,
      );
      for (let index = 0; index < encrypted.parts.length; index++) {
        if (this.stopped) return;
        await client.mutation(broker.writeResponseChunk, { ...credentials, commandId: row._id, index, packet: encrypted.parts[index] });
      }
      if (!this.stopped)
        await client.mutation(broker.complete, {
          ...credentials,
          commandId: row._id,
          response: encrypted.packet,
        });
    } catch {
      /* A claimed command is never automatically re-executed after failure. */
    } finally {
      this.processing.delete(row._id);
    }
  }
  broadcast(event: RemotePacket) {
    if (this.stopped || !this.credentials) return;
    if (event.type === "desktop:event") {
      // History is fetched authoritatively; never repeat a whole transcript in a notification.
      if (event.channel === "conversations:changed") event = { ...event, args: [{ conversationId: (event.args as any[])?.[0]?.conversationId, originRequestId: (event.args as any[])?.[0]?.originRequestId, uiOnly: (event.args as any[])?.[0]?.uiOnly }] };
      const serialized = JSON.stringify(event);
      if (new TextEncoder().encode(serialized).length > 40_000) {
        // Fetch the complete host snapshot when an event exceeds the fragment
        // limit. Truncating tool output here would make the two views disagree.
        if (serialized.length > 2_000_000) { this.broadcast({ type: "resync" }); return; }
        const id = crypto.randomUUID();
        const count = Math.ceil(serialized.length / 8000);
        for (let index = 0; index < count; index++)
          this.broadcast({
            type: "desktop:event-part",
            id,
            index,
            count,
            data: serialized.slice(index * 8000, (index + 1) * 8000),
          });
        return;
      }
    }
    if (new TextEncoder().encode(JSON.stringify(event)).length > 40_000) {
      event = {
        type: event.type,
        conversationId: event.conversationId,
        runId: event.runId,
        event: {
          type: event.event?.type,
          toolName: event.event?.toolName,
          result: String(event.event?.result || "").slice(0, 10_000),
        },
      };
    }
    this.events.push(event);
    if (this.events.length > 1000) {
      void this.stop();
      return;
    }
    if (!this.flushTimer)
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.flush();
      }, 100);
  }
  private async flush() {
    if (this.publishing || !this.client || !this.credentials || this.stopped)
      return;
    this.publishing = true;
    try {
      while (this.events.length && !this.stopped) {
        const batch: RemotePacket[] = [];
        let size = 0;
        while (this.events.length && batch.length < 30) {
          const next = this.events[0]!;
          const length = new TextEncoder().encode(JSON.stringify(next)).length;
          if (batch.length && size + length > 48_000) break;
          size += length;
          batch.push(this.events.shift()!);
        }
        const packet = await seal(
          this.secret,
          `${this.credentials.sessionId}:events`,
          batch,
        );
        await this.client.mutation(broker.publish, {
          ...this.credentials,
          packet,
        });
      }
    } catch {
      if (!this.stopped) void this.stop();
    } finally {
      this.publishing = false;
    }
  }
  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.unsubscribe?.();
    if (this.client && this.credentials) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        this.client.mutation(broker.revoke, this.credentials).catch(() => {}),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 1500);
        }),
      ]);
      if (timer) clearTimeout(timer);
    }
    await this.client?.close();
    this.client = null;
    this.secret = "";
    this.events = [];
    this.status = {
      ...this.status,
      status: "idle",
      sessionId: null,
      pairingUrl: null,
      pairingCode: null,
      expiresAt: null,
      connectedDevices: [],
    };
    this.notify(this.status);
  }
}
