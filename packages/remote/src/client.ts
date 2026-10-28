import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { broker, type RemoteCommand, type RemotePacket } from "./protocol";
import { digest, open, randomSecret, seal } from "./crypto";

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
  constructor(
    private sessionId: string,
    private key: string,
    url: string,
    token: string,
    private event: (event: RemotePacket) => void,
    private presence: (online: boolean, device: string) => void,
    private failure: () => void,
    createClient: (url: string) => ConvexClient = (url) =>
      new ConvexClient(url, { unsavedChangesWarning: false }),
  ) {
    this.client = createClient(url);
    this.client.setAuth(async () => token);
  }
  async connect() {
    const storageKey = `const_remote_grant:${this.sessionId}`;
    const stored = sessionStorage.getItem(storageKey);
    if (stored) this.grant = JSON.parse(stored) as Grant;
    else {
      const secretKey = `const_remote_device_secret:${this.sessionId}`;
      const secretHash =
        sessionStorage.getItem(secretKey) || (await digest(randomSecret()));
      sessionStorage.setItem(secretKey, secretHash);
      const deviceId = await this.client.mutation(broker.join, {
        sessionId: this.sessionId,
        pairHash: await digest(this.key),
        secretHash,
        name: navigator.userAgent.includes("Android")
          ? "Android"
          : navigator.userAgent.includes("iPhone")
            ? "iPhone"
            : "Browser",
      });
      this.grant = { sessionId: this.sessionId, deviceId, secretHash };
      sessionStorage.setItem(storageKey, JSON.stringify(this.grant));
    }
    if (this.closed) return;
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
              const value = await open(
                this.key,
                `${this.sessionId}:response:${response.requestId}`,
                response.response,
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
          .catch(() => {
            if (!this.closed) this.failure();
          });
      },
      () => {
        if (!this.closed) this.failure();
      },
    );
    this.timer = setInterval(() => {
      if (this.grant)
        void this.client.mutation(broker.pingDevice, this.grant).catch(() => {
          if (!this.closed) this.failure();
        });
    }, 15_000);
  }
  async request(
    command: Omit<RemoteCommand, "requestId"> & { payload?: any },
    requestId = crypto.randomUUID(),
  ): Promise<any> {
    if (!this.grant || this.closed) throw new Error("REMOTE_DISCONNECTED");
    if (this.pending.size >= 8) throw new Error("REMOTE_BUSY");
    const packet = await seal(
      this.key,
      `${this.sessionId}:command:${requestId}`,
      { ...command, requestId },
    );
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("REMOTE_TIMEOUT"));
      }, 25_000);
      this.pending.set(requestId, { resolve, reject, timer });
      void this.client
        .mutation(broker.submit, { ...this.grant!, requestId, packet })
        .catch((error) => {
          clearTimeout(timer);
          this.pending.delete(requestId);
          reject(error);
        });
    });
  }
  async close(revoke = false) {
    this.closed = true;
    this.unsubscribe?.();
    if (this.timer) clearInterval(this.timer);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("REMOTE_DISCONNECTED"));
    }
    this.pending.clear();
    if (revoke && this.grant) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        this.client.mutation(broker.leave, this.grant).catch(() => {}),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 1500);
        }),
      ]);
      if (timer) clearTimeout(timer);
      sessionStorage.removeItem(`const_remote_grant:${this.sessionId}`);
      sessionStorage.removeItem(`const_remote_key:${this.sessionId}`);
      sessionStorage.removeItem(`const_remote_device_secret:${this.sessionId}`);
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
