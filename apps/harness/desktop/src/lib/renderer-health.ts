/** React development tracks serialize changed props, including the entire trace,
 * into native PerformanceMeasure entries. Keep component timings, omit retained
 * prop snapshots, and bound history without touching conversation data. */
export function installReactMeasureCleanup(
  timeline: Pick<Performance, "clearMeasures"> & Partial<Pick<Performance, "measure">> = performance,
  Observer: typeof PerformanceObserver = PerformanceObserver,
): () => void {
  const isReact = (devtools: { track?: unknown; trackGroup?: unknown } | undefined) =>
    (typeof devtools?.track === "string" && devtools.track.includes("⚛")) ||
    (typeof devtools?.trackGroup === "string" && devtools.trackGroup.includes("⚛"));
  const originalMeasure = timeline.measure;
  const measure: Performance["measure"] = (...args) => {
    const options = args[1];
    if (options && typeof options === "object" && isReact(options.detail?.devtools)) {
      // React reuses its options object: never mutate it. Removing properties
      // before the native call avoids serializing megabytes of transcript per frame.
      const metadata = { ...options.detail.devtools };
      delete metadata.properties;
      args[1] = { ...options, detail: { ...options.detail, devtools: metadata } };
    }
    return Reflect.apply(originalMeasure!, timeline, args);
  };
  if (originalMeasure) timeline.measure = measure;
  const observer = new Observer(list => {
    const names = new Set<string>();
    for (const entry of list.getEntries()) {
      const devtools = (entry as PerformanceMeasure).detail?.devtools;
      if (isReact(devtools)) names.add(entry.name);
    }
    for (const name of names) timeline.clearMeasures(name);
  });
  observer.observe({ type: "measure", buffered: true });
  return () => {
    observer.disconnect();
    if (timeline.measure === measure) timeline.measure = originalMeasure;
  };
}

export interface RendererHealthSample {
  heapBytes?: number;
  nodes: number;
  longTasks: number;
  longestTaskMs: number;
}

export function installRendererHeartbeat(report: (sample: RendererHealthSample) => void): () => void {
  let longTasks = 0;
  let longestTaskMs = 0;
  let observer: PerformanceObserver | undefined;
  if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("longtask")) {
    observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) { longTasks++; longestTaskMs = Math.max(longestTaskMs, entry.duration); }
    });
    observer.observe({ type: "longtask" });
  }
  const sample = () => {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    report({ heapBytes: memory?.usedJSHeapSize, nodes: document.getElementsByTagName("*").length, longTasks, longestTaskMs: Math.round(longestTaskMs) });
    longTasks = 0;
    longestTaskMs = 0;
  };
  const timer = setInterval(sample, 15_000);
  return () => { clearInterval(timer); observer?.disconnect(); };
}
