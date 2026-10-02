import type { Sfx } from "./types";

export class SubwayAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;
  /** Separate from the player's own mute: portals require audio off during ads. */
  private adMuted = false;
  private lastSlap = 0;

  ensure() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.muted || this.adMuted ? 0 : 0.42;
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

  private applyGain() {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted || this.adMuted ? 0 : 0.42, this.ctx.currentTime, 0.02);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyGain();
  }

  setAdMuted(m: boolean) {
    this.adMuted = m;
    this.applyGain();
  }

  play(name: Sfx) {
    if (this.muted || this.adMuted) return;
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

  private noiseBurst(freq: number, dur: number, peak: number, kind: BiquadFilterType) {    const ctx = this.ctx;
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
  // ---- Background music: urgent rush-hour pulse, no assets ----
  // Reuses tone(), which already routes through master (muted/adMuted-safe).
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  /** Idempotent. Call from a user gesture; AudioContext requires one. */
  startMusic() {
    this.ensure();
    if (!this.ctx || !this.master) return;
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);
    }
    if (this.musicTimer !== null) return;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => this.musicTick(), 130);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private mtone(f0: number, dur: number, type: OscillatorType, peak: number, delay = 0) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private musicTick() {
    // Never schedule while muted, ad-muted, hidden, or suspended; tails fade.
    // The suspended check matters: startMusic() can run outside a user gesture
    // (e.g. from an unmute effect), and scheduling onto a frozen clock would
    // pile every note onto one timestamp.
    if (this.muted || this.adMuted || document.hidden) return;
    if (!this.ctx || this.ctx.state !== 'running') return;
    const s = this.musicStep++ % 32;
    // Urgent eighth-note pulse in D minor, triangle and low.
    const pulse = [73.42, 73.42, 87.31, 73.42, 65.41, 73.42, 87.31, 98.0,
      73.42, 73.42, 87.31, 73.42, 65.41, 65.41, 58.27, 58.27];
    const p = pulse[s % 16];
    if (p !== undefined) this.mtone(p, 0.12, 'triangle', 0.055);
    // Door-chime motif every two bars: two bright stabs a fifth apart.
    if (s % 16 === 0) {
      this.mtone(880.0, 0.18, 'sine', 0.04);
      this.mtone(1318.5, 0.24, 'sine', 0.035, 0.14);
    }
    // Hurried sixteenth-run filler on the back half of each bar.
    if (s % 16 >= 8 && s % 2 === 1) {
      const run = [293.66, 329.63, 349.23, 392.0, 440.0, 392.0, 349.23, 329.63];
      const f = run[s % 8];
      if (f !== undefined) this.mtone(f, 0.09, 'square', 0.022);
    }
  }
}

export const audio = new SubwayAudio();
