import {
  carFriction,
  compressOf,
  delayBonus,
  fareMult,
  PASSENGERS,
  slingSpeed,
  starsFor,
} from "./content";
import type { Mode, PassengerDef, RunResult, Sfx, StationDef, Upgrades } from "./types";

export const L = {
  W: 1280,
  H: 720,
  floor: 604,
  inTop: 164,
  inL: 736,
  inR: 1198,
  shellL: 688,
  shellR: 1246,
  shellTop: 118,
  shellBot: 658,
  forkX: 292,
  restX: 400,
  maxPull: 152,
};

export type Phase =
  | "banner"
  | "countdown"
  | "aim"
  | "closing"
  | "settle"
  | "gap"
  | "opening"
  | "over";

export interface HudSnap {
  phase: Phase;
  timeLeft: number;
  wave: number;
  inside: number;
  weighted: number;
  capacity: number;
  occupancy: number;
  combo: number;
  queueIds: string[];
  currentId: string | null;
  currentName: string;
  boss: boolean;
  zippers: boolean[];
  bossGone: boolean;
  pulling: boolean;
  power: number;
  peak: number;
  spill: boolean;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  invM: number;
  kind: "head" | "chest" | "hip" | "lhand" | "rhand" | "lfoot" | "rfoot" | "prop";
}

interface Link {
  i: number;
  j: number;
  len: number;
}

interface Doll {
  id: number;
  def: PassengerDef;
  nodes: Node[];
  links: Link[];
  launched: boolean;
  yeeted: boolean;
  seated: boolean;
  grace: number;
  bark: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  rot: number;
  vr: number;
  kind: "spark" | "cloth" | "paper" | "sweat";
}

interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  color: string;
}

interface SimOpts {
  mode: Mode;
  station: StationDef;
  upgrades: Upgrades;
  owned: string[];
  reduced: boolean;
  firstRunIntro: boolean;
  onSfx: (s: Sfx) => void;
  onComplete: (r: RunResult) => void;
}

const SEATS = [
  { x: 800, w: 120 },
  { x: 980, w: 120 },
  { x: 1140, w: 50 },
];

let NEXT_ID = 1;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function rollQueue(station: StationDef, count: number) {
  const total = station.pool.reduce((s, p) => s + p.w, 0);
  const out: PassengerDef[] = [];
  for (let i = 0; i < count; i++) {
    let r = Math.random() * total;
    let id = station.pool[0]?.id ?? "suit";
    for (const p of station.pool) {
      r -= p.w;
      if (r <= 0) {
        id = p.id;
        break;
      }
    }
    out.push(PASSENGERS[id] ?? PASSENGERS.suit);
  }
  return out;
}

function pose(def: PassengerDef, chestX: number, chestY: number, lean: number): Node[] {
  const s = def.scale;
  const upX = Math.sin(lean);
  const upY = -Math.cos(lean);
  const rx = Math.cos(lean);
  const ry = Math.sin(lean);
  const at = (ox: number, oy: number) => ({
    x: chestX + rx * ox + upX * oy,
    y: chestY + ry * ox + upY * oy,
  });
  const mass = def.mass;
  const mk = (
    ox: number,
    oy: number,
    r: number,
    m: number,
    kind: Node["kind"],
  ): Node => {
    const p = at(ox, oy);
    return { x: p.x, y: p.y, vx: 0, vy: 0, r: r * s, invM: 1 / (mass * m), kind };
  };
  const nodes = [
    mk(0, 27, 14, 0.75, "head"),
    mk(0, 0, 16.5, 1.45, "chest"),
    mk(0, -28, 13.5, 1.15, "hip"),
    mk(-28, -4, 6.4, 0.32, "lhand"),
    mk(28, -4, 6.4, 0.32, "rhand"),
    mk(-12, -62, 7.4, 0.48, "lfoot"),
    mk(12, -62, 7.4, 0.48, "rfoot"),
  ];
  if (def.extra === "briefcase") nodes.push(mk(46, -8, 11, 0.95, "prop"));
  return nodes;
}

function linkOf(nodes: Node[]): Link[] {
  const dist = (i: number, j: number) => Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y);
  const links: Link[] = [
    { i: 0, j: 1, len: dist(0, 1) },
    { i: 1, j: 2, len: dist(1, 2) },
    { i: 1, j: 3, len: dist(1, 3) },
    { i: 1, j: 4, len: dist(1, 4) },
    { i: 2, j: 5, len: dist(2, 5) },
    { i: 2, j: 6, len: dist(2, 6) },
  ];
  if (nodes.length > 7) links.push({ i: 4, j: 7, len: dist(4, 7) });
  return links;
}

export function chestRestY(def: PassengerDef) {
  return L.floor - 70 * def.scale;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export class SubwaySim {
  dolls: Doll[] = [];
  queue: PassengerDef[] = [];
  current: PassengerDef | null = null;
  particles: Particle[] = [];
  floaters: Floater[] = [];
  phase: Phase = "countdown";
  phaseT = 0.5;
  timeLeft = 6;
  elapsed = 0;
  doorT = 0;
  closeU = 0;
  openU = 0;
  wave = 1;
  peak = 0;
  combo = 0;
  comboMax = 0;
  lastLaunch = -10;
  launches = 0;
  pulling = false;
  dragX = 0;
  dragY = 0;
  pullX = 0;
  pullY = 0;
  shake = 0;
  flash = 0;
  zippers = [true, true, true];
  luggageGone = false;
  secured = new Set<number>();
  paid = new Set<number>();
  revenue = 0;
  spill = false;
  capped = false;
  reported = false;
  hasLaunched = false;
  private introWaitForLaunch: boolean;
  warned2 = false;
  warned1 = false;
  crossed100 = false;
  crossed200 = false;
  slamLock = false;
  reduce: boolean;
  private acc = 0;
  private impactCd = 0;
  private marquee = 0;

  constructor(private opts: SimOpts) {
    this.reduce = opts.reduced;
    this.introWaitForLaunch = opts.firstRunIntro;
    const count = opts.mode === "endless" ? 6 : opts.station.queue;
    this.queue = rollQueue(opts.station, count);
    this.spawnNext();
    this.timeLeft = this.computeTime();
    if (opts.station.boss && opts.mode === "campaign") {
      this.phase = "banner";
      this.phaseT = 2.4;
    } else {
      this.phase = "countdown";
      this.phaseT = 0.48;
    }
  }

  private computeTime() {
    if (this.opts.mode === "endless") {
      return Math.max(1.72, 5.05 - (this.wave - 1) * 0.31) + this.opts.upgrades.delay * 0.1;
    }
    return this.opts.station.time + delayBonus(this.opts.upgrades.delay);
  }

  private spawnNext() {
    this.current = this.queue.shift() ?? null;
  }

  pointerDown(x: number, y: number) {
    if (this.phase === "banner") {
      this.phase = "countdown";
      this.phaseT = 0.28;
      this.opts.onSfx("ui");
      return;
    }
    if (this.phase === "countdown") {
      this.phase = "aim";
      this.warned1 = false;
      this.warned2 = false;
    }
    if (this.phase !== "aim" || !this.current) return;
    this.pulling = true;
    this.dragX = x;
    this.dragY = y;
    this.pullX = 0;
    this.pullY = 0;
  }

  pointerMove(x: number, y: number) {
    if (!this.pulling) return;
    this.setPull(x - this.dragX, y - this.dragY);
  }

  cashOut() {
    if (this.reported || this.opts.mode !== "endless") return;
    this.pulling = false;
    for (const d of this.dolls) {
      if (d.launched && !d.yeeted && this.isInside(d)) {
        if (!this.paid.has(d.id)) {
          this.revenue += Math.round(this.opts.station.fare * d.def.fareWeight * fareMult(this.opts.upgrades.fare));
          this.paid.add(d.id);
        }
        this.secured.add(d.id);
      }
    }
    this.peak = Math.max(this.peak, this.secured.size);
    this.spill = false;
    this.phase = "over";
    this.finishEndless();
  }

  pointerUp() {
    if (!this.pulling) return;
    this.pulling = false;
    const power = Math.hypot(this.pullX, this.pullY) / L.maxPull;
    if (power < 0.12 || !this.current) {
      this.pullX = 0;
      this.pullY = 0;
      return;
    }
    this.launch(power);
  }

  skipFirstRunIntro() {
    this.introWaitForLaunch = false;
  }

  private setPull(dx: number, dy: number) {
    if (dx > -4) {
      this.pullX = 0;
      this.pullY = 0;
      return;
    }
    let x = dx;
    let y = dy;
    let dist = Math.hypot(x, y);
    const max = L.maxPull;
    if (dist > max) {
      x *= max / dist;
      y *= max / dist;
      dist = max;
    }
    const fire = Math.atan2(-y, -x);
    const fmin = -1.15;
    const fmax = 0.62;
    if (fire < fmin || fire > fmax) {
      const c = clamp(fire, fmin, fmax);
      x = -Math.cos(c) * dist;
      y = -Math.sin(c) * dist;
    }
    this.pullX = x;
    this.pullY = y;
  }

  private launch(power: number) {
    const def = this.current;
    if (!def) return;
    const chestX = L.restX + this.pullX;
    const chestY = chestRestY(def) + this.pullY;
    const nodes = pose(def, chestX, chestY, this.pullX * -0.001);
    const speed = (power * slingSpeed(this.opts.upgrades.sling)) / Math.pow(def.mass, 0.42);
    const dist = Math.max(8, Math.hypot(this.pullX, this.pullY));
    const vx = (-this.pullX / dist) * speed;
    const vy = (-this.pullY / dist) * speed;
    const spin = (Math.random() - 0.5) * 2.4;
    const chest = nodes[1];
    for (const n of nodes) {
      const ox = n.x - chest.x;
      const oy = n.y - chest.y;
      n.vx = vx - oy * spin;
      n.vy = vy + ox * spin;
    }
    const doll: Doll = {
      id: NEXT_ID++,
      def,
      nodes,
      links: linkOf(nodes),
      launched: true,
      yeeted: false,
      seated: false,
      grace: 0.18,
      bark: def.bark[Math.floor(Math.random() * def.bark.length)] ?? "Hey!",
    };
    this.dolls.push(doll);
    this.float(chest.x, chest.y - 46, doll.bark, "#f4efe6");
    this.burst(chest.x, chest.y, "#f0c14a", 8, 180);
    this.opts.onSfx("launch");
    this.hasLaunched = true;
    this.introWaitForLaunch = false;
    this.launches++;
    if (this.elapsed - this.lastLaunch < 0.55) this.combo += 1;
    else this.combo = 1;
    this.comboMax = Math.max(this.comboMax, this.combo);
    this.lastLaunch = this.elapsed;
    if (this.combo >= 2) this.float(chest.x, chest.y - 78, `COMBO x${this.combo}`, "#7dffe1");
    this.pullX = 0;
    this.pullY = 0;
    this.spawnNext();
    if (this.opts.mode === "endless" && !this.current && this.queue.length === 0) {
      this.queue.push(...rollQueue(this.opts.station, 4));
      this.spawnNext();
    }
  }

  update(dt: number) {
    if (this.phase === "over") {
      this.decayFx(dt);
      if ((this.spill || this.capped) && !this.reported) {
        this.phaseT -= dt;
        if (this.phaseT <= 0) this.finishEndless();
      }
      return;
    }
    this.elapsed += dt;
    this.marquee += dt;
    this.impactCd = Math.max(0, this.impactCd - dt);
    this.acc += dt;
    const step = 1 / 120;
    let guard = 0;
    while (this.acc >= step && guard < 8) {
      this.step(step);
      this.acc -= step;
      guard++;
    }
    this.decayFx(dt);
    this.advancePhase(dt);
  }

  private decayFx(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 28);
    this.flash = Math.max(0, this.flash - dt * 1.8);
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0).slice(-180);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= 28 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0).slice(-24);
  }

  private advancePhase(dt: number) {
    if (this.phase === "banner" || this.phase === "countdown") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        if (this.phase === "banner") {
          this.phase = "countdown";
          this.phaseT = 0.36;
        } else {
          this.phase = "aim";
          this.warned1 = false;
          this.warned2 = false;
          this.opts.onSfx("chime");
        }
      }
      return;
    }
    if (this.phase === "aim") {
      if (this.introWaitForLaunch && !this.hasLaunched) return;
      this.timeLeft -= dt;
      if (!this.warned2 && this.timeLeft <= 2) {
        this.warned2 = true;
        this.opts.onSfx("warn");
      }
      if (!this.warned1 && this.timeLeft <= 1) {
        this.warned1 = true;
        this.opts.onSfx("beep");
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.phase = "closing";
        this.closeU = 0;
        this.slamLock = false;
        this.pulling = false;
        this.opts.onSfx("warn");
      }
      if (this.opts.mode === "endless") this.checkSpill();
      this.checkZippers();
      this.checkMilestones();
      return;
    }
    if (this.phase === "closing") {
      this.closeU += dt / 0.34;
      const u = clamp(this.closeU, 0, 1);
      this.doorT = u * u * u;
      this.checkZippers();
      if (u >= 1 && !this.slamLock) this.onSlam();
      return;
    }
    if (this.phase === "settle") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.finishCampaign();
      return;
    }
    if (this.phase === "gap") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.phase = "opening";
        this.openU = 0;
      }
      return;
    }
    if (this.phase === "opening") {
      this.openU += dt / 0.26;
      this.doorT = 1 - clamp(this.openU, 0, 1);
      if (this.openU >= 1) {
        this.doorT = 0;
        this.phase = "aim";
        this.timeLeft = this.computeTime();
        this.warned1 = false;
        this.warned2 = false;
        this.float(L.W / 2, 210, `WAVE ${this.wave}`, "#f0c14a");
        this.opts.onSfx("chime");
        if (!this.current) {
          this.queue.push(...rollQueue(this.opts.station, 5));
          this.spawnNext();
        }
      }
    }
  }

  private onSlam() {
    this.slamLock = true;
    this.doorT = 1;
    if (!this.reduce) this.shake = 18;
    this.flash = 0.7;
    this.opts.onSfx("slam");
    this.float(L.shellL + 20, 250, "CLANG", "#ffb15a");
    for (const d of this.dolls) {
      if (!d.launched || d.yeeted) continue;
      if (this.isInside(d)) {
        for (const n of d.nodes) {
          n.vx += (Math.random() - 0.5) * 90;
          n.vy -= 50;
        }
      }
    }
    if (this.opts.mode === "endless") {
      for (const id of this.secured) {
        const d = this.dolls.find((x) => x.id === id);
        if (!d || d.yeeted || !this.isInside(d)) {
          this.triggerSpill(d);
          return;
        }
      }
      for (const d of this.dolls) {
        if (d.launched && !d.yeeted && this.isInside(d)) {
          if (!this.paid.has(d.id)) {
            this.revenue += Math.round(this.opts.station.fare * d.def.fareWeight * fareMult(this.opts.upgrades.fare));
            this.paid.add(d.id);
          }
          this.secured.add(d.id);
        }
      }
      this.peak = Math.max(this.peak, this.secured.size);
      if (this.secured.size >= 40) {
        this.capped = true;
        this.phase = "over";
        this.phaseT = 0.75;
        this.float(640, 280, "TRAIN SURRENDERED", "#f0c14a");
        return;
      }
      this.wave += 1;
      this.queue.push(...rollQueue(this.opts.station, 5));
      if (!this.current) this.spawnNext();
      this.phase = "gap";
      this.phaseT = 0.62;
      return;
    }
    this.phase = "settle";
    this.phaseT = 0.72;
    const tally = this.tally();
    this.float(900, 230, `${tally.weighted} / ${this.opts.station.capacity * 2}`, "#f0c14a");
  }

  private checkSpill() {
    for (const id of this.secured) {
      const d = this.dolls.find((x) => x.id === id);
      if (!d || d.yeeted) {
        this.triggerSpill(d);
        return;
      }
      const c = d.nodes[1];
      if (c.x < L.shellL - 18 && c.y > this.opts.station.doorTop) {
        this.triggerSpill(d);
        return;
      }
    }
  }

  private triggerSpill(d?: Doll) {
    if (this.spill || this.phase === "over") return;
    this.spill = true;
    this.phase = "over";
    this.pulling = false;
    if (!this.reduce) this.shake = 10;
    this.opts.onSfx("yeet");
    const x = d ? d.nodes[1].x : 500;
    const y = d ? d.nodes[1].y : 400;
    this.float(x, y - 30, "EJECTED!", "#ff5a3c");
    this.float(640, 250, "RUN OVER", "#ffb15a");
    this.phaseT = 0.75;
  }

  private checkMilestones() {
    const { weighted, capacity } = this.liveCount();
    const occ = capacity ? (weighted / capacity) * 100 : 0;
    if (!this.crossed100 && occ >= 100) {
      this.crossed100 = true;
      this.float(900, 200, "CAPACITY CLEARED", "#7dffe1");
      this.opts.onSfx("coin");
    }
    if (!this.crossed200 && occ >= 200) {
      this.crossed200 = true;
      this.float(900, 200, "200%!", "#f0c14a");
      this.opts.onSfx("fanfare");
      if (!this.reduce) this.shake = 8;
    }
  }

  private luggageRect() {
    const top = this.opts.station.doorTop + 6;
    return { x: L.inL + 8, y: top, w: 176, h: L.floor - top - 8 };
  }

  private zipperPoints() {
    const r = this.luggageRect();
    return [
      { x: r.x + 18, y: r.y + r.h * 0.3 },
      { x: r.x + 28, y: r.y + r.h * 0.55 },
      { x: r.x + 16, y: r.y + r.h * 0.78 },
    ];
  }

  private popZipper(i: number) {
    if (!this.zippers[i] || this.luggageGone) return;
    this.zippers[i] = false;
    const p = this.zipperPoints()[i];
    this.opts.onSfx("zip");
    this.burst(p.x, p.y, "#f0c14a", 14, 320);
    this.float(p.x, p.y - 16, "POP", "#fff");
    if (!this.reduce) this.shake = Math.max(this.shake, 7);
    if (this.zippers.every((z) => !z)) this.breakLuggage();
  }

  private checkZippers() {
    if (!this.opts.station.boss || this.luggageGone) return;
    const pts = this.zipperPoints();
    for (const d of this.dolls) {
      if (!d.launched) continue;
      for (const n of d.nodes) {
        const sp = Math.hypot(n.vx, n.vy);
        if (sp < 220) continue;
        for (let i = 0; i < 3; i++) {
          if (!this.zippers[i]) continue;
          const p = pts[i];
          if (Math.hypot(n.x - p.x, n.y - p.y) < 42) {
            this.popZipper(i);
            return;
          }
        }
      }
    }
  }

  private breakLuggage() {
    this.luggageGone = true;
    this.opts.onSfx("burst");
    const r = this.luggageRect();
    this.burst(r.x + r.w / 2, r.y + r.h / 2, "#e7c49a", 28, 520);
    this.burst(r.x + 40, r.y + 40, "#ff7eb6", 10, 300);
    this.burst(r.x + 80, r.y + 80, "#7dffe1", 10, 300);
    this.float(r.x + 60, r.y + 40, "CASE OPENED!", "#f0c14a");
    if (this.phase === "aim") this.timeLeft += 1.15;
    if (!this.reduce) this.shake = 14;
  }

  private step(dt: number) {
    const g = this.opts.station.gravity;
    const wind = this.opts.station.wind;
    const gust = wind ? Math.sin(this.elapsed * 2.35) * wind : 0;
    for (const d of this.dolls) {
      d.grace = Math.max(0, d.grace - dt);
      for (const n of d.nodes) {
        n.vy += g * dt;
        if (gust && n.y < L.floor - n.r - 6) n.vx += gust * dt * 0.55;
        n.vx *= 0.9992;
        n.vy *= 0.9992;
        const sp = Math.hypot(n.vx, n.vy);
        if (sp > 2100) {
          n.vx = (n.vx / sp) * 2100;
          n.vy = (n.vy / sp) * 2100;
        }
        n.x += n.vx * dt;
        n.y += n.vy * dt;
      }
      for (let k = 0; k < 8; k++) this.solveDoll(d);
      this.collideWorld(d);
    }
    this.collideDolls();
    if (this.dolls.length > 52) {
      const drop = this.dolls.find((d) => d.launched && !this.secured.has(d.id) && !this.isInside(d));
      if (drop) this.dolls = this.dolls.filter((d) => d !== drop);
    }
  }

  private solveDoll(d: Doll) {
    for (const link of d.links) {
      const a = d.nodes[link.i];
      const b = d.nodes[link.j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy) || 0.0001;
      const diff = (dist - link.len) / dist;
      const w = a.invM + b.invM;
      if (w === 0) continue;
      const k = (diff / w) * 0.9;
      a.x += dx * k * a.invM;
      a.y += dy * k * a.invM;
      b.x -= dx * k * b.invM;
      b.y -= dy * k * b.invM;
      dx = b.x - a.x;
      dy = b.y - a.y;
      dist = Math.hypot(dx, dy) || 0.0001;
      const nx = dx / dist;
      const ny = dy / dist;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      const impulse = (rv / w) * 0.65;
      a.vx += impulse * nx * a.invM;
      a.vy += impulse * ny * a.invM;
      b.vx -= impulse * nx * b.invM;
      b.vy -= impulse * ny * b.invM;
    }
  }

  private collideWorld(d: Doll) {
    const station = this.opts.station;
    const doorTop = station.doorTop;
    for (const n of d.nodes) {
      if (n.x < 18 + n.r) {
        n.x = 18 + n.r;
        n.vx = Math.abs(n.vx) * 0.3;
      }
      if (n.y > L.H + 40) {
        n.y = L.floor - n.r;
        n.vy = 0;
        n.vx *= 0.5;
      }
      const inShaft = n.x > L.shellL - 8 && n.x < L.inR + 20;
      if (n.y + n.r > L.floor && n.y < L.floor + 80) {
        const prevVy = n.vy;
        n.y = L.floor - n.r;
        const bounce = d.grace > 0 ? 0 : 0.1 + d.def.bouncy * 0.45;
        if (n.vy > 0) n.vy *= -bounce;
        const inCar = n.x > L.inL - 4;
        const base = inCar ? carFriction(this.opts.upgrades.grease) : 0.988;
        const t = clamp(Math.abs(n.vx) / 420, 0, 1);
        const f = d.grace > 0 ? 0.998 : base + (0.9975 - base) * t;
        n.vx *= f;
        if (prevVy > 280 && this.impactCd <= 0 && d.grace <= 0) {
          this.impactCd = 0.08;
          this.opts.onSfx("slap");
          this.burst(n.x, L.floor, "#c9bba6", 4, 80);
        }
      }
      if (inShaft && n.x > L.inL - 10 && n.x < L.inR && n.y - n.r < L.inTop) {
        n.y = L.inTop + n.r;
        if (n.vy < 0) n.vy *= -0.25;
      }
      if (n.y > L.inTop && n.y < L.floor && n.x + n.r > L.inR && n.x < L.inR + 80) {
        n.x = L.inR - n.r;
        if (n.vx > 0) n.vx *= -0.28;
      }
      this.pushRect(n, L.shellL, 120, L.inL - L.shellL, doorTop - 120, 0.32, 0.92, d);
      if (station.poleTop > 0) {
        this.pushRect(n, L.shellL - 2, station.poleTop, L.inL - L.shellL + 6, L.floor - station.poleTop, 0.42, 0.9, d);
      }
      if (station.boss && !this.luggageGone) {
        const r = this.luggageRect();
        const sp = Math.hypot(n.vx, n.vy);
        if (sp > 260) {
          const pts = this.zipperPoints();
          for (let i = 0; i < pts.length; i++) {
            if (Math.hypot(n.x - pts[i].x, n.y - pts[i].y) < 56) this.popZipper(i);
          }
        }
        this.pushRect(n, r.x, r.y, r.w, r.h, 0.28, 0.86, d);
      }
      if (this.doorT > 0.02) {
        const holeTop = doorTop;
        const holeBot = L.floor;
        const half = (holeBot - holeTop) / 2;
        const h = half * this.doorT;
        const jawX = L.shellL - 2;
        const jawW = L.inL - L.shellL + 8;
        const hitTop = this.pushRect(n, jawX, holeTop, jawW, h, 0.05, 0.8, d);
        const hitBot = this.pushRect(n, jawX, holeBot - h, jawW, h, 0.05, 0.8, d);
        if ((hitTop || hitBot) && this.phase === "closing" && this.doorT > 0.42) {
          const chest = d.nodes[1];
          if (chest.x < L.inL - 4) {
            if (!d.yeeted) {
              d.yeeted = true;
              this.opts.onSfx("yeet");
              this.float(chest.x, chest.y - 20, "CRUSHED!", "#ff5a3c");
            }
            n.vx = -860 - Math.random() * 180;
            n.vy = -260 - Math.random() * 80;
            n.x = Math.min(n.x, L.shellL - n.r - 4);
          } else {
            n.x = Math.max(n.x, L.inL + n.r + 4);
            n.vx = Math.max(n.vx, 120);
          }
        }
      }
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
        n.x = L.restX;
        n.y = L.floor - 40;
        n.vx = 0;
        n.vy = 0;
      }
    }
  }

  private pushRect(
    n: Node,
    x: number,
    y: number,
    w: number,
    h: number,
    bounce: number,
    friction: number,
    d: Doll,
  ) {
    if (w <= 0 || h <= 0) return false;
    const cx = clamp(n.x, x, x + w);
    const cy = clamp(n.y, y, y + h);
    let dx = n.x - cx;
    let dy = n.y - cy;
    const inside = dx === 0 && dy === 0 && n.x > x && n.x < x + w && n.y > y && n.y < y + h;
    if (!inside) {
      const d2 = dx * dx + dy * dy;
      if (d2 >= n.r * n.r) return false;
      const dist = Math.sqrt(d2) || 0.0001;
      const pen = n.r - dist;
      dx /= dist;
      dy /= dist;
      n.x += dx * pen;
      n.y += dy * pen;
      const vn = n.vx * dx + n.vy * dy;
      if (vn < 0) {
        n.vx -= (1 + bounce) * vn * dx;
        n.vy -= (1 + bounce) * vn * dy;
        if (Math.abs(vn) > 320 && this.impactCd <= 0 && d.grace <= 0) {
          this.impactCd = 0.07;
          this.opts.onSfx("slap");
        }
      }
      if (dy < -0.5) n.vx *= friction;
      return true;
    }
    const dl = n.x - x;
    const dr = x + w - n.x;
    const dt = n.y - y;
    const db = y + h - n.y;
    const m = Math.min(dl, dr, dt, db);
    if (m === dl) {
      n.x = x - n.r;
      if (n.vx > 0) n.vx *= -bounce;
    } else if (m === dr) {
      n.x = x + w + n.r;
      if (n.vx < 0) n.vx *= -bounce;
    } else if (m === dt) {
      n.y = y - n.r;
      if (n.vy > 0) n.vy *= -bounce;
      n.vx *= friction;
    } else {
      n.y = y + h + n.r;
      if (n.vy < 0) n.vy *= -bounce;
    }
    return true;
  }

  private collideDolls() {
    const compress = compressOf(this.opts.upgrades.compress);
    const allow = compress * 0.78;
    for (let i = 0; i < this.dolls.length; i++) {
      for (let j = i + 1; j < this.dolls.length; j++) {
        const A = this.dolls[i];
        const B = this.dolls[j];
        if (Math.abs(A.nodes[1].x - B.nodes[1].x) > 180) continue;
        for (const a of A.nodes) {
          for (const b of B.nodes) {
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            const min = a.r + b.r;
            const dist = Math.hypot(dx, dy) || 0.0001;
            if (dist >= min) continue;
            const overlap = min - dist;
            const resolve = overlap * (1 - allow);
            dx /= dist;
            dy /= dist;
            const w = a.invM + b.invM;
            if (w === 0) continue;
            a.x -= dx * resolve * (a.invM / w);
            a.y -= dy * resolve * (a.invM / w);
            b.x += dx * resolve * (b.invM / w);
            b.y += dy * resolve * (b.invM / w);
            const rv = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
            if (rv > 0) continue;
            const e = 0.12 + (A.def.bouncy + B.def.bouncy) * 0.25;
            const jImp = (-(1 + e) * rv) / w;
            a.vx -= jImp * dx * a.invM;
            a.vy -= jImp * dy * a.invM;
            b.vx += jImp * dx * b.invM;
            b.vy += jImp * dy * b.invM;
            if (Math.abs(rv) > 360 && this.impactCd <= 0) {
              this.impactCd = 0.06;
              this.opts.onSfx("slap");
            }
          }
        }
      }
    }
  }

  private isInside(d: Doll) {
    const c = d.nodes[1];
    return c.x > L.inL + 6 && c.x < L.inR - 4 && c.y > L.inTop + 6 && c.y < L.floor - 2;
  }

  private liveCount() {
    let inside = 0;
    let weighted = 0;
    const source =
      this.opts.mode === "endless"
        ? this.dolls.filter((d) => this.secured.has(d.id) || (d.launched && !d.yeeted && this.isInside(d)))
        : this.dolls.filter((d) => d.launched && !d.yeeted && this.isInside(d));
    const seen = new Set<number>();
    for (const d of source) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      inside++;
      weighted += d.def.countAs;
    }
    return { inside, weighted, capacity: this.opts.station.capacity };
  }

  private tally() {
    const boarded = this.dolls.filter((d) => d.launched && !d.yeeted && this.isInside(d));
    for (const d of boarded) {
      const hip = d.nodes[2];
      d.seated = SEATS.some((s) => hip.x > s.x && hip.x < s.x + s.w && hip.y > 530);
    }
    const yeeted = this.dolls.filter((d) => d.yeeted).length;
    const launched = this.dolls.filter((d) => d.launched).length;
    const weighted = boarded.reduce((s, d) => s + d.def.countAs, 0);
    const seated = boarded.filter((d) => d.seated).length;
    return { boarded, yeeted, launched, weighted, seated };
  }

  private finishCampaign() {
    if (this.reported) return;
    this.reported = true;
    this.phase = "over";
    const station = this.opts.station;
    const t = this.tally();
    const occupancy = station.capacity ? (t.weighted / station.capacity) * 100 : 0;
    const broken = !station.boss || this.luggageGone;
    let rev = 0;
    for (const d of t.boarded) {
      let f = station.fare * d.def.fareWeight * fareMult(this.opts.upgrades.fare);
      if (d.seated) f *= 1.2;
      rev += f;
    }
    rev *= 1 + Math.min(6, this.comboMax) * 0.05;
    const perfect = t.yeeted === 0 && t.launched > 0 && t.boarded.length === t.launched;
    if (perfect) rev *= 1.15;
    if (station.boss && this.luggageGone) rev += 500;
    const owned = new Set(this.opts.owned);
    const fresh: string[] = [];
    for (const d of t.boarded) {
      if (!owned.has(d.def.id) && !fresh.includes(d.def.id)) fresh.push(d.def.id);
    }
    if (station.boss && this.luggageGone && !owned.has("luggage")) fresh.push("luggage");
    const result: RunResult = {
      mode: "campaign",
      stationId: station.id,
      boarded: t.boarded.length,
      weighted: t.weighted,
      capacity: station.capacity,
      occupancy,
      revenue: Math.round(rev),
      stars: starsFor(occupancy, station.boss, broken),
      yeeted: t.yeeted,
      missed: Math.max(0, t.launched - t.boarded.length - t.yeeted),
      comboMax: this.comboMax,
      seated: t.seated,
      newCards: fresh,
      wave: 1,
      peak: t.boarded.length,
      bossBroken: station.boss && this.luggageGone,
      spill: false,
      capped: false,
      launches: this.launches,
      perfect,
    };
    this.opts.onComplete(result);
  }

  private finishEndless() {
    if (this.reported) return;
    this.reported = true;
    const station = this.opts.station;
    const owned = new Set(this.opts.owned);
    const fresh: string[] = [];
    for (const d of this.dolls) {
      if (!this.secured.has(d.id) && !(d.launched && this.isInside(d))) continue;
      if (!owned.has(d.def.id) && !fresh.includes(d.def.id)) fresh.push(d.def.id);
    }
    const insideNow = this.dolls.filter((d) => this.secured.has(d.id) && this.isInside(d)).length;
    const peak = Math.max(this.peak, insideNow);
    const result: RunResult = {
      mode: "endless",
      stationId: station.id,
      boarded: peak,
      weighted: peak,
      capacity: station.capacity,
      occupancy: (peak / station.capacity) * 100,
      revenue: this.revenue,
      stars: 0,
      yeeted: this.dolls.filter((d) => d.yeeted).length,
      missed: 0,
      comboMax: this.comboMax,
      seated: 0,
      newCards: fresh,
      wave: this.wave,
      peak,
      bossBroken: false,
      spill: this.spill,
      capped: this.capped,
      launches: this.launches,
      perfect: false,
    };
    this.opts.onComplete(result);
  }

  getSnap(): HudSnap {
    const live = this.liveCount();
    const occ = live.capacity ? (live.weighted / live.capacity) * 100 : 0;
    return {
      phase: this.phase,
      timeLeft: this.timeLeft,
      wave: this.wave,
      inside: this.opts.mode === "endless" ? Math.max(live.inside, this.secured.size && this.phase !== "aim" ? this.secured.size : live.inside) : live.inside,
      weighted: live.weighted,
      capacity: live.capacity,
      occupancy: occ,
      combo: this.combo,
      queueIds: this.queue.slice(0, 8).map((p) => p.id),
      currentId: this.current?.id ?? null,
      currentName: this.current?.name ?? "No one waiting",
      boss: this.opts.station.boss,
      zippers: [...this.zippers],
      bossGone: this.luggageGone,
      pulling: this.pulling,
      power: clamp(Math.hypot(this.pullX, this.pullY) / L.maxPull, 0, 1),
      peak: Math.max(this.peak, this.opts.mode === "endless" ? this.secured.size : 0),
      spill: this.spill,
    };
  }

  private float(x: number, y: number, text: string, color: string) {
    this.floaters.push({ x, y, text, life: 1.05, max: 1.05, color });
  }

  private burst(x: number, y: number, color: string, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random());
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 80,
        life: 0.35 + Math.random() * 0.4,
        max: 0.7,
        color,
        size: 2 + Math.random() * 4,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 8,
        kind: i % 3 === 0 ? "paper" : "spark",
      });
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const shakeX = this.shake > 0 && !this.reduce ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake > 0 && !this.reduce ? (Math.random() - 0.5) * this.shake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawWorld(ctx);
    this.drawShellBody(ctx);
    this.drawTrainInterior(ctx);
    if (this.opts.station.boss && !this.luggageGone) this.drawLuggage(ctx);
    this.drawWaiters(ctx);
    const ordered = [...this.dolls].sort((a, b) => a.nodes[1].y - b.nodes[1].y);
    for (const d of ordered) this.drawDoll(ctx, d.def, d.nodes, this.pressure(d), Math.hypot(d.nodes[0].vx, d.nodes[0].vy));
    this.drawShellFront(ctx);
    this.drawDoor(ctx);
    if (this.current && this.phase !== "over") this.drawCurrent(ctx);
    this.drawLauncher(ctx);
    this.drawTrajectory(ctx);
    this.drawParticles(ctx);
    this.drawFloaters(ctx);
    this.drawAimHint(ctx);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 236, 210, ${this.flash * 0.28})`;
      ctx.fillRect(0, 0, L.W, L.H);
    }
    ctx.restore();
  }

  private drawAimHint(ctx: CanvasRenderingContext2D) {
    if (this.hasLaunched || this.phase !== "aim" || !this.current) return;
    ctx.fillStyle = "rgba(7, 16, 20, 0.78)";
    roundRect(ctx, 64, 64, 292, 58, 6);
    ctx.fill();
    ctx.fillStyle = "#f0c14a";
    ctx.font = "700 18px 'IBM Plex Sans', sans-serif";
    ctx.fillText("PULL LEFT, RELEASE", 80, 90);
    ctx.fillStyle = "#f4efe6";
    ctx.font = "13px 'IBM Plex Sans', sans-serif";
    ctx.fillText("Aim for the yellow gap", 80, 110);
  }

  private pressure(d: Doll) {
    let p = 0;
    const c = d.nodes[1];
    for (const o of this.dolls) {
      if (o === d) continue;
      const oc = o.nodes[1];
      const min = c.r + oc.r;
      const dist = Math.hypot(c.x - oc.x, c.y - oc.y);
      if (dist < min) p += (min - dist) / min;
    }
    return clamp(p, 0, 1);
  }

  private drawWorld(ctx: CanvasRenderingContext2D) {
    const station = this.opts.station;
    const space = station.id === "space";
    const g = ctx.createLinearGradient(0, 0, 0, L.H);
    if (space) {
      g.addColorStop(0, "#070814");
      g.addColorStop(1, "#140820");
    } else {
      g.addColorStop(0, "#07161c");
      g.addColorStop(0.45, "#0c242c");
      g.addColorStop(1, "#102830");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L.W, L.H);

    if (space) {
      for (let i = 0; i < 70; i++) {
        const sx = (i * 97 + this.elapsed * 18) % L.W;
        const sy = (i * 53) % 520;
        ctx.fillStyle = i % 6 === 0 ? "#ffe29a" : "rgba(215,230,255,0.8)";
        ctx.fillRect(sx, sy, i % 8 === 0 ? 2.4 : 1.3, i % 8 === 0 ? 2.4 : 1.3);
      }
    } else {
      ctx.fillStyle = "#0a1c22";
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(40 + i * 160, 28, 90, 8);
      }
      ctx.strokeStyle = "rgba(126, 231, 224, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 78);
      ctx.lineTo(L.W, 78);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const flicker = 0.55 + (i === 2 && Math.sin(this.elapsed * 18) > 0.85 ? 0.15 : 0.4);
        ctx.fillStyle = `rgba(190, 255, 244, ${flicker})`;
        ctx.fillRect(80 + i * 200, 36, 86, 8);
        ctx.fillStyle = "rgba(190, 255, 244, 0.05)";
        ctx.fillRect(70 + i * 200, 44, 106, 70);
      }
    }

    const tileY = 150;
    for (let x = 0; x < L.shellL; x += 46) {
      for (let y = tileY; y < L.floor; y += 28) {
        ctx.fillStyle = (x / 46 + y / 28) % 2 === 0 ? "#14343c" : "#102c34";
        ctx.fillRect(x, y, 46, 28);
      }
    }
    ctx.fillStyle = "#0e2228";
    ctx.fillRect(18, 168, 28, L.floor - 168);
    ctx.fillStyle = "#1d4a44";
    roundRect(ctx, 36, 188, 42, 250, 6);
    ctx.fill();
    ctx.fillStyle = station.color;
    ctx.fillRect(36, 188, 42, 8);

    ctx.fillStyle = "#d8a82e";
    ctx.fillRect(628, L.floor - 8, 60, 8);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? "#111" : "#f0c14a";
      ctx.fillRect(630 + i * 12, L.floor - 22, 10, 12);
    }

    ctx.fillStyle = "#0c1e24";
    ctx.fillRect(0, L.floor, L.W, L.H - L.floor);
    ctx.fillStyle = "#16343c";
    for (let x = 0; x < L.shellL; x += 32) ctx.fillRect(x, L.floor, 28, 10);
    ctx.fillStyle = "rgba(240,193,74,0.85)";
    ctx.fillRect(0, L.floor, L.shellL, 3);

    ctx.fillStyle = "#10181c";
    ctx.font = "700 13px 'IBM Plex Sans', sans-serif";
    ctx.fillStyle = "#f4efe6";
    roundRect(ctx, 48, 196, 22, 22, 11);
    ctx.fillStyle = station.color;
    ctx.fill();
    ctx.fillStyle = "#071014";
    ctx.font = "700 12px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(station.line, 59, 212);
    ctx.textAlign = "left";
    ctx.fillStyle = "#f4efe6";
    ctx.font = "700 16px 'IBM Plex Sans', sans-serif";
    ctx.fillText(station.name, 78, 212);
    ctx.fillStyle = "rgba(244,239,230,0.55)";
    ctx.font = "12px 'IBM Plex Sans', sans-serif";
    ctx.fillText("BOARD HERE", 78, 228);
  }

  private drawTrainInterior(ctx: CanvasRenderingContext2D) {
    const station = this.opts.station;
    const space = station.id === "space";
    ctx.fillStyle = space ? "#2a1848" : "#e7c09a";
    ctx.fillRect(L.shellL, station.doorTop, L.inL - L.shellL + 8, L.floor - station.doorTop);
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.inL - 8, L.inTop - 6, L.shellR - L.inL, L.shellBot - L.inTop);
    ctx.clip();

    const wall = ctx.createLinearGradient(0, L.inTop, 0, L.floor);
    if (space) {
      wall.addColorStop(0, "#1a1030");
      wall.addColorStop(1, "#2a1848");
    } else {
      wall.addColorStop(0, "#f0d2b0");
      wall.addColorStop(0.55, "#e2b48a");
      wall.addColorStop(1, "#c98462");
    }
    ctx.fillStyle = wall;
    ctx.fillRect(L.inL, L.inTop, L.inR - L.inL, L.floor - L.inTop);

    this.drawCity(ctx, L.inL + 16, L.inTop + 14, 200, 78);
    this.drawCity(ctx, L.inL + 250, L.inTop + 14, 210, 78);
    this.drawCity(ctx, L.inL + 490, L.inTop + 14, 150, 78);

    ctx.fillStyle = space ? "#3a2460" : "#a85a42";
    for (const s of SEATS) {
      roundRect(ctx, s.x, 536, s.w, 62, 8);
      ctx.fill();
      ctx.fillStyle = space ? "#c86bff" : "#f0c14a";
      ctx.fillRect(s.x, 536, s.w, 6);
      ctx.fillStyle = space ? "#3a2460" : "#a85a42";
    }

    ctx.strokeStyle = space ? "rgba(200,107,255,0.45)" : "rgba(80,40,30,0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(L.inL + 20, 250);
    ctx.lineTo(L.inR - 16, 250);
    ctx.stroke();
    for (const x of [820, 960, 1100]) {
      ctx.beginPath();
      ctx.moveTo(x, 250);
      ctx.lineTo(x, 520);
      ctx.stroke();
      ctx.fillStyle = space ? "#e7d4ff" : "#f7e7c8";
      ctx.beginPath();
      ctx.arc(x, 300, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = space ? "#120818" : "#2a1a16";
    roundRect(ctx, 790, 300, 150, 52, 6);
    ctx.fill();
    roundRect(ctx, 980, 300, 150, 52, 6);
    ctx.fill();
    ctx.fillStyle = station.color;
    ctx.fillRect(790, 300, 6, 52);
    ctx.fillRect(980, 300, 6, 52);
    ctx.fillStyle = "#f4efe6";
    ctx.font = "700 14px 'IBM Plex Sans', sans-serif";
    ctx.fillText(station.ads[0], 804, 330);
    ctx.fillText(station.ads[1], 994, 330);

    ctx.fillStyle = space ? "#241436" : "#b88968";
    ctx.fillRect(L.inL, L.floor - 16, L.inR - L.inL, 16);
    ctx.restore();

    const led = station.announce;
    ctx.fillStyle = "#12080a";
    roundRect(ctx, 748, 86, 390, 24, 4);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(754, 88, 378, 20);
    ctx.clip();
    ctx.fillStyle = "#ffb15a";
    ctx.font = "14px 'IBM Plex Sans', sans-serif";
    const shift = (this.marquee * 46) % (led.length * 14 + 80);
    ctx.fillText(led + "    " + led, 758 - shift, 104);
    ctx.restore();
  }

  private drawCity(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const space = this.opts.station.id === "space";
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (space) {
      ctx.fillStyle = "#070814";
      ctx.fillRect(x, y, w, h);
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = i % 4 === 0 ? "#ffe29a" : "#d5e4ff";
        ctx.fillRect(x + ((i * 47 + this.elapsed * 26) % w), y + ((i * 29) % h), 2, 2);
      }
    } else {
      const sky = ctx.createLinearGradient(0, y, 0, y + h);
      sky.addColorStop(0, "#12323a");
      sky.addColorStop(1, "#07141a");
      ctx.fillStyle = sky;
      ctx.fillRect(x, y, w, h);
      for (let i = 0; i < 8; i++) {
        const bw = 22 + (i % 3) * 10;
        const bh = 28 + (i % 4) * 12;
        const bx = x + ((i * 48 - this.elapsed * 36) % (w + 60)) - 30;
        ctx.fillStyle = "#0c1c24";
        ctx.fillRect(bx, y + h - bh, bw, bh);
        ctx.fillStyle = i % 2 ? "rgba(255,210,122,0.7)" : "rgba(126,232,196,0.55)";
        ctx.fillRect(bx + 4, y + h - bh + 6, 4, 5);
        ctx.fillRect(bx + 12, y + h - bh + 14, 4, 5);
      }
    }
    ctx.restore();
    ctx.strokeStyle = space ? "#c86bff" : "#8a5a42";
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
  }

  private drawLuggage(ctx: CanvasRenderingContext2D) {
    const r = this.luggageRect();
    ctx.save();
    ctx.fillStyle = "#6b3e22";
    roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fill();
    ctx.strokeStyle = "#1a100c";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#a56b3c";
    roundRect(ctx, r.x + 10, r.y + 10, r.w - 20, r.h * 0.42, 10);
    ctx.fill();
    ctx.strokeStyle = "#e6c07a";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(r.x + 18, r.y + 16, r.w - 36, r.h - 32);
    ctx.setLineDash([]);
    ctx.fillStyle = "#1a100c";
    ctx.fillRect(r.x + r.w / 2 - 8, r.y - 6, 16, 22);
    const pts = this.zipperPoints();
    pts.forEach((p, i) => {
      const intact = this.zippers[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, intact ? 11 : 6, 0, Math.PI * 2);
      ctx.fillStyle = intact ? "#f0c14a" : "#4a3020";
      ctx.fill();
      ctx.strokeStyle = "#1a100c";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (intact) {
        ctx.fillStyle = "rgba(255, 220, 120, 0.35)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18 + Math.sin(this.elapsed * 6 + i) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.fillStyle = "#f4efe6";
    ctx.beginPath();
    ctx.arc(r.x + 62, r.y + 78, 8, 0, Math.PI * 2);
    ctx.arc(r.x + 108, r.y + 78, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a100c";
    ctx.beginPath();
    ctx.arc(r.x + 64, r.y + 80, 3, 0, Math.PI * 2);
    ctx.arc(r.x + 110, r.y + 80, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1a100c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x + 86, r.y + 108, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = "#f4efe6";
    ctx.font = "700 13px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HIT THE ZIPS", r.x + r.w / 2, r.y + r.h - 28);
    ctx.textAlign = "left";
    ctx.restore();
  }

  private drawWaiters(ctx: CanvasRenderingContext2D) {
    const spots = [86, 168, 250];
    this.queue.slice(0, 3).forEach((def, i) => {
      const x = spots[i];
      const bob = Math.sin(this.elapsed * 2 + i) * 1.5;
      const nodes = pose(def, x, chestRestY(def) + bob, 0);
      ctx.save();
      ctx.globalAlpha = 0.9;
      this.drawDoll(ctx, def, nodes, 0, 0);
      ctx.restore();
    });
  }

  private drawCurrent(ctx: CanvasRenderingContext2D) {
    const def = this.current;
    if (!def) return;
    const chestX = L.restX + this.pullX;
    const chestY = chestRestY(def) + this.pullY;
    const nodes = pose(def, chestX, chestY, this.pullX * -0.0008);
    this.drawDoll(ctx, def, nodes, 0, this.pulling ? 200 : 0);
  }

  private drawDoll(
    ctx: CanvasRenderingContext2D,
    def: PassengerDef,
    nodes: Node[],
    pressure: number,
    speed: number,
  ) {
    const head = nodes[0];
    const chest = nodes[1];
    const hip = nodes[2];
    const lh = nodes[3];
    const rh = nodes[4];
    const lf = nodes[5];
    const rf = nodes[6];
    const prop = nodes[7];
    const s = def.scale;

    if (def.extra === "backpack") {
      ctx.fillStyle = "#2a4a44";
      ctx.strokeStyle = "#101418";
      ctx.lineWidth = 3;
      roundRect(ctx, chest.x - 18 * s, chest.y - 8 * s, 16 * s, 28 * s, 5);
      ctx.fill();
      ctx.stroke();
    }

    this.limb(ctx, hip, lf, 9 * s, def.pants, 7);
    this.limb(ctx, hip, rf, 9 * s, def.pants, -7);
    this.shoe(ctx, lf, def.shoe);
    this.shoe(ctx, rf, def.shoe);
    this.limb(ctx, chest, lh, 7.5 * s, def.suit, 8);
    this.limb(ctx, chest, rh, 7.5 * s, def.suit, -8);

    const ang = Math.atan2(hip.y - chest.y, hip.x - chest.x);
    const len = Math.hypot(hip.x - chest.x, hip.y - chest.y);
    ctx.save();
    ctx.translate((chest.x + hip.x) / 2, (chest.y + hip.y) / 2);
    ctx.rotate(ang - Math.PI / 2);
    ctx.fillStyle = def.suit;
    ctx.strokeStyle = "#101418";
    ctx.lineWidth = 3;
    roundRect(ctx, -17 * s, -len / 2, 34 * s, len, 11 * s);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = def.suit2;
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.35);
    ctx.lineTo(-8 * s, len * 0.15);
    ctx.lineTo(8 * s, len * 0.15);
    ctx.closePath();
    ctx.fill();
    if (def.extra === "tie" || def.extra === "loose-tie") {
      ctx.fillStyle = def.extra === "loose-tie" ? "#e24b4b" : "#f0c14a";
      ctx.beginPath();
      ctx.moveTo(0, -len * 0.22);
      ctx.lineTo(-4 * s, len * 0.05);
      ctx.lineTo(0, len * 0.28);
      ctx.lineTo(4 * s, len * 0.05);
      ctx.closePath();
      ctx.fill();
    }
    if (def.extra === "scarf") {
      ctx.fillStyle = "#f0c14a";
      ctx.fillRect(-12 * s, -len * 0.4, 24 * s, 6 * s);
    }
    ctx.restore();

    ctx.fillStyle = def.skin;
    ctx.strokeStyle = "#101418";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(lh.x, lh.y, lh.r, 0, Math.PI * 2);
    ctx.arc(rh.x, rh.y, rh.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (prop) {
      ctx.save();
      ctx.translate(prop.x, prop.y);
      ctx.rotate(Math.atan2(prop.y - rh.y, prop.x - rh.x));
      ctx.fillStyle = "#1c1a22";
      ctx.strokeStyle = "#101418";
      roundRect(ctx, -12, -9, 24, 18, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f0c14a";
      ctx.fillRect(-2, -9, 3, 18);
      ctx.restore();
    }
    if (def.extra === "lightstick") {
      ctx.strokeStyle = "#ff7eb6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rh.x, rh.y);
      ctx.lineTo(rh.x + 8, rh.y - 28);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,126,182,0.85)";
      ctx.beginPath();
      ctx.arc(rh.x + 8, rh.y - 32, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (def.extra === "camera") {
      ctx.fillStyle = "#1c1a22";
      ctx.fillRect(chest.x + 8, chest.y - 4, 14, 10);
      ctx.fillStyle = "#7ec8ff";
      ctx.beginPath();
      ctx.arc(chest.x + 20, chest.y + 1, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.scale(1 + pressure * 0.22, 1 - pressure * 0.28);
    this.drawHairBack(ctx, def);
    ctx.beginPath();
    ctx.arc(0, 0, head.r, 0, Math.PI * 2);
    ctx.fillStyle = def.face === "visor" ? "#d5dee8" : def.skin;
    ctx.fill();
    ctx.strokeStyle = "#101418";
    ctx.lineWidth = 3;
    ctx.stroke();
    this.drawFace(ctx, def, head.r, speed, pressure);
    this.drawHairFront(ctx, def, head.r);
    ctx.restore();
  }

  private limb(
    ctx: CanvasRenderingContext2D,
    a: Node,
    b: Node,
    width: number,
    color: string,
    bend: number,
  ) {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = mx + (-dy / len) * bend;
    const py = my + (dx / len) * bend;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#101418";
    ctx.lineWidth = width + 4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(px, py, b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(px, py, b.x, b.y);
    ctx.stroke();
  }

  private shoe(ctx: CanvasRenderingContext2D, n: Node, color: string) {
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.fillStyle = color;
    ctx.strokeStyle = "#101418";
    ctx.lineWidth = 2;
    roundRect(ctx, -n.r, -n.r * 0.6, n.r * 2.3, n.r * 1.3, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawHairBack(ctx: CanvasRenderingContext2D, def: PassengerDef) {
    ctx.fillStyle = def.hair;
    if (def.hairStyle === "bob" || def.hairStyle === "messy") {
      ctx.beginPath();
      ctx.arc(0, 2, 16 * def.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHairFront(ctx: CanvasRenderingContext2D, def: PassengerDef, r: number) {
    ctx.fillStyle = def.hair;
    ctx.strokeStyle = "#101418";
    ctx.lineWidth = 2;
    switch (def.hairStyle) {
      case "short":
      case "messy":
        ctx.beginPath();
        ctx.arc(0, -2, r, Math.PI, 0);
        ctx.fill();
        if (def.hairStyle === "messy") {
          ctx.beginPath();
          ctx.moveTo(-8, -r + 2);
          ctx.lineTo(-4, -r - 8);
          ctx.lineTo(0, -r + 1);
          ctx.fill();
        }
        break;
      case "bob":
        ctx.beginPath();
        ctx.arc(0, 0, r + 1.5, Math.PI * 1.05, Math.PI * 1.95);
        ctx.fill();
        break;
      case "bun":
        ctx.beginPath();
        ctx.arc(0, -2, r, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -r - 2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case "topknot":
        ctx.beginPath();
        ctx.arc(0, -r - 1, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case "helmet":
        ctx.fillStyle = "#f0c14a";
        ctx.beginPath();
        ctx.arc(0, -1, r + 2, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(-r, -2, r * 2, 5);
        break;
      case "visor":
        ctx.fillStyle = "#e8eef4";
        ctx.beginPath();
        ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#101418";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "rgba(80, 170, 220, 0.45)";
        ctx.fillRect(-r, -2, r * 2 + 4, 8);
        break;
      case "beanie":
        ctx.fillStyle = "#1f3d4a";
        ctx.beginPath();
        ctx.arc(0, -3, r + 1, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(-r - 1, -4, r * 2 + 2, 6);
        ctx.fillStyle = "#f0c14a";
        ctx.fillRect(-r, -6, r * 2, 3);
        break;
      case "cat":
        ctx.fillStyle = def.hair;
        ctx.beginPath();
        ctx.moveTo(-12, -4);
        ctx.lineTo(-18, -16);
        ctx.lineTo(-4, -8);
        ctx.moveTo(12, -4);
        ctx.lineTo(18, -16);
        ctx.lineTo(4, -8);
        ctx.fill();
        break;
      case "hat":
        ctx.fillStyle = "#efe6d4";
        ctx.fillRect(-r - 4, -4, r * 2 + 8, 5);
        ctx.beginPath();
        ctx.arc(0, -4, r - 1, Math.PI, 0);
        ctx.fill();
        break;
      default:
        break;
    }
    if (def.extra === "glasses" || def.face === "smug" || def.id === "exec") {
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(-5, 1, 4.5, 0, Math.PI * 2);
      ctx.arc(5, 1, 4.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawFace(
    ctx: CanvasRenderingContext2D,
    def: PassengerDef,
    r: number,
    speed: number,
    pressure: number,
  ) {
    if (def.face === "visor") {
      ctx.fillStyle = "rgba(20,40,60,0.35)";
      ctx.beginPath();
      ctx.arc(0, 2, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#123";
      ctx.fillRect(-3, 0, 2, 2);
      ctx.fillRect(3, 0, 2, 2);
      return;
    }
    const scream = speed > 360;
    const squint = pressure > 0.35;
    ctx.fillStyle = "#1a120e";
    if (squint) {
      ctx.strokeStyle = "#1a120e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -1);
      ctx.lineTo(-2, 1);
      ctx.moveTo(8, -1);
      ctx.lineTo(2, 1);
      ctx.stroke();
    } else if (def.face === "sparkle") {
      ctx.fillStyle = "#ff7eb6";
      this.star(ctx, -5, 0, 3.4);
      this.star(ctx, 5, 0, 3.4);
    } else {
      const look = clamp(speed * 0.004, -2, 2);
      ctx.beginPath();
      ctx.arc(-5 + look, 0, def.face === "anxious" ? 2.3 : 1.8, 0, Math.PI * 2);
      ctx.arc(5 + look, 0, def.face === "anxious" ? 2.3 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#1a120e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (def.face === "tired") {
      ctx.moveTo(-8, -5);
      ctx.lineTo(-2, -3);
      ctx.moveTo(8, -5);
      ctx.lineTo(2, -3);
    } else if (def.face === "fierce" || def.face === "smug") {
      ctx.moveTo(-8, -6);
      ctx.lineTo(-2, -3);
      ctx.moveTo(8, -6);
      ctx.lineTo(2, -4);
    }
    ctx.stroke();
    if (scream) {
      ctx.fillStyle = "#1a120e";
      ctx.beginPath();
      ctx.ellipse(0, 7, 3.5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff8d7a";
      ctx.beginPath();
      ctx.ellipse(0, 8, 2, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.face === "grin") {
      ctx.strokeStyle = "#1a120e";
      ctx.beginPath();
      ctx.arc(0, 4, 5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#a86458";
      ctx.beginPath();
      ctx.arc(0, 5, 3.5, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }
    if (def.face === "anxious" || pressure > 0.2) {
      ctx.fillStyle = "rgba(80, 170, 200, 0.8)";
      ctx.beginPath();
      ctx.ellipse(r * 0.7, -r * 0.2, 2, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private star(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const b = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      ctx.lineTo(x + Math.cos(b) * rad * 0.45, y + Math.sin(b) * rad * 0.45);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawShellBody(ctx: CanvasRenderingContext2D) {
    const station = this.opts.station;
    const space = station.id === "space";
    ctx.fillStyle = space ? "#d7d3ea" : "#d5dee4";
    roundRect(ctx, L.shellL, L.shellTop, L.shellR - L.shellL, L.shellBot - L.shellTop, 18);
    ctx.fill();
    ctx.fillStyle = station.color;
    ctx.fillRect(L.shellL, 196, L.shellR - L.shellL, 16);
    ctx.fillStyle = "#8d98a1";
    ctx.fillRect(L.shellL + 8, L.shellBot - 18, L.shellR - L.shellL - 16, 8);
  }

  private drawShellFront(ctx: CanvasRenderingContext2D) {
    const station = this.opts.station;
    const space = station.id === "space";
    ctx.fillStyle = space ? "#d7d3ea" : "#d5dee4";
    ctx.fillRect(L.shellL, L.shellTop, L.shellR - L.shellL, L.inTop - L.shellTop + 4);
    ctx.fillRect(L.shellL, L.floor - 2, L.shellR - L.shellL, L.shellBot - L.floor + 2);
    ctx.fillRect(L.inR - 4, L.inTop, L.shellR - L.inR + 4, L.floor - L.inTop);
    ctx.fillStyle = space ? "#efeaff" : "#eef3f6";
    ctx.fillRect(L.shellL - 4, L.shellTop + 6, L.inL - L.shellL + 8, station.doorTop - L.shellTop - 2);
    ctx.fillStyle = station.color;
    ctx.fillRect(L.shellL, 188, L.inL - L.shellL, 12);
    ctx.fillRect(L.inR, 188, L.shellR - L.inR, 12);
    ctx.strokeStyle = "#1c242c";
    ctx.lineWidth = 5;
    roundRect(ctx, L.shellL, L.shellTop, L.shellR - L.shellL, L.shellBot - L.shellTop, 18);
    ctx.stroke();

    ctx.fillStyle = "#1c242c";
    ctx.fillRect(L.shellR - 18, L.shellTop + 20, 10, L.shellBot - L.shellTop - 40);

    ctx.fillStyle = space ? "#efeaff" : "#eef3f6";
    ctx.fillRect(L.shellL - 6, L.shellTop + 8, L.inL - L.shellL + 10, station.doorTop - L.shellTop - 4);

    if (station.poleTop > 0) {
      ctx.fillStyle = "#c5ced4";
      ctx.fillRect(L.shellL + 8, station.poleTop, 16, L.floor - station.poleTop);
      ctx.fillStyle = "#f0c14a";
      ctx.fillRect(L.shellL + 8, station.poleTop, 16, 8);
      ctx.fillStyle = "#101418";
      ctx.font = "700 11px 'IBM Plex Sans', sans-serif";
      ctx.save();
      ctx.translate(L.shellL + 28, station.poleTop + 70);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("MIND YOUR HEAD", 0, 0);
      ctx.restore();
    }

    const open = this.doorT < 0.5 && (this.phase === "aim" || this.phase === "countdown" || this.phase === "banner");
    ctx.fillStyle = open ? "#3cba6a" : "#ff4b3a";
    ctx.beginPath();
    ctx.arc(L.shellL + 24, L.shellTop + 28, 6, 0, Math.PI * 2);
    ctx.fill();
    if (open) {
      const pulse = 0.45 + Math.sin(this.elapsed * 5) * 0.25;
      ctx.strokeStyle = `rgba(240, 193, 74, ${pulse})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(L.shellL + 2, this.opts.station.doorTop + 2, L.inL - L.shellL - 4, L.floor - this.opts.station.doorTop - 4);
      ctx.fillStyle = "#f0c14a";
      ctx.font = "700 13px 'IBM Plex Sans', sans-serif";
      ctx.fillText("BOARD", L.shellL + 8, this.opts.station.doorTop + 22);
    }
  }

  private drawDoor(ctx: CanvasRenderingContext2D) {
    if (this.doorT <= 0.01) return;
    const top = this.opts.station.doorTop;
    const bot = L.floor;
    const half = (bot - top) / 2;
    const h = half * this.doorT;
    const x = L.shellL - 4;
    const w = L.inL - L.shellL + 12;
    const paint = (y: number, hh: number) => {
      if (hh <= 1) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, hh);
      ctx.clip();
      ctx.fillStyle = "#e7edf1";
      ctx.fillRect(x, y, w, hh);
      for (let i = -20; i < hh + 40; i += 14) {
        ctx.fillStyle = i % 28 === 0 ? "#111" : "#f0c14a";
        ctx.fillRect(x, y + i, w, 8);
      }
      ctx.restore();
      ctx.strokeStyle = "#1c242c";
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, hh);
    };
    paint(top, h);
    paint(bot - h, h);
  }

  private drawLauncher(ctx: CanvasRenderingContext2D) {
    const def = this.current;
    const chestX = def ? L.restX + this.pullX : L.restX;
    const chestY = def ? chestRestY(def) + this.pullY : 520;
    ctx.strokeStyle = "#1c242c";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(L.forkX, 430);
    ctx.lineTo(L.forkX, 590);
    ctx.stroke();
    ctx.strokeStyle = "#d7dee4";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(L.forkX, 434);
    ctx.lineTo(L.forkX, 586);
    ctx.stroke();
    ctx.fillStyle = "#f0c14a";
    ctx.fillRect(L.forkX - 10, 500, 20, 10);
    const slack = this.pulling ? 3 : 5;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = slack;
    ctx.beginPath();
    ctx.moveTo(L.forkX, 455);
    ctx.lineTo(chestX - 6, chestY - 8);
    ctx.lineTo(L.forkX, 560);
    ctx.stroke();
    ctx.fillStyle = "#101418";
    ctx.font = "700 12px 'IBM Plex Sans', sans-serif";
    ctx.fillText("STUFFER 01", L.forkX - 36, 582);

    if (this.pulling) {
      const p = Math.hypot(this.pullX, this.pullY) / L.maxPull;
      ctx.fillStyle = "#102228";
      roundRect(ctx, chestX - 28, chestY - 62, 56, 16, 4);
      ctx.fill();
      ctx.fillStyle = p > 0.82 ? "#ff5a3c" : "#f0c14a";
      ctx.fillRect(chestX - 26, chestY - 60, 52 * p, 12);
    }
  }

  private drawTrajectory(ctx: CanvasRenderingContext2D) {
    if (!this.pulling || !this.current) {
      if (!this.hasLaunched && this.opts.station.id === "sindorim" && this.current && this.phase === "aim") {
        ctx.setLineDash([5, 7]);
        ctx.strokeStyle = "rgba(240,193,74,0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(L.restX, chestRestY(this.current));
        ctx.lineTo(L.inL + 80, 470);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      return;
    }
    const dist = Math.max(8, Math.hypot(this.pullX, this.pullY));
    const power = dist / L.maxPull;
    const speed = (power * slingSpeed(this.opts.upgrades.sling)) / Math.pow(this.current.mass, 0.42);
    let x = L.restX + this.pullX;
    let y = chestRestY(this.current) + this.pullY;
    let vx = (-this.pullX / dist) * speed;
    let vy = (-this.pullY / dist) * speed;
    const g = this.opts.station.gravity;
    for (let i = 0; i < 22; i++) {
      const gust = this.opts.station.wind ? Math.sin((this.elapsed + i * 0.045) * 2.35) * this.opts.station.wind : 0;
      vy += g * 0.045;
      vx += gust * 0.045 * 0.55;
      x += vx * 0.045;
      y += vy * 0.045;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, 5 - i * 0.18), 0, Math.PI * 2);
      ctx.fillStyle = i > 14 ? "rgba(255,90,60,0.8)" : "rgba(240,193,74,0.9)";
      ctx.fill();
      if (y > L.floor - 8) break;
      if (x > L.inR) break;
      if (this.opts.station.poleTop > 0 && x > L.shellL && x < L.inL && y > this.opts.station.poleTop) break;
      if (this.opts.station.boss && !this.luggageGone) {
        const r = this.luggageRect();
        if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) break;
      }
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      if (p.kind === "paper") ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size);
      else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  private drawFloaters(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = "center";
    ctx.font = "700 20px 'Archivo Black', 'IBM Plex Sans', sans-serif";
    for (const f of this.floaters) {
      ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
      ctx.fillStyle = "#101418";
      ctx.fillText(f.text, f.x + 2, f.y + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
}
