# GARGANTUA — Schwarzschild Black Hole Raytracer

A full-screen, real-time raytracer that integrates Schwarzschild null geodesics per pixel in a
single GLSL fragment shader. There are no meshes, textures, images, or video standing in for the
black hole, the accretion disk, the photon ring, or the sky — every one of them is a direct
consequence of the light-bending physics computed live on the GPU. Three.js is used only as a
thin WebGL2 harness (render targets, a full-screen triangle, camera/orbit math) around that
shader.

## Quick start

No build step, no npm install, no bundler. Every dependency ships in `lib/` as a plain ES module.

```bash
cd black_hole
python3 -m http.server 8080     # or: npx serve .  /  php -S localhost:8080
```

Open `http://localhost:8080/` in a WebGL2-capable browser (recent Chrome, Firefox, Safari, Edge).
It must be served over HTTP(S) — `file://` will not satisfy ES module import rules.

## What's actually being simulated

For a spherically symmetric spacetime, every photon trajectory is confined to the plane spanned
by the black hole and its initial position/velocity. Reducing the Schwarzschild geodesic equation
to that plane and writing it in Cartesian form gives an exact, compact ODE for the ray:

```
d²r⃗/dλ² = -1.5 · Rs · h² · r⃗ / |r⃗|⁵         (Rs = 2M, h = |r⃗ × v⃗| conserved)
```

`h` only needs to be computed once per pixel from the camera ray, because the "force" is always
parallel to `r⃗` — a central force conserves angular momentum automatically, so the integrator
never has to re-derive it. This single equation reproduces, with no additional hacks:

- the photon sphere at exactly `1.5 Rs`
- the ISCO at exactly `3 Rs`
- gravitational lensing of the background stars (the ray's *final* direction after bending is
  what samples the sky, so lensing falls out of the integration for free)
- the black hole shadow / event horizon
- multiple images of the accretion disk stacked above and below the shadow, because a winding
  ray can cross the disk plane several times before it escapes or falls in — each crossing is
  alpha-composited independently (see `js/shaders/raytrace.js`, `shadeDiskCrossing`)

Per disk crossing the shader computes a Keplerian orbital velocity, then derives:

- **relativistic Doppler beaming** — `D = 1 / (γ(1 − β·n̂))` — brightens the approaching limb and
  dims the receding one, and also blue/red-shifts the local blackbody color, not just its
  intensity
- **gravitational redshift** — `g = √(1 − Rs/r)`
- turbulent structure from a time-evolving fbm noise field sheared by the local orbital rate

Integration is a leapfrog/velocity-Verlet scheme with an adaptive step (small near the horizon,
large far away), capped by `uMaxSteps` (driven by the active quality profile). Debug view 7
(deflection-angle heatmap) and view 8 (photon-sphere proximity) are the most direct visual proof
that the integrator is doing real physics rather than a fake lens distortion.

## Controls

| Input | Action |
|---|---|
| Drag / scroll / right-drag | Orbit / zoom / pan (OrbitControls) |
| `0`–`9` | Debug view (see below) |
| `Shift`+`1`–`4` | Camera presets: Approach, Photon Ring, Disk Grazing, Polar Overview |
| `C` | Toggle cinematic auto-orbit |
| `Space` | Pause / resume simulation time |
| `H` | Toggle HUD |
| `U` | Toggle parameter panel |
| `S` | Save a PNG screenshot |
| `R` | Reset all 21 parameters to defaults |
| `M` | Toggle procedural audio |
| `F` | Toggle fullscreen |
| `Q` | Cycle quality profile (low → medium → high) |

All of this is also reachable from the on-screen panel/HUD (the ☰ CONTROLS drawer, the preset
nav bar, the quality/audio/HUD buttons bottom-right, and the debug strip bottom-center).

## The 21 live parameters

Grouped under **Physics** (mass, disk inner/outer radius, density, temperature, tilt, orbital
speed), **Relativity** (Doppler beaming strength, gravitational redshift strength, photon-ring
boost), **Turbulence** (speed, scale), **Sky** (star density, Milky Way brightness), **Camera**
(FOV, exposure), and **Post FX** (bloom strength/threshold, vignette, film grain, chromatic
aberration). Every slider writes straight to a shader uniform and is debounced into
`localStorage` so your look persists across reloads. See `js/params.js` for the exact list,
ranges and defaults.

## Debug views (0–9)

`0` final composite · `1` raw HDR radiance (no bloom/tonemap/FX) · `2` disk emission only ·
`3` starfield/Milky Way only · `4` Doppler-factor heatmap · `5` gravitational-redshift heatmap ·
`6` integration step-count heatmap · `7` deflection-angle heatmap · `8` photon-sphere proximity
map · `9` bloom bright-pass buffer.

## Rendering pipeline

1. **Raytrace pass** — the geodesic integrator above, into an HDR (`HalfFloat`) render target.
2. **Bloom** — threshold/soft-knee bright-pass → a multi-mip (3–5 levels, by quality) separable
   9-tap Gaussian blur chain → additive upsample recombination.
3. **Composite** — chromatic aberration (per-channel radial UV offset), exposure, a manual
   Narkowicz ACES filmic tonemap, vignette, and per-pixel hashed film grain (seeded off
   `gl_FragCoord` and the frame counter, so it's deterministic in screenshot mode), finished with
   a manual sRGB encode. Deep blacks are preserved because the raytracer emits true `0` for the
   event horizon and nothing in the pipeline lifts black level.

Every pass is a hand-rolled full-screen-triangle `ShaderMaterial` — there's no dependency on
`three/examples/jsm/postprocessing` beyond `OrbitControls`, so the whole pipeline is ~5 small
shader files.

## Quality profiles

| | Low | Medium | High |
|---|---|---|---|
| Render scale | 0.62× | 0.88× | 1.0× |
| Pixel ratio cap | 1.0 | 1.5 | up to 2.5 (device DPR) |
| Max integration steps | 70 | 150 | 260 |
| Bloom mip levels | 3 | 4 | 5 |

Responsive resizing (window resize / orientation change) and Retina/HDPI rendering are both
handled by `resize()` in `js/main.js`, which recomputes internal render-target resolution from
`renderer.getDrawingBufferSize()` on every change.

## Persistence, recovery, determinism

- **Persistence**: all 21 parameters, the active quality profile, debug view, and HUD visibility
  are saved to `localStorage` and restored on load.
- **WebGL context loss**: `webglcontextlost`/`webglcontextrestored` are handled — the render loop
  pauses and the full render-target/material pipeline is rebuilt on restore, with no reload
  required.
- **Deterministic screenshot mode**: append `?screenshot=1` to the URL and the app freezes time,
  disables OrbitControls/cinematic/audio, and renders with a fixed frame index (so film grain is
  reproducible). Useful query params:

  ```
  ?screenshot=1&t=8&preset=0&debug=0&quality=medium&w=1920&h=1080&seed=1337&download=1
  ```

  `t` freezes simulation time (seconds), `preset` snaps the camera instantly (no tween),
  `debug` picks the view, `w`/`h` force an exact output resolution regardless of viewport,
  `seed` seeds the procedural starfield, and any of the 21 parameter ids can be passed directly
  (e.g. `&diskTilt=45&dopplerStrength=2`). The app sets `window.__screenshotReady = true` once a
  few frames have settled — headless tooling (Playwright/Puppeteer) should wait on that flag
  before calling `canvas.toBlob()` / `page.screenshot()`. Pass `download=1` to also trigger an
  automatic PNG download.

## Project layout

```
index.html                 shell, import map, UI markup
css/style.css               cinematic dark UI chrome
js/main.js                  renderer, RT/bloom pipeline, camera rig, loop, hotkeys, screenshot mode
js/params.js                21 live parameters + persistence
js/presets.js                4 camera presets + cinematic path
js/ui.js / js/hud.js         control-panel builder + telemetry HUD
js/audio.js                  procedural WebAudio drone (no binary assets)
js/shaders/vert.js           shared full-screen-triangle vertex shader
js/shaders/raytrace.js       the geodesic integrator (the actual "raytracer")
js/shaders/post.js           bloom + ACES/vignette/grain/CA composite
lib/three/...                local Three.js r185 module build + OrbitControls (no npm install)
```

## Verification performed

Exercised headlessly (Chromium + SwiftShader software GL, since this dev sandbox has no GPU) via
Playwright, against a local `python3 -m http.server`:

- All **10 debug views** rendered via `?screenshot=1` at multiple resolutions/quality profiles —
  zero console errors, zero page errors, non-black output confirmed by direct canvas pixel
  sampling.
- Full **beauty renders** at the Approach / Disk Grazing / Polar Overview presets — correct
  photon ring, correctly lensed multi-image accretion disk, correct Doppler-asymmetric disk
  color, bloom, vignette, grain, deep blacks.
- **Interactive smoke test**: panel open/close, a parameter slider, all 4 presets, cinematic
  toggle, all 3 quality profiles, all 10 debug-view buttons, randomize/reset/screenshot buttons,
  a full `WEBGL_lose_context` → `restoreContext()` cycle, and a live viewport resize — zero
  console errors throughout, app remained responsive and correctly rendered afterward.
- Fixed during verification: a missing `three.core.js` companion module for the local Three.js
  build, an invalid `renderer.outputColorSpace` assignment, a temporal-dead-zone bug in preset
  initialization order, a CSS specificity bug that kept the WebGL-unavailable overlay visible
  regardless of its `hidden` attribute, and a missing `renderer.autoClear = false` that was
  silently wiping the additive bloom accumulation every frame.

No known black screens or unhandled console errors remain. On real GPU hardware (this was only
validated under software rendering) all three quality profiles should run comfortably above
30 fps on any discrete/integrated GPU from the last ~8 years.
