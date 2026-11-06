import assert from "node:assert/strict";
import { test } from "node:test";
import { installReactMeasureCleanup } from "./renderer-health";

test("React prop measurements are released while unrelated application timings stay available", () => {
  let callback: PerformanceObserverCallback | undefined;
  let disconnected = false;
  const cleared: string[] = [];
  class Observer {
    constructor(cb: PerformanceObserverCallback) { callback = cb; }
    observe() {}
    disconnect() { disconnected = true; }
  }
  const stop = installReactMeasureCleanup({ clearMeasures: name => { cleared.push(name!); } }, Observer as unknown as typeof PerformanceObserver);
  const entries = [
    { name: "\u200bExecutionTrace", detail: { devtools: { track: "Components ⚛", properties: [["thinking", "x".repeat(100_000)]] } } },
    { name: "Update", detail: { devtools: { trackGroup: "Scheduler ⚛" } } },
    { name: "\u200bCustom application measurement", detail: { milliseconds: 12 } },
    { name: "database-save", detail: null },
  ];
  callback!({ getEntries: () => entries } as unknown as PerformanceObserverEntryList, {} as PerformanceObserver);
  assert.deepEqual(cleared, ["\u200bExecutionTrace", "Update"]);
  stop(); assert.equal(disconnected, true);
});

test("React timings omit large retained props while native measure behavior and other details are preserved", () => {
  const received: unknown[][] = [];
  const result = {} as PerformanceMeasure;
  const original: Performance["measure"] = (...args) => { received.push(args); return result; };
  const timeline = { measure: original, clearMeasures() {} };
  class Observer { observe() {} disconnect() {} }
  const stop = installReactMeasureCleanup(timeline, Observer as unknown as typeof PerformanceObserver);
  const options = { start: 1, end: 2, detail: { devtools: { track: "Components ⚛", properties: [["thinking", "x".repeat(1_000_000)]] } } };
  assert.equal(timeline.measure("\u200bThoughtItem", options), result);
  assert.equal(received[0]?.length, 2);
  const retained = received[0]?.[1] as PerformanceMeasureOptions;
  assert.equal(retained.detail.devtools.properties, undefined);
  assert.equal(retained.start, 1);
  assert.equal(retained.end, 2);
  assert.equal(options.detail.devtools.properties[0]?.[1]?.length, 1_000_000);
  const other = { detail: { task: "database", value: 17 } };
  timeline.measure("save", other);
  assert.equal(received[1]?.[1], other);
  stop(); assert.equal(timeline.measure, original);
});
