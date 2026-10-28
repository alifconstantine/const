/** UI caches must never prevent rendering when the browser's storage quota is full. */
export function createRemoteUiStorage(sessionId: string, backing: Storage): Storage {
  const prefix = `const_remote_ui:${sessionId}:`;
  const values = new Map<string, string>();
  try {
    for (let index = 0; index < backing.length; index++) {
      const key = backing.key(index);
      if (key?.startsWith(prefix)) {
        const value = backing.getItem(key);
        if (value !== null) values.set(key.slice(prefix.length), value);
      }
    }
  } catch { /* Storage can be unavailable in restricted browser contexts. */ }
  const persist = (change: () => void) => {
    try { change(); } catch { /* Keep this tab's in-memory UI state usable. */ }
  };
  const methods = {
    getItem: (key: string) => values.get(String(key)) ?? null,
    setItem(key: string, value: string) {
      key = String(key);
      value = String(value);
      values.set(key, value);
      persist(() => backing.setItem(prefix + key, value));
    },
    removeItem(key: string) {
      key = String(key);
      values.delete(key);
      persist(() => backing.removeItem(prefix + key));
    },
    clear() {
      for (const key of values.keys()) persist(() => backing.removeItem(prefix + key));
      values.clear();
    },
    key: (index: number) => [...values.keys()][index] ?? null,
  };
  return new Proxy({} as Storage, {
    get(_target, key) {
      if (key === "length") return values.size;
      if (Object.hasOwn(methods, key)) return methods[key as keyof typeof methods];
      return typeof key === "string" ? values.get(key) : undefined;
    },
    set(_target, key, value) {
      methods.setItem(String(key), String(value));
      return true;
    },
    deleteProperty(_target, key) {
      methods.removeItem(String(key));
      return true;
    },
    ownKeys: () => [...values.keys()],
    getOwnPropertyDescriptor(_target, key) {
      if (typeof key === "string" && values.has(key))
        return { configurable: true, enumerable: true, writable: true, value: values.get(key) };
      return undefined;
    },
  });
}

/** Keep desktop UI caches separate from pairing credentials and other hosts. */
export function scopedRemoteStorage(sessionId: string) {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  const storage = createRemoteUiStorage(sessionId, window.sessionStorage);
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  return () => {
    if (original) Object.defineProperty(window, "localStorage", original);
    else Reflect.deleteProperty(window, "localStorage");
  };
}
