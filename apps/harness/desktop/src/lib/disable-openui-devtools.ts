// This side-effect import must run before the OpenUI modules are evaluated.
(globalThis as Record<symbol, unknown>)[
  Symbol.for("openui.devtools.autoMount")
] = true;
