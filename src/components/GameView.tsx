import { useEffect, useRef, useState } from "react";
import { audio } from "../game/audio";
import { compressOf } from "../game/content";
import { PASSENGERS } from "../game/content";
import { L, SubwaySim, type HudSnap } from "../game/sim";
import type { Mode, RunResult, StationDef, Upgrades } from "../game/types";
import { cn } from "../utils/cn";

interface Props {
  station: StationDef;
  mode: Mode;
  upgrades: Upgrades;
  owned: string[];
  seenIntro: boolean;
  muted: boolean;
  onIntroSeen: () => void;
  onComplete: (result: RunResult) => void;
  onExit: () => void;
  onToggleMute: () => void;
}

function fmt(t: number) {
  return Math.max(0, t).toFixed(1);
}

export function GameView({
  station,
  mode,
  upgrades,
  owned,
  seenIntro,
  muted,
  onIntroSeen,
  onComplete,
  onExit,
  onToggleMute,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<SubwaySim | null>(null);
  const pausedRef = useRef(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const [paused, setPaused] = useState(false);
  const [snap, setSnap] = useState<HudSnap | null>(null);
  const [coach, setCoach] = useState(!seenIntro && station.id === "sindorim" && mode === "campaign");
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth * 1.05);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Auto-pause on tab switch / focus loss so the wall-clock timer cannot run away.
  useEffect(() => {
    const autoPause = () => {
      setPaused((p) => {
        if (p) return p;
        return true;
      });
    };
    const onVis = () => {
      if (document.hidden) autoPause();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", autoPause);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", autoPause);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = L.W * dpr;
    canvas.height = L.H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sim = new SubwaySim({
      mode,
      station,
      upgrades,
      owned,
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      onSfx: (name) => audio.play(name),
      onComplete: (result) => completeRef.current(result),
    });
    simRef.current = sim;
    setSnap(sim.getSnap());
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) sim.update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, L.W, L.H);
      sim.render(ctx);
      acc += dt;
      if (acc > 0.08) {
        acc = 0;
        setSnap(sim.getSnap());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // Mount-only: a new GameView is created per run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * L.W,
      y: ((e.clientY - r.top) / r.height) * L.H,
    };
  };

  const occ = snap ? Math.round(snap.occupancy) : 0;
  const urgent = !!snap && snap.phase === "aim" && snap.timeLeft <= 2;
  const ids = snap?.currentId ? [snap.currentId, ...snap.queueIds] : snap?.queueIds ?? [];

  return (
    <div className="flex h-dvh flex-col bg-[#071014] text-[#f4efe6]">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#1c3338] px-3">
        <div
          className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-[#071014]"
          style={{ background: station.color }}
        >
          {station.line}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{station.name}</div>
          <div className="text-[10px] tracking-[0.22em] text-[#7dffe1]">{station.en}</div>
        </div>
        {mode === "endless" && (
          <div className="hidden rounded border border-[#ff5a3c] px-2 py-1 text-xs text-[#ffb15a] sm:block">
            {snap?.wave ?? 1}WAVE · BEST {snap?.peak ?? 0}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {station.boss && (
            <div className="hidden items-center gap-1 sm:flex" aria-label="zip durability">
              {(snap?.zippers ?? [true, true, true]).map((intact, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-3 w-3 rounded-full border",
                    intact ? "border-[#f0c14a] bg-[#f0c14a]" : "border-[#4a4030] bg-transparent",
                  )}
                />
              ))}
            </div>
          )}
          <div
            className={cn(
              "led min-w-[92px] border px-3 py-1 text-center text-2xl leading-none",
              urgent ? "led-blink border-[#ff5a3c] text-[#ff5a3c]" : "border-[#f0c14a] text-[#f0c14a]",
            )}
          >
            {snap ? fmt(snap.timeLeft) : "0.0"}
          </div>
          <button
            className="border border-[#2c4a52] px-2 py-1 text-xs"
            onClick={() => setPaused(true)}
          >
            PAUSE
          </button>
          <button className="border border-[#2c4a52] px-2 py-1 text-xs" onClick={onToggleMute}>
            {muted ? "MUTE" : "SOUND"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-1">
        {/* Portrait: drop the fixed 16:9 box so the touch area is usable on phones. */}
        <div
          className="relative bg-black"
          style={
            portrait
              ? { width: "100%", height: "100%", maxHeight: "calc(100dvh - 150px)" }
              : { width: "min(100%, calc((100dvh - 168px) * 16 / 9))", aspectRatio: "16 / 9" }
          }
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              if (paused) return;
              audio.ensure();
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = pos(e);
              simRef.current?.pointerDown(p.x, p.y);
            }}
            onPointerMove={(e) => {
              if (paused) return;
              const p = pos(e);
              simRef.current?.pointerMove(p.x, p.y);
            }}
            onPointerUp={() => {
              simRef.current?.pointerUp();
              if (coach) {
                setCoach(false);
                onIntroSeen();
              }
            }}
            onPointerCancel={() => {
              // Release the pull if the drag leaves the canvas, otherwise it sticks.
              simRef.current?.pointerUp();
            }}
            onLostPointerCapture={() => {
              simRef.current?.pointerUp();
            }}
          />

          {snap?.phase === "banner" && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#071014]/55 p-6 text-center">
              <div className="rise-in max-w-md border-2 border-[#f0c14a] bg-[#071014]/90 px-5 py-4">
                <div className="text-[10px] tracking-[0.28em] text-[#ff5a3c]">BOSS DOOR</div>
                <div className="display text-4xl text-[#f0c14a]">GIANT SUITCASE</div>
                <p className="mt-2 text-sm text-[#f4efe6]">Launch passengers at all three zips to burst them open. Until then, nobody gets in.</p>
                <div className="mt-3 text-xs text-[#7dffe1]">Tap to begin</div>
              </div>
            </div>
          )}

          {snap?.phase === "countdown" && (
            <div className="pointer-events-none absolute inset-x-0 top-[16%] text-center">
              <div className="display text-[clamp(40px,7vw,84px)] text-[#f0c14a]">DOORS OPEN</div>
            </div>
          )}

          {coach && snap?.phase === "aim" && (
            <div className="absolute inset-x-0 top-[4%] flex justify-center px-3">
              <div className="w-full max-w-md border-2 border-[#f0c14a] bg-[#0c1c22]/95 p-3 text-[#f4efe6]">
                <div className="flex items-center justify-between text-[10px] tracking-[0.22em] text-[#7dffe1]">
                  <span>First shift guide</span>
                  <button
                    className="border border-[#2c4a52] px-2 py-0.5 text-[11px] text-[#9fb8b4] hover:text-[#f4efe6]"
                    onClick={() => {
                      setCoach(false);
                      onIntroSeen();
                    }}
                  >
                    SKIP
                  </button>
                </div>
                <ol className="mt-2 space-y-1 text-xs leading-relaxed">
                  <li>
                    <b className="text-[#f0c14a]">1</b> Hold a passenger and <b>drag left</b> to aim the sling.
                  </li>
                  <li>
                    <b className="text-[#f0c14a]">2</b> Line up the angle, then <b>release</b> to launch.
                  </li>
                  <li>
                    <b className="text-[#f0c14a]">3</b> Fill at least the legal capacity (100%) before the doors close for one star.
                  </li>
                </ol>
                <div className="mt-2 flex justify-center">
                  <span className="tug display text-xl text-[#f0c14a]">PULL LEFT, RELEASE</span>
                </div>
              </div>
            </div>
          )}

          {paused && (
            <div className="absolute inset-0 grid place-items-center bg-[#071014]/75 p-4">
              <div className="w-full max-w-sm border-2 border-[#f0c14a] bg-[#0c1c22] p-5">
                <div className="text-[10px] tracking-[0.28em] text-[#7dffe1]">PAUSED</div>
                <div className="display text-4xl">PAUSED</div>
                <div className="mt-4 grid gap-2">
                  <button className="border border-[#f0c14a] px-3 py-2 text-left" onClick={() => setPaused(false)}>
                    KEEP STUFFING
                  </button>
                  {mode === "endless" && (
                    <button
                      className="border border-[#7dffe1] px-3 py-2 text-left text-[#7dffe1]"
                      onClick={() => simRef.current?.cashOut()}
                    >
                      BANK SCORE AND LEAVE
                    </button>
                  )}
                  <button className="border border-[#2c4a52] px-3 py-2 text-left text-[#d7c7b0]" onClick={onExit}>
                    {mode === "endless" ? "LEAVE WITHOUT SCORE" : "GIVE UP AND GO TO THE MAP"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="flex h-[88px] shrink-0 items-center gap-3 border-t border-[#1c3338] px-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between text-[11px] text-[#9fb8b4]">
            <span>
              {mode === "endless" ? "ON BOARD" : "OCCUPANCY"}{" "}
              <b className="text-[#f4efe6]">
                {mode === "endless" ? `${snap?.inside ?? 0} aboard` : `${occ}%`}
              </b>
              {mode === "campaign" && (
                <span className="text-[#7dffe1]"> · weighted {snap?.weighted ?? 0}/{snap?.capacity ?? 0}</span>
              )}
            </span>
            <span>COMPACTOR LV{upgrades.compress}</span>
          </div>
          <div className="relative h-2 overflow-hidden bg-[#102228]">
            <div
              className="absolute top-0 bottom-0 w-px bg-[#f4efe6]/50"
              style={{ left: "50%" }}
            />
            <div
              className={cn("h-full", occ >= 200 ? "bg-[#f0c14a]" : occ >= 100 ? "bg-[#3cba6a]" : "bg-[#7dffe1]")}
              style={{ width: `${Math.min(100, occ / 2)}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] tracking-widest text-[#6f8d88]">100% is the legal mark · 200% is the rush-hour answer · crush {Math.round(compressOf(upgrades.compress) * 100)}%</div>
        </div>
        <div className="flex max-w-[46%] items-center gap-1 overflow-x-auto">
          {ids.length === 0 && <span className="text-xs text-[#6f8d88]">No passengers waiting</span>}
          {ids.map((id, i) => {
            const p = PASSENGERS[id];
            if (!p) return null;
            return (
              <div key={`${id}-${i}`} className="shrink-0 text-center">
                <div
                  className={cn(
                    "h-10 w-10 overflow-hidden rounded-full border-2",
                    i === 0 ? "border-[#f0c14a]" : "border-[#2c4a52] opacity-70",
                  )}
                >
                  {p.image ? (
                    <img src={p.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[10px] font-bold" style={{ background: p.suit }}>
                      {p.name.slice(0, 1)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="hidden w-32 text-right sm:block">
          <div className="text-[10px] tracking-[0.18em] text-[#7dffe1]">NOW BOARDING</div>
          <div className="truncate text-sm font-semibold">{snap?.currentName ?? "—"}</div>
          {snap?.currentId === "sumo" && <div className="text-xs text-[#ff5a3c]">Heavy · full power</div>}
          {snap?.currentId === "newbie" && <div className="text-xs text-[#7dffe1]">Light · flies far</div>}
          {snap && snap.combo >= 2 && <div className="text-xs text-[#f0c14a]">COMBO x{snap.combo}</div>}
        </div>
      </footer>
    </div>
  );
}
