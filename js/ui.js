import { PARAM_DEFS } from "./params.js";

// Builds the control panel from PARAM_DEFS and wires every interactive chrome element
// (panel, presets, quality, audio, hud toggle, debug strip, fullscreen, footer buttons).
export function initUI(params, callbacks) {
  const panelBody = document.getElementById("panel-body");
  const groups = [];
  for (const def of PARAM_DEFS) {
    let g = groups.find((g) => g.name === def.group);
    if (!g) { g = { name: def.group, defs: [] }; groups.push(g); }
    g.defs.push(def);
  }

  const valueEls = {};
  for (const g of groups) {
    const title = document.createElement("div");
    title.className = "param-group-title";
    title.textContent = g.name;
    panelBody.appendChild(title);

    for (const def of g.defs) {
      const row = document.createElement("div");
      row.className = "param-row";

      const top = document.createElement("div");
      top.className = "row-top";
      const label = document.createElement("span");
      label.className = "plabel";
      label.textContent = def.label;
      const val = document.createElement("span");
      val.className = "pval";
      val.textContent = formatVal(params[def.id], def);
      top.appendChild(label);
      top.appendChild(val);
      valueEls[def.id] = val;

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      input.value = String(params[def.id]);
      input.addEventListener("input", () => {
        const v = parseFloat(input.value);
        params[def.id] = v;
        val.textContent = formatVal(v, def);
        callbacks.onParamChange(def.id, v);
      });
      input.dataset.paramId = def.id;

      row.appendChild(top);
      row.appendChild(input);
      panelBody.appendChild(row);
    }
  }

  function refreshAll() {
    for (const def of PARAM_DEFS) {
      const input = panelBody.querySelector(`input[data-param-id="${def.id}"]`);
      if (input) input.value = String(params[def.id]);
      if (valueEls[def.id]) valueEls[def.id].textContent = formatVal(params[def.id], def);
    }
  }

  // ---- panel open/close ----
  const panel = document.getElementById("panel");
  document.getElementById("panel-toggle").addEventListener("click", () => setPanelOpen(!panel.classList.contains("open")));
  document.getElementById("panel-close").addEventListener("click", () => setPanelOpen(false));
  function setPanelOpen(open) { panel.classList.toggle("open", open); }

  // ---- footer buttons ----
  document.getElementById("reset-btn").addEventListener("click", () => { callbacks.onReset(); refreshAll(); });
  document.getElementById("randomize-btn").addEventListener("click", () => { callbacks.onRandomize(); refreshAll(); });
  document.getElementById("screenshot-btn").addEventListener("click", () => callbacks.onScreenshot());

  // ---- presets ----
  const presetBtns = Array.from(document.querySelectorAll(".preset-btn:not(.cinematic)"));
  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.preset, 10);
      setPresetActive(idx);
      setCinematicActive(false);
      callbacks.onPreset(idx);
    });
  });
  function setPresetActive(idx) {
    presetBtns.forEach((b) => b.classList.toggle("active", parseInt(b.dataset.preset, 10) === idx));
  }

  const cineBtn = document.getElementById("cinematic-toggle");
  cineBtn.addEventListener("click", () => {
    const active = !cineBtn.classList.contains("active");
    setCinematicActive(active);
    callbacks.onCinematicToggle(active);
  });
  function setCinematicActive(on) {
    cineBtn.classList.toggle("active", on);
    cineBtn.textContent = on ? "⏸ Cinematic" : "▶ Cinematic";
  }

  // ---- quality ----
  const qBtns = Array.from(document.querySelectorAll(".q-btn"));
  qBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      setQualityActive(btn.dataset.quality);
      callbacks.onQuality(btn.dataset.quality);
    });
  });
  function setQualityActive(q) {
    qBtns.forEach((b) => b.classList.toggle("active", b.dataset.quality === q));
  }

  // ---- audio / hud / fullscreen ----
  const audioBtn = document.getElementById("audio-toggle");
  audioBtn.addEventListener("click", () => {
    const on = !audioBtn.classList.contains("active");
    setAudioActive(on);
    callbacks.onAudioToggle(on);
  });
  function setAudioActive(on) {
    audioBtn.classList.toggle("active", on);
    audioBtn.textContent = on ? "🔊 AUDIO" : "🔇 AUDIO";
  }

  const hudBtn = document.getElementById("hud-toggle");
  hudBtn.addEventListener("click", () => callbacks.onHudToggle());
  function setHudVisible(visible) {
    document.getElementById("hud").classList.toggle("hidden", !visible);
    hudBtn.classList.toggle("active", visible);
  }

  document.getElementById("fullscreen-toggle").addEventListener("click", () => callbacks.onFullscreenToggle());

  // ---- debug strip 0-9 ----
  const debugContainer = document.getElementById("debug-buttons");
  const debugBtns = [];
  for (let i = 0; i <= 9; i++) {
    const b = document.createElement("button");
    b.className = "debug-btn";
    b.textContent = String(i);
    b.title = DEBUG_LABELS[i];
    b.addEventListener("click", () => { setDebugActive(i); callbacks.onDebugView(i); });
    debugContainer.appendChild(b);
    debugBtns.push(b);
  }
  debugBtns[0].classList.add("active");
  function setDebugActive(i) {
    debugBtns.forEach((b, idx) => b.classList.toggle("active", idx === i));
  }

  return {
    refreshAll,
    setPanelOpen,
    setPresetActive,
    setCinematicActive,
    setQualityActive,
    setAudioActive,
    setHudVisible,
    setDebugActive,
  };
}

export const DEBUG_LABELS = [
  "0 · Final composite",
  "1 · Raw HDR radiance",
  "2 · Disk emission only",
  "3 · Starfield / Milky Way only",
  "4 · Doppler factor heatmap",
  "5 · Gravitational redshift heatmap",
  "6 · Integration step-count heatmap",
  "7 · Deflection angle heatmap",
  "8 · Photon-sphere proximity map",
  "9 · Bloom bright-pass buffer",
];

function formatVal(v, def) {
  if (def.id === "diskTemp") return Math.round(v) + "K";
  if (Math.abs(def.step) >= 1) return Math.round(v).toString();
  return v.toFixed(2);
}
