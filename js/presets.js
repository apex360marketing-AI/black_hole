// Camera presets and the cinematic auto-orbit path.
// Spherical coordinates around the origin (black hole center): theta = polar angle from
// +Y (0 = looking straight down the pole), phi = azimuth, radius = distance in world units
// (≈ multiples of R_s when the mass parameter is at its default of 1.0).

export const CAMERA_PRESETS = [
  { name: "Approach", radius: 16, theta: 1.30, phi: 0.6, fov: 50 },
  { name: "Photon Ring", radius: 4.2, theta: 1.45, phi: 1.2, fov: 36 },
  { name: "Disk Grazing", radius: 9.0, theta: 1.50, phi: 2.4, fov: 55 },
  { name: "Polar Overview", radius: 13.0, theta: 0.28, phi: 0.0, fov: 60 },
];

// Returns {radius, theta, phi} for the smooth, endless cinematic orbit at time t (seconds).
export function cinematicPath(t) {
  const radius = 10.5 + 4.5 * Math.sin(t * 0.045) + 1.2 * Math.sin(t * 0.13 + 1.7);
  const theta = 1.15 + 0.42 * Math.sin(t * 0.062 + 0.6) + 0.12 * Math.sin(t * 0.021);
  const phi = t * 0.075 + 0.4 * Math.sin(t * 0.031);
  return { radius, theta, phi };
}
