import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { broker, type RemoteCommand, type RemotePacket } from "./protocol";
import { digest, open, randomSecret } from "./crypto";
import { packTransfer, unpackTransfer } from "./transfer";

type Grant = { sessionId: string; deviceId: string; secretHash: string };
export class RemoteClient {
  private client: ConvexClient;
  private grant: Grant | null = null;
  private unsubscribe?: () => void;
  private timer?: ReturnType<typeof setInterval>;
  private revision = 0;
  private initialized = false;
  private feedQueue: Promise<unknown> = Promise.resolve();
  private pending = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private closed = false;
  private rejectReady?: (error: Error) => void;
  private rejectConnect?: (error: Error) => void;
  private closePromise?: Promise<void>;
  constructor(
    private sessionId: string,
    private key: string,
    url: string,
    token: string,
    private event: (event: RemotePacket) => void,
    private presence: (online: boolean, device: string) => void,
    private failure: (error?: unknown) => void,
    createClient: (url: string) => ConvexClient = (url) =>
      new ConvexClient(url, { unsavedChangesWarning: false }),
  ) {
    this.client = createClient(url);
    this.client.setAuth(async () => token);
  }
  async connect() {
    if (this.closed) throw new Error("REMOTE_DISCONNECTED");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.initialize(),
        new Promise<never>((_resolve, reject) => {
          this.rejectConnect = reject;
          timeout = setTimeout(
            () => reject(new Error("REMOTE_TIMEOUT")),
            25_000,
          );
        }),
      ]);
    } catch (error) {
      await this.close();
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
      this.rejectReady = undefined;
      this.rejectConnect = undefined;
    }
  }
  private async initialize() {
    const storageKey = `const_remote_grant:${this.sessionId}`;
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      try {
        const grant = JSON.parse(stored) as Grant;
        if (
          grant.sessionId === this.sessionId &&
          typeof grant.deviceId === "string" &&
          /^[A-Za-z0-9_-]{43}$/.test(grant.secretHash)
        )
          this.grant = grant;
      } catch {
        /* A corrupt tab cache may safely pair again using its stable proof. */
      }
      if (!this.grant) sessionStorage.removeItem(storageKey);
    }
    if (!this.grant) {
      const secretKey = `const_remote_device_secret:${this.sessionId}`;
      const secretHash =
        sessionStorage.getItem(secretKey) || (await digest(randomSecret()));
      if (this.closed) throw new Error("REMOTE_DISCONNECTED");
      sessionStorage.setItem(secretKey, secretHash);
      const pairHash = await digest(this.key);
      if (this.closed) throw new Error("REMOTE_DISCONNECTED");
      const deviceId = await this.client.mutation(broker.join, {
        sessionId: this.sessionId,
        pairHash,
        secretHash,
        name: navigator.userAgent.includes("Android")
          ? "Android"
          : navigator.userAgent.includes("iPhone")
            ? "iPhone"
            : "Browser",
      });
      if (this.closed) throw new Error("REMOTE_DISCONNECTED");
      this.grant = { sessionId: this.sessionId, deviceId, secretHash };
      sessionStorage.setItem(storageKey, JSON.stringify(this.grant));
    }
    if (this.closed) throw new Error("REMOTE_DISCONNECTED");
    await new Promise<void>((resolve, reject) => {
      this.rejectReady = reject;
      this.unsubscribe = this.client.onUpdate(
        broker.deviceFeed,
        this.grant,
        (feed: any) => {
          this.feedQueue = this.feedQueue
            .then(async () => {
              if (this.closed) return;
              this.presence(
                Date.now() - feed.heartbeatAt < 45_000,
                feed.deviceName,
              );
              for (const response of feed.responses) {
                const pending = this.pending.get(response.requestId);
                if (!pending) continue;
                const value = await unpackTransfer(
                  this.key,
                  `${this.sessionId}:response:${response.requestId}`,
                  response.response,
                  (index, commandId) =>
                    this.client.query(broker.responseChunk, {
                      ...this.grant!,
                      commandId,
                      index,
                    }),
                );
                clearTimeout(pending.timer);
                this.pending.delete(response.requestId);
                pending.resolve(value);
              }
              const first = feed.events[0]?.revision ?? 0;
              if (this.initialized && first > this.revision + 1) {
                this.revision = feed.revision;
                this.event({ type: "resync" });
                return;
              }
              // Old replay frames are skipped on first connection; a fresh snapshot follows.
              if (!this.initialized) {
                this.initialized = true;
                this.revision = feed.revision;
                resolve();
                return;
              }
              for (const frame of feed.events) {
                if (frame.revision <= this.revision) continue;
                const events = await open<RemotePacket[]>(
                  this.key,
                  `${this.sessionId}:events`,
                  frame.packet,
                );
                if (this.closed) return;
                this.revision = frame.revision;
                for (const event of events) this.event(event);
              }
            })
            .catch((error) => this.reportFailure(error));
        },
        (error) => this.reportFailure(error),
      );
      if (this.closed) this.unsubscribe?.();
    });
    if (this.closed) throw new Error("REMOTE_DISCONNECTED");
    this.timer = setInterval(() => {
      if (this.grant)
        void this.client
          .mutation(broker.pingDevice, this.grant)
          .catch((error) => this.reportFailure(error));
    }, 15_000);
  }
  private reportFailure(error: unknown) {
    if (this.closed) return;
    const reason = error instanceof Error ? error : new Error("REMOTE_FAILED");
    this.rejectConnect?.(reason);
    this.rejectReady?.(reason);
    this.failure(error);
    this.unsubscribe?.();
    if (this.timer) clearInterval(this.timer);
    void this.close();
  }
  async request(
    command: Omit<RemoteCommand, "requestId"> & { payload?: any },
    requestId = crypto.randomUUID(),
    timeoutMs = 25_000,
  ): Promise<any> {
    if (!this.grant || this.closed) throw new Error("REMOTE_DISCONNECTED");
    if (this.pending.size >= 16) throw new Error("REMOTE_BUSY");
    const transfer = await packTransfer(
      this.key,
      `${this.sessionId}:command:${requestId}`,
      { ...command, requestId },
    );
    if (!this.grant || this.closed) throw new Error("REMOTE_DISCONNECTED");
    if (this.pending.size >= 16) throw new Error("REMOTE_BUSY");
    if (this.pending.has(requestId))
      throw new Error("REMOTE_DUPLICATE_REQUEST");
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("REMOTE_TIMEOUT"));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      void this.client
        .mutation(broker.submit, {
          ...this.grant!,
          requestId,
          packet: transfer.packet,
          ...(transfer.parts.length
            ? { chunkCount: transfer.parts.length }
            : {}),
        })
        .then(async (commandId) => {
          for (let index = 0; index < transfer.parts.length; index++) {
            if (this.closed) throw new Error("REMOTE_DISCONNECTED");
            await this.client.mutation(broker.uploadChunk, {
              ...this.grant!,
              commandId,
              index,
              packet: transfer.parts[index],
            });
          }
        })
        .catch((error) => {
          clearTimeout(timer);
          this.pending.delete(requestId);
          reject(error);
        });
    });
  }
  close(revoke = false): Promise<void> {
    if (revoke) {
      sessionStorage.removeItem(`const_remote_grant:${this.sessionId}`);
      sessionStorage.removeItem(`const_remote_key:${this.sessionId}`);
      sessionStorage.removeItem(`const_remote_device_secret:${this.sessionId}`);
    }
    if (this.closePromise) return this.closePromise;
    this.closed = true;
    this.rejectConnect?.(new Error("REMOTE_DISCONNECTED"));
    this.rejectReady?.(new Error("REMOTE_DISCONNECTED"));
    this.unsubscribe?.();
    if (this.timer) clearInterval(this.timer);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("REMOTE_DISCONNECTED"));
    }
    this.pending.clear();
    this.closePromise = this.finishClose(revoke);
    return this.closePromise;
  }
  private async finishClose(revoke: boolean) {
    if (revoke && this.grant) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        this.client.mutation(broker.leave, this.grant).catch(() => {}),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 1500);
        }),
      ]);
      if (timer) clearTimeout(timer);
    }
    await this.client.close();
  }
  async profile() {
    return this.client.query(
      makeFunctionReference<"query">("users:currentUser"),
      {},
    );
  }
}
