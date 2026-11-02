import { AsyncLocalStorage } from "node:async_hooks";

/** Async ownership survives awaits; selecting another chat never changes it. */
export class BrowserSessionState<T> {
  private readonly context = new AsyncLocalStorage<{ sessionId: string; signal?: AbortSignal }>();
  private readonly sessions = new Map<string, T>();

  constructor(private readonly create: () => T) {}

  get sessionId(): string { return this.context.getStore()?.sessionId ?? ""; }
  get signal(): AbortSignal | undefined { return this.context.getStore()?.signal; }
  get current(): T {
    const id = this.sessionId;
    if (!this.sessions.has(id)) this.sessions.set(id, this.create());
    return this.sessions.get(id)!;
  }
  run<R>(sessionId: string | undefined, operation: () => R, signal?: AbortSignal): R {
    return this.context.run({ sessionId: sessionId ?? "", signal }, operation);
  }
  find(predicate: (state: T) => boolean): string | undefined {
    for (const [id, state] of this.sessions) if (predicate(state)) return id;
    return undefined;
  }
}
