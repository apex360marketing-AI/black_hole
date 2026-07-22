// Fully procedural synchronized audio (WebAudio only — no binary assets to keep the project
// dependency-free). A deep drone + filtered noise bed reacts to camera distance (gravitational
// time dilation pitch drop as you approach the horizon) and disk turbulence.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.started = false;
    this.master = null;
  }

  async start() {
    if (this.started) return;
    this.started = true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);

    // low drone: two detuned oscillators through a lowpass filter
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = "lowpass";
    this.droneFilter.frequency.value = 220;
    this.droneFilter.Q.value = 0.7;
    this.droneFilter.connect(this.master);

    this.osc1 = ctx.createOscillator();
    this.osc1.type = "sine";
    this.osc1.frequency.value = 55;
    this.osc2 = ctx.createOscillator();
    this.osc2.type = "sawtooth";
    this.osc2.frequency.value = 55.6;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.5;
    this.osc1.connect(droneGain);
    this.osc2.connect(droneGain);
    droneGain.connect(this.droneFilter);
    this.osc1.start();
    this.osc2.start();

    // filtered noise bed for accretion turbulence
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 6.0;
    }
    this.noise = ctx.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = "bandpass";
    this.noiseFilter.frequency.value = 400;
    this.noiseFilter.Q.value = 0.9;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.35;
    this.noise.connect(this.noiseFilter);
    this.noiseFilter.connect(noiseGain);
    noiseGain.connect(this.master);
    this.noise.start();

    // slow LFO on drone detune for a "breathing" feel
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.07;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 6;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.osc2.detune);
    this.lfo.start();
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.start();
    if (this.master) {
      const target = on ? 0.55 : 0.0;
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.linearRampToValueAtTime(target, now + 0.4);
    }
  }

  // camDistRs: camera distance in units of R_s. diskActivity: 0..1 rough turbulence/brightness proxy.
  update(camDistRs, diskActivity) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const proximity = Math.max(0, 1.0 - Math.min(camDistRs, 30) / 30);
    // gravitational time-dilation-ish pitch drop as the camera nears the horizon
    const baseFreq = 55 * (1.0 - 0.55 * Math.pow(proximity, 1.5));
    this.osc1.frequency.setTargetAtTime(baseFreq, now, 0.5);
    this.osc2.frequency.setTargetAtTime(baseFreq * 1.011, now, 0.5);
    this.droneFilter.frequency.setTargetAtTime(180 + proximity * 900, now, 0.5);
    this.noiseFilter.frequency.setTargetAtTime(250 + diskActivity * 1400, now, 0.3);
  }
}
