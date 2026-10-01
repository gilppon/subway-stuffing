import type { Sfx } from "./types";

export class SubwayAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;
  private lastSlap = 0;

  ensure() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.42;
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.45);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.master = master;
      this.noise = buf;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.02);
    }
  }

  play(name: Sfx) {
    if (this.muted) return;
    const ctx = this.ctx ?? this.ensure();
    if (!this.master) return;
    const now = ctx.currentTime;
    if (name === "slap") {
      if (now - this.lastSlap < 0.07) return;
      this.lastSlap = now;
    }
    switch (name) {
      case "launch":
        this.noiseBurst(900, 0.16, 0.16, "highpass");
        this.tone(220, 520, 0.14, "sawtooth", 0.05);
        break;
      case "slap":
        this.noiseBurst(480, 0.09, 0.2, "bandpass");
        this.tone(160, 70, 0.12, "sine", 0.12);
        break;
      case "slam":
        this.noiseBurst(180, 0.32, 0.34, "lowpass");
        this.tone(90, 48, 0.28, "sine", 0.2);
        this.tone(180, 70, 0.18, "triangle", 0.06);
        break;
      case "beep":
        this.tone(880, 880, 0.07, "square", 0.05);
        break;
      case "warn":
        this.tone(740, 740, 0.08, "square", 0.06);
        this.tone(740, 740, 0.08, "square", 0.06, 0.12);
        break;
      case "coin":
        this.tone(880, 880, 0.08, "sine", 0.07);
        this.tone(1320, 1320, 0.12, "sine", 0.06, 0.07);
        break;
      case "zip":
        this.tone(520, 980, 0.09, "square", 0.05);
        this.tone(1400, 700, 0.08, "triangle", 0.04, 0.05);
        break;
      case "burst":
        this.noiseBurst(360, 0.4, 0.28, "lowpass");
        this.tone(200, 60, 0.3, "sawtooth", 0.06);
        break;
      case "yeet":
        this.tone(640, 180, 0.28, "sine", 0.08);
        break;
      case "ui":
        this.tone(660, 880, 0.05, "sine", 0.04);
        break;
      case "chime":
        this.tone(523, 523, 0.16, "sine", 0.06);
        this.tone(659, 659, 0.16, "sine", 0.05, 0.12);
        this.tone(784, 784, 0.22, "sine", 0.05, 0.24);
        break;
      case "fanfare":
        this.tone(523, 523, 0.14, "triangle", 0.07);
        this.tone(659, 659, 0.14, "triangle", 0.06, 0.1);
        this.tone(784, 784, 0.14, "triangle", 0.06, 0.2);
        this.tone(1046, 1046, 0.28, "triangle", 0.06, 0.3);
        break;
      case "fail":
        this.tone(220, 140, 0.28, "triangle", 0.07);
        this.tone(164, 98, 0.36, "sine", 0.06, 0.16);
        break;
    }
  }

  private tone(
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    delay = 0,
  ) {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(freq: number, dur: number, peak: number, kind: BiquadFilterType) {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = kind;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur);
  }
}

export const audio = new SubwayAudio();
