// Definitions for the 21 live-tunable simulation parameters.
// Each entry drives a UI slider, a shader uniform, and is persisted to localStorage.

export const PARAM_DEFS = [
  // ---- Physics / geometry ----
  { id: "mass", group: "Physics", label: "Mass (R_s)", min: 0.4, max: 2.5, step: 0.01, default: 1.0, uniform: "uMass" },
  { id: "diskInner", group: "Physics", label: "Disk Inner (×R_s)", min: 1.5, max: 8, step: 0.1, default: 3.0, uniform: "uDiskInner" },
  { id: "diskOuter", group: "Physics", label: "Disk Outer (×R_s)", min: 4, max: 30, step: 0.5, default: 14.0, uniform: "uDiskOuter" },
  { id: "diskDensity", group: "Physics", label: "Disk Density", min: 0, max: 2, step: 0.01, default: 1.0, uniform: "uDiskDensity" },
  { id: "diskTemp", group: "Physics", label: "Disk Temperature (K)", min: 3000, max: 30000, step: 100, default: 9000, uniform: "uDiskTemp" },
  { id: "diskTilt", group: "Physics", label: "Disk Tilt (deg)", min: -80, max: 80, step: 1, default: 18, uniform: "uDiskTiltDeg" },
  { id: "diskSpeed", group: "Physics", label: "Disk Orbital Speed", min: 0, max: 2.5, step: 0.01, default: 1.0, uniform: "uDiskSpeed" },

  // ---- Relativistic effects ----
  { id: "dopplerStrength", group: "Relativity", label: "Doppler Beaming", min: 0, max: 2.5, step: 0.01, default: 1.0, uniform: "uDopplerStrength" },
  { id: "redshiftStrength", group: "Relativity", label: "Gravitational Redshift", min: 0, max: 2.5, step: 0.01, default: 1.0, uniform: "uRedshiftStrength" },
  { id: "photonRingBoost", group: "Relativity", label: "Photon Ring Boost", min: 0, max: 3, step: 0.01, default: 1.1, uniform: "uPhotonRingBoost" },

  // ---- Turbulence ----
  { id: "turbSpeed", group: "Turbulence", label: "Turbulence Speed", min: 0, max: 3, step: 0.01, default: 1.0, uniform: "uTurbSpeed" },
  { id: "turbScale", group: "Turbulence", label: "Turbulence Scale", min: 0.5, max: 6, step: 0.05, default: 2.2, uniform: "uTurbScale" },

  // ---- Background / sky ----
  { id: "starDensity", group: "Sky", label: "Star Density", min: 0, max: 2.5, step: 0.01, default: 1.0, uniform: "uStarDensity" },
  { id: "milkyWay", group: "Sky", label: "Milky Way Brightness", min: 0, max: 3, step: 0.01, default: 1.0, uniform: "uMilkyWayBrightness" },

  // ---- Camera ----
  { id: "fov", group: "Camera", label: "Field of View", min: 20, max: 100, step: 1, default: 50, uniform: "uFovDeg" },
  { id: "exposure", group: "Camera", label: "Exposure", min: 0.1, max: 4, step: 0.01, default: 1.15, uniform: "uExposure" },

  // ---- Post-processing ----
  { id: "bloomStrength", group: "Post FX", label: "Bloom Strength", min: 0, max: 3, step: 0.01, default: 1.1, uniform: "uBloomStrength" },
  { id: "bloomThreshold", group: "Post FX", label: "Bloom Threshold", min: 0, max: 3, step: 0.01, default: 0.9, uniform: "uBloomThreshold" },
  { id: "vignette", group: "Post FX", label: "Vignette", min: 0, max: 2, step: 0.01, default: 0.85, uniform: "uVignette" },
  { id: "grain", group: "Post FX", label: "Film Grain", min: 0, max: 2, step: 0.01, default: 0.35, uniform: "uGrain" },
  { id: "chromaticAberration", group: "Post FX", label: "Chromatic Aberration", min: 0, max: 2, step: 0.01, default: 0.5, uniform: "uChromaticAberration" },
];

// sanity: exactly 21 live parameters
console.assert(PARAM_DEFS.length === 21, `Expected 21 params, got ${PARAM_DEFS.length}`);

const STORAGE_KEY = "gargantua:params:v1";

export function defaultParams() {
  const p = {};
  for (const def of PARAM_DEFS) p[def.id] = def.default;
  return p;
}

export function loadParams() {
  const p = defaultParams();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      for (const def of PARAM_DEFS) {
        if (typeof saved[def.id] === "number" && !Number.isNaN(saved[def.id])) {
          p[def.id] = clamp(saved[def.id], def.min, def.max);
        }
      }
    }
  } catch (e) {
    console.warn("[gargantua] failed to load saved params", e);
  }
  return p;
}

export function saveParams(params) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch (e) {
    console.warn("[gargantua] failed to persist params", e);
  }
}

export function applyURLOverrides(params) {
  const usp = new URLSearchParams(location.search);
  for (const def of PARAM_DEFS) {
    if (usp.has(def.id)) {
      const v = parseFloat(usp.get(def.id));
      if (!Number.isNaN(v)) params[def.id] = clamp(v, def.min, def.max);
    }
  }
  return params;
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
