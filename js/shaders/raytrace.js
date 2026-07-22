// Core physics pass: per-pixel integration of Schwarzschild null geodesics.
//
// Method: for a spherically symmetric spacetime every photon trajectory stays confined to the
// plane spanned by the black hole center and its initial position/direction. Reducing the
// Schwarzschild geodesic equation to that plane and expressing it in Cartesian form yields an
// exact "central force" ODE for the ray's position r(lambda):
//
//   d^2 r_vec / d lambda^2  =  -1.5 * Rs * h^2 * r_vec / |r_vec|^5
//
// where Rs = 2M is the Schwarzschild radius and h = |r_vec x v_vec| is the conserved
// (impact-parameter-like) specific angular momentum of the photon. Because the "force" is
// always parallel to r_vec, h is automatically conserved by the integration (central force =>
// conserved angular momentum), so it only needs to be computed once from the camera ray.
// This reproduces the photon sphere at r = 1.5 Rs, the ~2.6 Rs shadow radius, gravitational
// lensing of the background, and (via multiple disk-plane crossings of a winding ray) the
// secondary/tertiary images of the accretion disk above and below the shadow.
//
// Integration is a velocity-Verlet / leapfrog scheme with an adaptive step that shrinks near
// the horizon for stability and grows far away for performance.

export const raytraceFrag = /* glsl */ `
precision highp float;
precision highp int;

varying vec2 vUv;

uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform float uFovDeg;
uniform float uTime;
uniform float uSeed;

uniform float uMass;
uniform float uDiskInner;
uniform float uDiskOuter;
uniform float uDiskDensity;
uniform float uDiskTemp;
uniform float uDiskTiltDeg;
uniform float uDiskSpeed;

uniform float uDopplerStrength;
uniform float uRedshiftStrength;
uniform float uPhotonRingBoost;

uniform float uTurbSpeed;
uniform float uTurbScale;

uniform float uStarDensity;
uniform float uMilkyWayBrightness;

uniform int uMaxSteps;
uniform float uStepScale;
uniform int uDebugView;

#define PI 3.14159265359
#define MAX_STEPS_CAP 420

// ---------------------------------------------------------------- hashing / noise ----

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.55;
  for (int i = 0; i < 5; i++) {
    s += a * noise3(p);
    p *= 2.03;
    a *= 0.55;
  }
  return s;
}

// Tanner Helland style blackbody approximation, kelvin -> linear RGB (0..1)
vec3 blackbody(float kelvin) {
  float t = clamp(kelvin, 1000.0, 40000.0) / 100.0;
  float r, g, b;
  if (t <= 66.0) {
    r = 255.0;
  } else {
    r = 329.698727446 * pow(t - 60.0, -0.1332047592);
  }
  if (t <= 66.0) {
    g = 99.4708025861 * log(t) - 161.1195681661;
  } else {
    g = 288.1221695283 * pow(t - 60.0, -0.0755148492);
  }
  if (t >= 66.0) {
    b = 255.0;
  } else if (t <= 19.0) {
    b = 0.0;
  } else {
    b = 138.5177312231 * log(t - 10.0) - 305.0447927307;
  }
  return clamp(vec3(r, g, b) / 255.0, 0.0, 1.0);
}

// simple cosine palette for false-color debug views (IQ style)
vec3 falseColor(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 a = vec3(0.5), b = vec3(0.5), c = vec3(1.0), d = vec3(0.0, 0.15, 0.35);
  return a + b * cos(2.0 * PI * (c * t + d));
}

// ---------------------------------------------------------------- disk frame ----

vec3 toDiskFrame(vec3 p, float tiltRad) {
  float c = cos(tiltRad), s = sin(tiltRad);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}
vec3 fromDiskFrame(vec3 p, float tiltRad) {
  float c = cos(tiltRad), s = sin(tiltRad);
  return vec3(p.x, c * p.y + s * p.z, -s * p.y + c * p.z);
}

// ---------------------------------------------------------------- background ----

vec3 sampleBackground(vec3 d) {
  d = normalize(d);
  float theta = acos(clamp(d.y, -1.0, 1.0));
  float phi = atan(d.z, d.x);
  vec2 uv = vec2(phi / (2.0 * PI) + 0.5, theta / PI);

  vec3 galNormal = normalize(vec3(0.35, 0.82, -0.26));
  float galLat = asin(clamp(dot(d, galNormal), -1.0, 1.0));
  float band = exp(-pow(galLat / 0.22, 2.0));
  vec3 cloudP = d * 3.2 + vec3(11.3, 4.7, 8.1);
  float cloud = fbm(cloudP) * 0.7 + 0.3 * fbm(cloudP * 2.7 + 5.0);
  float dust = smoothstep(0.15, 0.85, cloud);
  vec3 milkyCol = mix(vec3(0.45, 0.55, 0.9), vec3(0.95, 0.75, 0.55), dust * 0.6);
  vec3 milky = milkyCol * band * dust * 0.9 * uMilkyWayBrightness;

  vec3 stars = vec3(0.0);
  for (int layer = 0; layer < 3; layer++) {
    float freq = 60.0 + float(layer) * 55.0;
    vec3 cell = floor(d * freq + uSeed * 7.0 + float(layer) * 91.7);
    vec3 h = hash33(cell);
    float thresh = mix(0.9975, 0.986, uStarDensity * (0.4 + 0.3 * float(layer)));
    if (h.x > thresh) {
      float br = smoothstep(thresh, 1.0, h.x);
      float tw = 0.85 + 0.15 * sin(uTime * (1.0 + h.y * 3.0) + h.z * 62.0);
      vec3 starColor = blackbody(3500.0 + h.y * 22000.0);
      stars += starColor * br * br * (2.2 - float(layer) * 0.5) * tw * uStarDensity;
    }
  }

  float vignetteDeep = 0.02;
  return milky + stars + vec3(vignetteDeep) * 0.02;
}

// ---------------------------------------------------------------- disk shading ----

void shadeDiskCrossing(vec3 pcDisk, vec3 dir, float RS, float tiltRad,
                        inout vec3 accumColor, inout float accumAlpha,
                        inout float lastDoppler, inout float lastGGrav) {
  float rD = length(pcDisk.xz);
  float inner = uDiskInner * RS;
  float outer = uDiskOuter * RS;
  if (rD < inner || rD > outer) return;

  float phi = atan(pcDisk.z, pcDisk.x);

  float edgeIn = smoothstep(inner, inner * 1.18, rD);
  float edgeOut = 1.0 - smoothstep(outer * 0.72, outer, rD);
  float radial = edgeIn * edgeOut;
  if (radial <= 0.001) return;

  float omega = uDiskSpeed * pow(inner / max(rD, inner * 0.3), 1.5);
  vec2 swirl = vec2(cos(phi), sin(phi)) * (rD / inner);
  vec3 turbP = vec3(swirl * uTurbScale * 0.6, phi * 0.8 - uTime * omega * uTurbSpeed * 0.35 + uTime * uTurbSpeed * 0.05);
  float n = fbm(turbP);
  n = 0.5 + 0.85 * n;

  float falloff = pow(inner / max(rD, inner * 0.3), 1.35);
  float density = clamp(uDiskDensity * radial * n * (0.35 + 0.85 * falloff), 0.0, 1.0);
  if (density <= 0.004) return;

  float beta = clamp(sqrt(0.5 * RS / max(rD, inner * 0.5)), 0.0, 0.965);
  float gamma = 1.0 / sqrt(max(1.0 - beta * beta, 1e-5));

  vec3 tangentDisk = vec3(-sin(phi), 0.0, cos(phi));
  vec3 velWorld = fromDiskFrame(tangentDisk, tiltRad) * beta;

  float dopplerRaw = 1.0 / max(gamma * (1.0 - dot(velWorld, dir)), 1e-3);
  float doppler = mix(1.0, dopplerRaw, uDopplerStrength);

  float gGravRaw = sqrt(clamp(1.0 - RS / max(rD, RS * 1.001), 1e-4, 1.0));
  float gGrav = mix(1.0, gGravRaw, uRedshiftStrength);

  float gTotal = gGrav * doppler;
  lastDoppler = doppler;
  lastGGrav = gGrav;

  float temp = uDiskTemp * pow(inner / max(rD, inner * 0.3), 0.75) * clamp(gTotal, 0.2, 3.5);
  vec3 base = blackbody(temp);

  float intensity = density * pow(clamp(gTotal, 0.05, 6.0), 3.0) * 2.4;
  vec3 col = base * intensity;
  float alpha = clamp(density * 0.82, 0.0, 0.92);

  accumColor += (1.0 - accumAlpha) * col * alpha;
  accumAlpha += (1.0 - accumAlpha) * alpha;
}

// ---------------------------------------------------------------- main ----

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  ndc.x *= aspect;
  float tanF = tan(radians(uFovDeg) * 0.5);

  vec3 rd = normalize(uCamForward + ndc.x * tanF * uCamRight + ndc.y * tanF * uCamUp);

  float RS = max(uMass, 1e-4);
  float tiltRad = radians(uDiskTiltDeg);

  vec3 pos = uCamPos;
  vec3 dir = rd;
  vec3 dir0 = dir;
  vec3 hvec = cross(pos, dir);
  float h2 = dot(hvec, hvec);

  vec3 accumColor = vec3(0.0);
  float accumAlpha = 0.0;
  bool hitHorizon = false;
  bool escaped = false;
  float minR = length(pos);
  int stepsTaken = 0;
  float lastDoppler = 1.0;
  float lastGGrav = 1.0;

  for (int i = 0; i < MAX_STEPS_CAP; i++) {
    if (i >= uMaxSteps) break;
    float r2 = max(dot(pos, pos), 1e-6);
    float r = sqrt(r2);
    minR = min(minR, r);
    float dt = clamp(r * 0.045, 0.006, 0.42) * uStepScale;

    vec3 acc = -1.5 * RS * h2 * pos / pow(r2, 2.5);
    vec3 dirHalf = dir + acc * dt * 0.5;
    vec3 newPos = pos + dirHalf * dt;
    float r2New = max(dot(newPos, newPos), 1e-6);
    vec3 accNew = -1.5 * RS * h2 * newPos / pow(r2New, 2.5);
    vec3 newDir = dirHalf + accNew * dt * 0.5;

    if (accumAlpha < 0.985) {
      vec3 pDisk0 = toDiskFrame(pos, tiltRad);
      vec3 pDisk1 = toDiskFrame(newPos, tiltRad);
      if ((pDisk0.y > 0.0) != (pDisk1.y > 0.0)) {
        float t = pDisk0.y / (pDisk0.y - pDisk1.y + 1e-9);
        vec3 pcDisk = mix(pDisk0, pDisk1, clamp(t, 0.0, 1.0));
        shadeDiskCrossing(pcDisk, normalize(newDir), RS, tiltRad, accumColor, accumAlpha, lastDoppler, lastGGrav);
      }
    }

    pos = newPos;
    dir = newDir;
    stepsTaken++;

    if (r < RS * 1.02) { hitHorizon = true; break; }
    if (r > 60.0 * RS && dot(pos, dir) > 0.0) { escaped = true; break; }
  }

  vec3 finalDir = normalize(dir);
  vec3 bg = hitHorizon ? vec3(0.0) : sampleBackground(finalDir);

  float photonRing = 0.0;
  if (!hitHorizon) {
    photonRing = uPhotonRingBoost * smoothstep(RS * 1.9, RS * 1.5, minR) * (1.0 - accumAlpha);
  }

  vec3 color = bg * (1.0 - accumAlpha) + accumColor;
  color += vec3(1.0, 0.85, 0.65) * photonRing * 0.9;

  // ---------------- debug views ----------------
  if (uDebugView == 1) {
    // raw radiance, identical buffer to final composite input (post pass skips FX for mode 1)
    gl_FragColor = vec4(color, 1.0);
    return;
  }
  if (uDebugView == 2) {
    gl_FragColor = vec4(accumColor, 1.0);
    return;
  }
  if (uDebugView == 3) {
    gl_FragColor = vec4(hitHorizon ? vec3(0.0) : bg, 1.0);
    return;
  }
  if (uDebugView == 4) {
    float t = clamp((lastDoppler - 0.3) / 2.2, 0.0, 1.0);
    gl_FragColor = vec4(accumAlpha > 0.01 ? falseColor(t) : vec3(0.0), 1.0);
    return;
  }
  if (uDebugView == 5) {
    float t = clamp(lastGGrav, 0.0, 1.0);
    gl_FragColor = vec4(accumAlpha > 0.01 ? falseColor(t) : vec3(0.0), 1.0);
    return;
  }
  if (uDebugView == 6) {
    float t = float(stepsTaken) / float(uMaxSteps);
    gl_FragColor = vec4(falseColor(t), 1.0);
    return;
  }
  if (uDebugView == 7) {
    float ang = acos(clamp(dot(dir0, finalDir), -1.0, 1.0));
    float t = clamp(ang / PI, 0.0, 1.0);
    gl_FragColor = vec4(falseColor(t), 1.0);
    return;
  }
  if (uDebugView == 8) {
    float t = 1.0 - clamp((minR - RS) / (RS * 2.0), 0.0, 1.0);
    gl_FragColor = vec4(falseColor(t), 1.0);
    return;
  }

  // mode 0 (and fallback): full physical HDR radiance, post pass applies bloom/tonemap/fx
  gl_FragColor = vec4(color, 1.0);
}
`;
