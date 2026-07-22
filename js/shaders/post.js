// Post-processing pipeline: bright-pass extraction, separable gaussian blur (used per mip
// level to build an Unreal-style bloom), a weighted copy/add pass, and a final composite that
// performs exposure, a manual ACES filmic tonemap, vignette, chromatic aberration and film
// grain while preserving deep blacks and fine photon-ring detail.

export const brightPassFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform float uThreshold;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float knee = uThreshold * 0.5 + 0.0001;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 0.0001);
  float contribution = max(soft, br - uThreshold);
  contribution = max(contribution, 0.0);
  vec3 result = c * (contribution / max(br, 0.0001));
  gl_FragColor = vec4(result, 1.0);
}
`;

export const blurFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tInput;
uniform vec2 uTexelSize;
uniform vec2 uDirection;
void main() {
  vec2 uv = vUv;
  vec3 result = texture2D(tInput, uv).rgb * 0.227027;
  vec2 off1 = uDirection * uTexelSize * 1.384615;
  vec2 off2 = uDirection * uTexelSize * 3.230769;
  result += texture2D(tInput, uv + off1).rgb * 0.316216;
  result += texture2D(tInput, uv - off1).rgb * 0.316216;
  result += texture2D(tInput, uv + off2).rgb * 0.070270;
  result += texture2D(tInput, uv - off2).rgb * 0.070270;
  gl_FragColor = vec4(result, 1.0);
}
`;

export const copyWeightedFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tInput;
uniform float uWeight;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb;
  gl_FragColor = vec4(c * uWeight, 1.0);
}
`;

export const compositeFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform vec2 uResolution;
uniform float uExposure;
uniform float uBloomStrength;
uniform float uVignette;
uniform float uGrain;
uniform float uChromaticAberration;
uniform float uFrame;
uniform int uDebugView;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec3 ACESFilm(vec3 x) {
  float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;

  if (uDebugView == 9) {
    vec3 b = texture2D(tBloom, uv).rgb * 1.5;
    gl_FragColor = vec4(clamp(b, 0.0, 1.0), 1.0);
    return;
  }

  if (uDebugView != 0) {
    vec3 c = texture2D(tScene, uv).rgb;
    gl_FragColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(1.0 / 1.8)), 1.0);
    return;
  }

  vec2 center = uv - 0.5;
  float caAmt = uChromaticAberration * 0.0035;
  vec3 base;
  base.r = texture2D(tScene, uv + center * caAmt).r;
  base.g = texture2D(tScene, uv).g;
  base.b = texture2D(tScene, uv - center * caAmt).b;
  base = max(base, 0.0);

  vec3 bloom = texture2D(tBloom, uv).rgb;

  vec3 hdr = base + bloom * uBloomStrength;
  hdr *= uExposure;

  vec3 mapped = ACESFilm(hdr);

  float vig = 1.0 - uVignette * dot(center, center) * 1.7;
  mapped *= clamp(vig, 0.15, 1.0);

  float g = hash13(vec3(gl_FragCoord.xy, uFrame));
  mapped += (g - 0.5) * uGrain * 0.09;

  mapped = clamp(mapped, 0.0, 1.0);
  vec3 outColor = pow(mapped, vec3(1.0 / 2.2));
  gl_FragColor = vec4(outColor, 1.0);
}
`;
