export class DesktopRequestQueue {
  private running = false;
  private waiting: Array<{ start: () => void; reject: (error: Error) => void }> = [];

  constructor(private readonly waitTimeoutMs = 30_000, private readonly onDrained = () => {}) {}

  enqueue<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const entry = {
        reject: (error: Error) => { clearTimeout(timer); reject(error); },
        start: () => {
          clearTimeout(timer);
          this.running = true;
          Promise.resolve().then(run).then(resolve, reject).finally(() => {
            this.running = false;
            const next = this.waiting.shift();
            if (next) next.start();
            else this.onDrained();
          });
        },
      };
      if (!this.running) entry.start();
      else {
        this.waiting.push(entry);
        timer = setTimeout(() => {
          this.waiting = this.waiting.filter(item => item !== entry);
          entry.reject(new Error("desktop_busy: timed out waiting for earlier computer operations; this request was not executed"));
        }, this.waitTimeoutMs);
      }
    });
  }

  cancelPending(error: Error): void {
    for (const entry of this.waiting.splice(0)) entry.reject(error);
  }
}
