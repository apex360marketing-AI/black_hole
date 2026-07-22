import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { fullscreenVert } from "./shaders/vert.js";
import { raytraceFrag } from "./shaders/raytrace.js";
import { brightPassFrag, blurFrag, copyWeightedFrag, compositeFrag } from "./shaders/post.js";
import { PARAM_DEFS, defaultParams, loadParams, saveParams, applyURLOverrides } from "./params.js";
import { CAMERA_PRESETS, cinematicPath } from "./presets.js";
import { initUI } from "./ui.js";
import { updateHUD } from "./hud.js";
import { AudioEngine } from "./audio.js";

// ---------------------------------------------------------------- constants ----

const QUALITY_PROFILES = {
  low: { pixelRatioCap: 1.0, resScale: 0.62, maxSteps: 70, mips: 3, blurPasses: 1 },
  medium: { pixelRatioCap: 1.5, resScale: 0.88, maxSteps: 150, mips: 4, blurPasses: 1 },
  high: { pixelRatioCap: Math.min(window.devicePixelRatio || 1, 2.5), resScale: 1.0, maxSteps: 260, mips: 5, blurPasses: 2 },
};

const usp = new URLSearchParams(location.search);
const SCREENSHOT_MODE = usp.get("screenshot") === "1";

// ---------------------------------------------------------------- state ----

const params = applyURLOverrides(loadParams());
let quality = (localStorage.getItem("gargantua:quality") || "medium");
if (!QUALITY_PROFILES[quality]) quality = "medium";
if (usp.has("quality") && QUALITY_PROFILES[usp.get("quality")]) quality = usp.get("quality");

let debugView = parseInt(localStorage.getItem("gargantua:debug") || "0", 10) || 0;
if (usp.has("debug")) debugView = Math.max(0, Math.min(9, parseInt(usp.get("debug"), 10) || 0));

let hudVisible = localStorage.getItem("gargantua:hud") !== "0";
let paused = false;
let cinematicActive = false;
let activePreset = 0;
let simTime = SCREENSHOT_MODE ? parseFloat(usp.get("t") || "0") : 0;
let frameCount = 0;
const seed = parseFloat(usp.get("seed") || "1337.0");

// ---------------------------------------------------------------- renderer ----

const canvas = document.getElementById("glcanvas");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
} catch (e) {
  showWebglError(e && e.message);
}
if (renderer && !renderer.getContext()) {
  showWebglError("No WebGL context returned.");
  renderer = null;
}

canvas.addEventListener("webglcontextcreationerror", (e) => showWebglError(e.statusMessage));

function showWebglError(msg) {
  const errEl = document.getElementById("webgl-error");
  const loadingEl = document.getElementById("loading");
  if (msg) document.getElementById("webgl-error-msg").textContent = msg;
  errEl.hidden = false;
  loadingEl.classList.add("hidden");
}

if (renderer) {
  boot();
}

function boot() {
  // Note: renderer.outputColorSpace intentionally left at its default. It only affects materials
  // that use three's built-in shader templating (which injects a colorspace-conversion chunk);
  // our raw ShaderMaterial passes write gl_FragColor directly, so sRGB encoding is done by hand
  // at the end of the composite shader instead.
  // every pass in this pipeline is an opaque fullscreen quad that overwrites 100% of pixels,
  // except the additive bloom accumulation which clears explicitly before its loop — so a
  // global autoClear is unnecessary and would otherwise wipe the additive accumulation each draw.
  renderer.autoClear = false;

  // ---------------------------------------------------------------- orbit rig ----

  const orbitCam = new THREE.PerspectiveCamera(params.fov, 1, 0.01, 1000);
  const controls = new OrbitControls(orbitCam, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 0.15;
  controls.maxDistance = 400;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.6;

  function sphericalToCam(radius, theta, phi) {
    theta = THREE.MathUtils.clamp(theta, 0.02, Math.PI - 0.02);
    const x = radius * Math.sin(theta) * Math.cos(phi);
    const y = radius * Math.cos(theta);
    const z = radius * Math.sin(theta) * Math.sin(phi);
    orbitCam.position.set(x, y, z);
    orbitCam.lookAt(0, 0, 0);
  }

  // preset tween state
  let tween = null; // { from:{radius,theta,phi}, to:{...}, t0, dur }
  function currentSpherical() {
    const p = orbitCam.position;
    const radius = p.length() || 0.001;
    const theta = Math.acos(THREE.MathUtils.clamp(p.y / radius, -1, 1));
    const phi = Math.atan2(p.z, p.x);
    return { radius, theta, phi };
  }
  function goToPreset(idx, instant) {
    const preset = CAMERA_PRESETS[idx];
    if (!preset) return;
    params.fov = preset.fov;
    ui.refreshAll();
    saveParamsDebounced();
    if (instant) {
      sphericalToCam(preset.radius, preset.theta, preset.phi);
      controls.update();
      return;
    }
    tween = { from: currentSpherical(), to: preset, t0: performance.now(), dur: 1100 };
    controls.enabled = false;
  }

  sphericalToCam(CAMERA_PRESETS[0].radius, CAMERA_PRESETS[0].theta, CAMERA_PRESETS[0].phi);
  controls.update();

  // ---------------------------------------------------------------- render targets / pipeline ----

  const geometry = new THREE.PlaneGeometry(2, 2);
  const fsScene = new THREE.Scene();
  const fsMesh = new THREE.Mesh(geometry, null);
  fsScene.add(fsMesh);
  const fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function makeRT(w, h) {
    return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });
  }

  const raytraceMat = new THREE.ShaderMaterial({
    vertexShader: fullscreenVert,
    fragmentShader: raytraceFrag,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uCamPos: { value: new THREE.Vector3() },
      uCamRight: { value: new THREE.Vector3(1, 0, 0) },
      uCamUp: { value: new THREE.Vector3(0, 1, 0) },
      uCamForward: { value: new THREE.Vector3(0, 0, -1) },
      uFovDeg: { value: params.fov },
      uTime: { value: 0 },
      uSeed: { value: seed },
      uMass: { value: params.mass },
      uDiskInner: { value: params.diskInner },
      uDiskOuter: { value: params.diskOuter },
      uDiskDensity: { value: params.diskDensity },
      uDiskTemp: { value: params.diskTemp },
      uDiskTiltDeg: { value: params.diskTilt },
      uDiskSpeed: { value: params.diskSpeed },
      uDopplerStrength: { value: params.dopplerStrength },
      uRedshiftStrength: { value: params.redshiftStrength },
      uPhotonRingBoost: { value: params.photonRingBoost },
      uTurbSpeed: { value: params.turbSpeed },
      uTurbScale: { value: params.turbScale },
      uStarDensity: { value: params.starDensity },
      uMilkyWayBrightness: { value: params.milkyWay },
      uMaxSteps: { value: QUALITY_PROFILES[quality].maxSteps },
      uStepScale: { value: 1.0 },
      uDebugView: { value: debugView },
    },
  });

  const brightMat = new THREE.ShaderMaterial({
    vertexShader: fullscreenVert, fragmentShader: brightPassFrag, depthTest: false, depthWrite: false,
    uniforms: { tScene: { value: null }, uThreshold: { value: params.bloomThreshold } },
  });

  const blurMat = new THREE.ShaderMaterial({
    vertexShader: fullscreenVert, fragmentShader: blurFrag, depthTest: false, depthWrite: false,
    uniforms: { tInput: { value: null }, uTexelSize: { value: new THREE.Vector2() }, uDirection: { value: new THREE.Vector2(1, 0) } },
  });

  const copyMat = new THREE.ShaderMaterial({
    vertexShader: fullscreenVert, fragmentShader: copyWeightedFrag, depthTest: false, depthWrite: false,
    uniforms: { tInput: { value: null }, uWeight: { value: 1.0 } },
  });
  const addMat = copyMat.clone();
  addMat.transparent = true;
  addMat.blending = THREE.AdditiveBlending;
  addMat.depthTest = false;
  addMat.depthWrite = false;

  const compositeMat = new THREE.ShaderMaterial({
    vertexShader: fullscreenVert, fragmentShader: compositeFrag, depthTest: false, depthWrite: false,
    uniforms: {
      tScene: { value: null },
      tBloom: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uExposure: { value: params.exposure },
      uBloomStrength: { value: params.bloomStrength },
      uVignette: { value: params.vignette },
      uGrain: { value: params.grain },
      uChromaticAberration: { value: params.chromaticAberration },
      uFrame: { value: 0 },
      uDebugView: { value: debugView },
    },
  });

  let sceneRT, brightRT, mipRTs = [], mipPingRTs = [], bloomRT;

  function buildTargets(internalW, internalH) {
    [sceneRT, brightRT, bloomRT, ...mipRTs, ...mipPingRTs].forEach((rt) => rt && rt.dispose());
    sceneRT = makeRT(internalW, internalH);
    const bw = Math.max(1, internalW >> 1), bh = Math.max(1, internalH >> 1);
    brightRT = makeRT(bw, bh);
    bloomRT = makeRT(bw, bh);
    mipRTs = []; mipPingRTs = [];
    const q = QUALITY_PROFILES[quality];
    let w = bw, h = bh;
    for (let i = 0; i < q.mips; i++) {
      mipRTs.push(makeRT(w, h));
      mipPingRTs.push(makeRT(w, h));
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }
  }

  function renderPass(material, target) {
    fsMesh.material = material;
    renderer.setRenderTarget(target);
    renderer.render(fsScene, fsCamera);
  }

  // ---------------------------------------------------------------- sizing ----

  let internalW = 1, internalH = 1, displayW = 1, displayH = 1;

  function resize() {
    const q = QUALITY_PROFILES[quality];
    if (SCREENSHOT_MODE && usp.has("w") && usp.has("h")) {
      displayW = parseInt(usp.get("w"), 10) || 1280;
      displayH = parseInt(usp.get("h"), 10) || 720;
      renderer.setPixelRatio(1);
      renderer.setSize(displayW, displayH, true);
    } else {
      displayW = window.innerWidth;
      displayH = window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatioCap));
      renderer.setSize(displayW, displayH, true);
    }
    const size = new THREE.Vector2();
    renderer.getDrawingBufferSize(size);
    internalW = Math.max(1, Math.round(size.x * q.resScale));
    internalH = Math.max(1, Math.round(size.y * q.resScale));
    buildTargets(internalW, internalH);
    raytraceMat.uniforms.uResolution.value.set(internalW, internalH);
    compositeMat.uniforms.uResolution.value.set(size.x, size.y);
    orbitCam.aspect = displayW / displayH;
    orbitCam.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  resize();

  // ---------------------------------------------------------------- context loss recovery ----

  let contextLost = false;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    contextLost = true;
    document.getElementById("loading").classList.remove("hidden");
    document.querySelector(".loading-text").textContent = "RECONNECTING SPACETIME...";
  });
  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = false;
    resize();
    document.getElementById("loading").classList.add("hidden");
  });

  // ---------------------------------------------------------------- param -> uniform sync ----

  const UNIFORM_BY_ID = {};
  for (const def of PARAM_DEFS) UNIFORM_BY_ID[def.id] = def.uniform;

  function pushParamToUniform(id, value) {
    switch (id) {
      case "fov": raytraceMat.uniforms.uFovDeg.value = value; orbitCam.fov = value; orbitCam.updateProjectionMatrix(); break;
      case "exposure": compositeMat.uniforms.uExposure.value = value; break;
      case "bloomStrength": compositeMat.uniforms.uBloomStrength.value = value; break;
      case "bloomThreshold": brightMat.uniforms.uThreshold.value = value; break;
      case "vignette": compositeMat.uniforms.uVignette.value = value; break;
      case "grain": compositeMat.uniforms.uGrain.value = value; break;
      case "chromaticAberration": compositeMat.uniforms.uChromaticAberration.value = value; break;
      default: {
        const u = UNIFORM_BY_ID[id];
        if (u && raytraceMat.uniforms[u]) raytraceMat.uniforms[u].value = value;
      }
    }
  }
  for (const def of PARAM_DEFS) pushParamToUniform(def.id, params[def.id]);

  let saveTimer = null;
  function saveParamsDebounced() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveParams(params), 250);
  }

  // ---------------------------------------------------------------- audio ----

  const audio = new AudioEngine();
  let audioEnabled = false;

  // ---------------------------------------------------------------- UI wiring ----

  const ui = initUI(params, {
    onParamChange: (id, v) => { pushParamToUniform(id, v); saveParamsDebounced(); },
    onReset: () => {
      const d = defaultParams();
      Object.assign(params, d);
      for (const def of PARAM_DEFS) pushParamToUniform(def.id, params[def.id]);
      orbitCam.fov = params.fov; orbitCam.updateProjectionMatrix();
      saveParams(params);
    },
    onRandomize: () => {
      params.diskTemp = 4000 + Math.random() * 22000;
      params.diskTilt = (Math.random() * 2 - 1) * 60;
      params.turbScale = 0.8 + Math.random() * 4;
      params.turbSpeed = 0.3 + Math.random() * 2;
      params.diskDensity = 0.5 + Math.random() * 1.2;
      params.dopplerStrength = 0.5 + Math.random() * 1.5;
      for (const id of ["diskTemp", "diskTilt", "turbScale", "turbSpeed", "diskDensity", "dopplerStrength"]) {
        pushParamToUniform(id, params[id]);
      }
      saveParams(params);
    },
    onScreenshot: () => takeScreenshot(),
    onPreset: (idx) => { activePreset = idx; cinematicActive = false; ui.setCinematicActive(false); goToPreset(idx, false); },
    onCinematicToggle: (on) => { cinematicActive = on; controls.enabled = !on; },
    onQuality: (q) => { quality = q; localStorage.setItem("gargantua:quality", q); raytraceMat.uniforms.uMaxSteps.value = QUALITY_PROFILES[q].maxSteps; resize(); },
    onAudioToggle: (on) => { audioEnabled = on; audio.setEnabled(on); },
    onHudToggle: () => { hudVisible = !hudVisible; ui.setHudVisible(hudVisible); localStorage.setItem("gargantua:hud", hudVisible ? "1" : "0"); },
    onFullscreenToggle: () => toggleFullscreen(),
    onDebugView: (n) => { debugView = n; raytraceMat.uniforms.uDebugView.value = n; compositeMat.uniforms.uDebugView.value = n; localStorage.setItem("gargantua:debug", String(n)); },
  });
  ui.setQualityActive(quality);
  ui.setHudVisible(hudVisible);
  ui.setDebugActive(debugView);
  ui.setPresetActive(0);

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function takeScreenshot() {
    renderer.domElement.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `gargantua_${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  }

  // ---------------------------------------------------------------- hotkeys ----

  window.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    const k = e.key;
    if (k >= "0" && k <= "9") {
      const n = parseInt(k, 10);
      if (e.shiftKey && n >= 1 && n <= 4) {
        activePreset = n - 1; cinematicActive = false; ui.setCinematicActive(false);
        ui.setPresetActive(activePreset); goToPreset(activePreset, false);
      } else {
        debugView = n; raytraceMat.uniforms.uDebugView.value = n; compositeMat.uniforms.uDebugView.value = n;
        ui.setDebugActive(n); localStorage.setItem("gargantua:debug", String(n));
      }
      return;
    }
    switch (k.toLowerCase()) {
      case "h": hudVisible = !hudVisible; ui.setHudVisible(hudVisible); localStorage.setItem("gargantua:hud", hudVisible ? "1" : "0"); break;
      case "u": ui.setPanelOpen(!document.getElementById("panel").classList.contains("open")); break;
      case "c": cinematicActive = !cinematicActive; controls.enabled = !cinematicActive; ui.setCinematicActive(cinematicActive); break;
      case " ": paused = !paused; e.preventDefault(); break;
      case "s": takeScreenshot(); break;
      case "r": document.getElementById("reset-btn").click(); break;
      case "m": audioEnabled = !audioEnabled; audio.setEnabled(audioEnabled); ui.setAudioActive(audioEnabled); break;
      case "f": toggleFullscreen(); break;
      case "q": {
        const order = ["low", "medium", "high"];
        const next = order[(order.indexOf(quality) + 1) % order.length];
        quality = next; localStorage.setItem("gargantua:quality", next);
        raytraceMat.uniforms.uMaxSteps.value = QUALITY_PROFILES[next].maxSteps;
        ui.setQualityActive(next); resize();
        break;
      }
    }
  });

  // ---------------------------------------------------------------- screenshot-mode setup ----

  if (SCREENSHOT_MODE) {
    controls.enabled = false;
    cinematicActive = false;
    paused = true;
    if (usp.has("preset")) {
      const idx = Math.max(0, Math.min(3, parseInt(usp.get("preset"), 10) || 0));
      activePreset = idx;
      goToPreset(idx, true);
      ui.setPresetActive(idx);
    }
    ui.setDebugActive(debugView);
  }

  // ---------------------------------------------------------------- main loop ----

  let lastTimestamp = performance.now();
  let lastFrameMs = 0;
  let fps = 60;

  document.getElementById("loading").classList.add("hidden");
  document.getElementById("app").hidden = false;

  function updateCameraUniforms() {
    orbitCam.updateMatrixWorld();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(orbitCam.quaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(orbitCam.quaternion).normalize();
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    raytraceMat.uniforms.uCamPos.value.copy(orbitCam.position);
    raytraceMat.uniforms.uCamForward.value.copy(forward);
    raytraceMat.uniforms.uCamUp.value.copy(up);
    raytraceMat.uniforms.uCamRight.value.copy(right);
  }

  function renderBloom() {
    brightMat.uniforms.tScene.value = sceneRT.texture;
    renderPass(brightMat, brightRT);

    const q = QUALITY_PROFILES[quality];
    let src = brightRT;
    for (let i = 0; i < q.mips; i++) {
      const mip = mipRTs[i], ping = mipPingRTs[i];
      copyMat.uniforms.tInput.value = src.texture;
      copyMat.uniforms.uWeight.value = 1.0;
      renderPass(copyMat, mip);
      for (let b = 0; b < q.blurPasses; b++) {
        blurMat.uniforms.tInput.value = mip.texture;
        blurMat.uniforms.uTexelSize.value.set(1 / mip.width, 1 / mip.height);
        blurMat.uniforms.uDirection.value.set(1, 0);
        renderPass(blurMat, ping);
        blurMat.uniforms.tInput.value = ping.texture;
        blurMat.uniforms.uDirection.value.set(0, 1);
        renderPass(blurMat, mip);
      }
      src = mip;
    }

    renderer.setRenderTarget(bloomRT);
    renderer.clear();
    for (let i = 0; i < q.mips; i++) {
      addMat.uniforms.tInput.value = mipRTs[i].texture;
      addMat.uniforms.uWeight.value = 1.0 / q.mips;
      fsMesh.material = addMat;
      renderer.render(fsScene, fsCamera);
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    if (contextLost || !renderer) return;

    const t0 = performance.now();
    const dt = Math.min((t0 - lastTimestamp) / 1000, 0.05);
    lastTimestamp = t0;

    if (!paused) simTime += dt;

    // preset tween
    if (tween) {
      const el = (performance.now() - tween.t0) / tween.dur;
      const tt = Math.min(1, el);
      const ease = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
      const r = THREE.MathUtils.lerp(tween.from.radius, tween.to.radius, ease);
      const th = THREE.MathUtils.lerp(tween.from.theta, tween.to.theta, ease);
      let dphi = tween.to.phi - tween.from.phi;
      dphi = Math.atan2(Math.sin(dphi), Math.cos(dphi));
      const ph = tween.from.phi + dphi * ease;
      sphericalToCam(r, th, ph);
      if (tt >= 1) { tween = null; controls.enabled = !cinematicActive; }
    } else if (cinematicActive) {
      const c = cinematicPath(simTime);
      sphericalToCam(c.radius, c.theta, c.phi);
    }

    if (!tween && !cinematicActive) controls.update();
    updateCameraUniforms();
    raytraceMat.uniforms.uTime.value = simTime;
    compositeMat.uniforms.uFrame.value = SCREENSHOT_MODE ? 0 : frameCount;

    renderPass(raytraceMat, sceneRT);
    renderBloom();

    compositeMat.uniforms.tScene.value = sceneRT.texture;
    compositeMat.uniforms.tBloom.value = bloomRT.texture;
    fsMesh.material = compositeMat;
    renderer.setRenderTarget(null);
    renderer.render(fsScene, fsCamera);

    frameCount++;
    lastFrameMs = performance.now() - t0;
    fps = fps * 0.9 + (1 / Math.max(dt, 0.0001)) * 0.1;

    if (hudVisible) {
      const rs = params.mass;
      const camDist = orbitCam.position.length();
      const gCenter = camDist > rs ? Math.sqrt(Math.max(0, 1 - rs / camDist)) : 0;
      updateHUD({
        fps, frameMs: lastFrameMs, rs, camDist, camDistRs: camDist / rs, gCenter,
        maxSteps: QUALITY_PROFILES[quality].maxSteps, quality, resW: internalW, resH: internalH,
        debugView, simTime, paused,
      });
    }

    if (audioEnabled) {
      audio.update(orbitCam.position.length() / params.mass, Math.min(1, params.diskDensity / 2));
    }

    if (SCREENSHOT_MODE && frameCount === 4) {
      window.__screenshotReady = true;
      document.title = "GARGANTUA — screenshot ready";
      if (usp.get("download") === "1") takeScreenshot();
    }
  }

  // resume audio context on first user gesture if it was enabled previously (autoplay policies)
  window.addEventListener("pointerdown", () => { if (audioEnabled && audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume(); }, { once: false });

  requestAnimationFrame(frame);
}
