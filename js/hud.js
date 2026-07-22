import { DEBUG_LABELS } from "./ui.js";

const els = {};
function el(id) { return els[id] || (els[id] = document.getElementById(id)); }

export function updateHUD(data) {
  el("hud-fps").textContent = data.fps.toFixed(0);
  el("hud-ms").textContent = data.frameMs.toFixed(2);
  el("hud-rs").textContent = data.rs.toFixed(2) + " u";
  el("hud-dist").textContent = data.camDist.toFixed(2) + " u";
  el("hud-distrs").textContent = data.camDistRs.toFixed(2) + " R_s";
  el("hud-photon").textContent = (1.5 * data.rs).toFixed(2) + " u";
  el("hud-isco").textContent = (3.0 * data.rs).toFixed(2) + " u";
  el("hud-g").textContent = data.gCenter.toFixed(3);
  el("hud-steps").textContent = data.maxSteps.toString();
  el("hud-quality").textContent = data.quality.toUpperCase();
  el("hud-res").textContent = `${data.resW}×${data.resH}`;
  el("hud-debug").textContent = DEBUG_LABELS[data.debugView] || String(data.debugView);
  el("hud-time").textContent = data.simTime.toFixed(1) + "s" + (data.paused ? " ⏸" : "");
}
