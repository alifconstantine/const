# Const Learn particle renderer

Source: `apps/learn/web/public/_astro/`.

- `main-particles.js` is the original MainParticlesComponent shader and class.
  Its page-wide bootstrap was replaced with a constructor export on
  `window.ConstLearnParticles`; React owns initialization and disposal.
- `Mouse.D0_DmmWM.js` is its existing bundled Three.js, sampling, noise, and
  pointer dependency. The pointer singleton's empty recursive animation loop
  was removed; pointer and resize tracking are unchanged.
- The particle class's resize listener now uses its existing bound callback so
  removal works, and disposal also releases particle geometry/render targets.

Visual shader code, camera, simulation, colors, density, and particle scale
are unchanged. The React wrapper supplies Learn's CTA parameters.
