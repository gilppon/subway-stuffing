import { useEffect, useState } from "react";
import { audio } from "../game/audio";
import {
  CARD_ORDER,
  PASSENGERS,
  SPACE_PASS_COST,
  STATIONS,
  TICKER,
  UPGRADES,
  compressOf,
  rankTitle,
  stationById,
  won,
} from "../game/content";
import type { RunResult, SaveData, StationDef } from "../game/types";
import { cn } from "../utils/cn";

function PanelButton({
  kicker,
  children,
  onClick,
  tone = "yellow",
  disabled,
}: {
  kicker?: string;
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "yellow" | "ghost" | "danger" | "mint";
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-w-[168px] flex-col border-2 px-4 py-3 text-left transition enabled:hover:-translate-y-0.5 enabled:active:translate-x-0.5 enabled:active:translate-y-0.5 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-40",
        tone === "yellow" && "border-[#f0c14a] bg-[#102228] shadow-[4px_4px_0_#f0c14a]",
        tone === "ghost" && "border-[#2c4a52] bg-[#0c1c22]/80 shadow-[4px_4px_0_#1a3038]",
        tone === "danger" && "border-[#ff5a3c] bg-[#2a1210] shadow-[4px_4px_0_#ff5a3c]",
        tone === "mint" && "border-[#7dffe1] bg-[#0c1c22] shadow-[4px_4px_0_#1d6b62]",
      )}
    >
      {kicker && <span className="text-[10px] tracking-[0.22em] text-[#f0c14a]">{kicker}</span>}
      <span className="display text-2xl leading-none">{children}</span>
    </button>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="tracking-widest text-[#f0c14a]" aria-label={`${n} stars`}>
      {"★".repeat(n)}
      <span className="text-[#3a4a44]">{"★".repeat(Math.max(0, 3 - n))}</span>
    </span>
  );
}

export function TitleScreen({
  save,
  onRide,
  onEndless,
  onMap,
  onShop,
  onCards,
  onMute,
  onNick,
}: {
  save: SaveData;
  onRide: () => void;
  onEndless: () => void;
  onMap: () => void;
  onShop: () => void;
  onCards: () => void;
  onMute: () => void;
  onNick: (name: string) => void;
}) {
  const starred = Object.values(save.stars).filter((n) => n > 0).length;
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <img
        src="/images/hero.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[72%_center]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#071014] via-[#071014]/82 to-[#071014]/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#071014] via-transparent to-[#071014]/40" />
      <div className="hazard relative h-3" />
      <header className="relative flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <div className="text-[10px] tracking-[0.32em] text-[#7dffe1]">SEOUL MIDNIGHT · COMPRESS RUN</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="border border-[#f0c14a]/60 px-2 py-1 text-[#f0c14a]">{won(save.ticketRevenue)}</span>
          <span className="border border-[#2c4a52] px-2 py-1">DEX {save.collectedCards.length}/12</span>
          <button className="border border-[#2c4a52] px-2 py-1" onClick={onMute}>
            {save.muted ? "SOUND OFF" : "SOUND ON"}
          </button>
        </div>
      </header>

      <main className="relative grid items-end gap-8 px-4 pb-24 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-16">
        <section className="max-w-xl">
          <p className="text-xs tracking-[0.35em] text-[#f0c14a]">LAST TRAIN · HUMAN TETRIS</p>
          <h1 className="display mt-2 text-[clamp(72px,12vw,132px)] leading-[0.84] text-[#f4efe6]">
            SUBWAY
            <span className="block text-[#f0c14a]">STUFFING</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[#d5e6e2] sm:text-base">
            Sling rush-hour commuters into the car before the doors close and hit 200% occupancy.
            Spend the fares at the ticket booth, meet every face in the dex.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <PanelButton kicker="CAMPAIGN" onClick={onRide}>
              STUFF THIS TRAIN
            </PanelButton>
            <PanelButton kicker="ENDLESS" tone="danger" onClick={onEndless}>
              ENDLESS RUSH
            </PanelButton>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <PanelButton tone="ghost" onClick={onMap}>
              LINE MAP
            </PanelButton>
            <PanelButton tone="ghost" onClick={onShop}>
              TICKET BOOTH
            </PanelButton>
            <PanelButton tone="mint" onClick={onCards}>
              PASSENGER DEX
            </PanelButton>
          </div>
          <ol className="mt-8 grid max-w-lg grid-cols-3 gap-2 text-xs">
            {[
              ["01", "PULL", "Drag left to draw the sling back"],
              ["02", "LAUNCH", "Aim for the gap in the doors"],
              ["03", "CRUSH", "Reach 200% before they close"],
            ].map(([n, t, d]) => (
              <li key={n} className="border border-[#2c4a52] bg-[#071014]/70 p-3">
                <div className="led text-[#f0c14a]">{n}</div>
                <div className="mt-1 font-semibold">{t}</div>
                <div className="text-[#9fb8b4]">{d}</div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="border-2 border-[#f0c14a]/80 bg-[#071014]/75 p-4 backdrop-blur-sm sm:p-5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] tracking-[0.28em] text-[#7dffe1]">PLATFORM BOARD</div>
            <div className="led text-[#3cba6a]">08:12</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="STARS" value={`${starred}/6`} />
            <Stat label="ENDLESS BEST" value={`${save.endlessMax}`} />
            <Stat label="BOARDED" value={`${save.totalBoarded}`} />
          </div>
          <label className="mt-4 block text-[10px] tracking-[0.2em] text-[#9fb8b4]">
            DISPATCHER NAME
            <input
              value={save.nickname}
              maxLength={10}
              onChange={(e) => onNick(e.target.value)}
              className="mt-1 w-full border border-[#2c4a52] bg-[#0c1c22] px-3 py-2 text-sm text-[#f4efe6] outline-none"
            />
          </label>
          <div className="mt-4">
            <div className="text-[10px] tracking-[0.22em] text-[#f0c14a]">HALL OF FAME</div>
            <ul className="mt-2 space-y-1 text-sm">
              {save.hall.map((h, i) => (
                <li key={h.name} className="flex justify-between border-b border-[#1c3338] py-1">
                  <span>
                    {i + 1}. {h.name}
                  </span>
                  <span className="led text-[#f0c14a]">{h.score}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>

      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-[#f0c14a]/40 bg-[#071014]/90 py-2">
        <div className="ticker-track text-xs text-[#f0c14a]">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex gap-12 px-6">
              {TICKER.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#1c3338] bg-[#0c1c22] px-2 py-2">
      <div className="text-[10px] text-[#9fb8b4]">{label}</div>
      <div className="led text-xl text-[#f4efe6]">{value}</div>
    </div>
  );
}

export function MapScreen({
  save,
  onBack,
  onPlay,
  onBuySpace,
}: {
  save: SaveData;
  onBack: () => void;
  onPlay: (id: string) => void;
  onBuySpace: () => void;
}) {
  return (
    <Shell title="LINE MAP" kicker="ALL STATIONS" onBack={onBack} save={save}>
      <p className="max-w-2xl text-sm text-[#c9ddd8]">
        Ride any station you like. Only Space Metro needs the Giant Suitcase broken or an Orbit Pass.
        Stars come from occupancy: 100 / 150 / 200.
      </p>
      <div className="metro-scroll relative mt-8 overflow-x-auto pb-6">
        <div className="relative flex min-w-max gap-4 px-2 pt-2">
          <div className="absolute top-[22px] right-8 left-8 h-[3px] bg-[#f0c14a]" />
          {STATIONS.map((st) => {
            const locked = st.id === "space" && !save.spaceUnlocked;
            const stars = save.stars[st.id] ?? 0;
            return (
              <article key={st.id} className="relative w-60 shrink-0">
                <div
                  className="relative z-10 mx-auto grid h-11 w-11 place-items-center rounded-full border-4 text-sm font-bold"
                  style={{
                    borderColor: st.color,
                    background: stars > 0 ? st.color : "#071014",
                    color: stars > 0 ? "#071014" : st.color,
                  }}
                >
                  {st.line}
                </div>
                <div className="mt-4 border-2 bg-[#0c1c22] p-3" style={{ borderColor: st.color }}>
                  <div className="text-[10px] tracking-[0.18em]" style={{ color: st.color }}>
                    {st.lineLabel} · {st.en}
                  </div>
                  <h3 className="display text-3xl leading-none">{st.name}</h3>
                  <div className="mt-1">
                    <Stars n={stars} />
                  </div>
                  <p className="mt-2 min-h-12 text-xs leading-relaxed text-[#c9ddd8]">{st.blurb}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Tag>DOORS {st.time.toFixed(1)}s</Tag>
                    <Tag>CAP {st.capacity}</Tag>
                    {st.poleTop > 0 && <Tag>SAFETY POLE</Tag>}
                    {st.wind > 0 && <Tag>CROSSWIND</Tag>}
                    {st.boss && <Tag>BOSS</Tag>}
                    {st.gravity < 800 && <Tag>LOW GRAVITY</Tag>}
                  </div>
                  {locked ? (
                    <button
                      className="mt-3 w-full border border-[#c86bff] px-2 py-2 text-left text-sm disabled:opacity-40"
                      disabled={save.ticketRevenue < SPACE_PASS_COST}
                      onClick={onBuySpace}
                    >
                      ORBIT PASS {won(SPACE_PASS_COST)}
                    </button>
                  ) : (
                    <button
                      className="mt-3 w-full border border-[#f0c14a] px-2 py-2 text-left text-sm"
                      onClick={() => onPlay(st.id)}
                    >
                      STUFF THIS STATION
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="border border-[#2c4a52] px-1.5 py-0.5 text-[10px] text-[#9fb8b4]">{children}</span>;
}

export function ShopScreen({
  save,
  onBack,
  onBuy,
  onBuySpace,
  onReset,
}: {
  save: SaveData;
  onBack: () => void;
  onBuy: (id: (typeof UPGRADES)[number]["id"]) => void;
  onBuySpace: () => void;
  onReset: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <Shell title="TICKET BOOTH" kicker="FARE MACHINE" onBack={onBack} save={save}>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="border-4 border-[#24383e] bg-[#0b181c] p-4">
          <div className="text-[10px] tracking-[0.22em] text-[#7dffe1]">FARE BALANCE</div>
          <div className="led mt-1 bg-[#04140c] px-3 py-4 text-3xl text-[#7dffb2]">{won(save.ticketRevenue)}</div>
          <p className="mt-3 text-xs leading-relaxed text-[#9fb8b4]">
            Every successful boarding pays out here. Compression is what gets you past 200%.
          </p>
          <CompressDemo level={save.compress} />
          <button
            className="mt-4 text-xs text-[#6f8d88] underline"
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              onReset();
            }}
          >
            {armed ? "THIS DELETES YOUR PROGRESS" : "RESET PROGRESS"}
          </button>
        </aside>
        <div className="space-y-3">
          {UPGRADES.map((up) => {
            const level = save[up.id];
            const maxed = level >= up.max;
            const cost = up.costs[level] ?? 0;
            const poor = save.ticketRevenue < cost;
            return (
              <div key={up.id} className="flex flex-wrap items-center gap-3 border border-[#2c4a52] bg-[#0c1c22] p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] tracking-[0.2em] text-[#f0c14a]">{up.kicker}</div>
                  <div className="text-lg font-semibold">{up.name}</div>
                  <p className="text-xs text-[#c9ddd8]">{up.desc}</p>
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: up.max }, (_, i) => (
                      <span key={i} className={cn("h-2 w-6", i < level ? "bg-[#f0c14a]" : "bg-[#1c3338]")} />
                    ))}
                  </div>
                </div>
                <button
                  disabled={maxed || poor}
                  onClick={() => onBuy(up.id)}
                  className="border border-[#f0c14a] px-3 py-2 text-sm disabled:opacity-40"
                >
                  {maxed ? "MAX LEVEL" : poor ? won(cost) : `BUY ${won(cost)}`}
                </button>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3 border border-[#c86bff] bg-[#140c1c] p-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] tracking-[0.2em] text-[#c86bff]">ORBIT PASS</div>
              <div className="text-lg font-semibold">Orbit Pass</div>
              <p className="text-xs text-[#c9ddd8]">Opens the Space Metro line. Beat the Giant Suitcase at Seoul Station and it unlocks too.</p>
            </div>
            <button
              disabled={save.spaceUnlocked || save.ticketRevenue < SPACE_PASS_COST}
              onClick={onBuySpace}
              className="border border-[#c86bff] px-3 py-2 text-sm disabled:opacity-40"
            >
              {save.spaceUnlocked ? "OWNED" : `BUY ${won(SPACE_PASS_COST)}`}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function CompressDemo({ level }: { level: number }) {
  const overlap = [6, 16, 26, 36, 44, 52][level] ?? 6;
  return (
    <div className="relative mx-auto mt-4 h-24 w-44">
      <div className="absolute top-3 left-2 h-16 w-16 rounded-full border-2 border-[#f4efe6] bg-[#243e86]" />
      <div
        className="absolute top-3 h-16 w-16 rounded-full border-2 border-[#f4efe6] bg-[#d4654a]"
        style={{ left: 72 - overlap }}
      />
      <div className="absolute right-0 bottom-0 text-[10px] text-[#9fb8b4]">
        OVERLAP {Math.round(compressOf(level) * 100)}%
      </div>
    </div>
  );
}

export function CardsScreen({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const picked = open ? PASSENGERS[open] : null;
  const owned = new Set(save.collectedCards);
  return (
    <Shell title="PASSENGER DEX" kicker="KNOWN FACES" onBack={onBack} save={save}>
      <p className="text-sm text-[#c9ddd8]">A face gets stamped only after you land it successfully. Everyone else is still a blank card.</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {CARD_ORDER.map((id) => {
          const p = PASSENGERS[id];
          const has = owned.has(id);
          return (
            <button
              key={id}
              onClick={() => setOpen(id)}
              className={cn(
                "overflow-hidden border-2 bg-[#0c1c22] text-left",
                p.rarity === "legendary" && "border-[#f0c14a]",
                p.rarity === "rare" && "border-[#7dffe1]",
                p.rarity === "common" && "border-[#2c4a52]",
              )}
            >
              <div className="relative aspect-square bg-[#14181e]">
                {has && p.image ? (
                  <img
                    src={p.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center" style={{ background: has ? p.suit : "#101418" }}>
                    <span className={cn("display text-5xl", has ? "text-[#f4efe6]" : "text-[#2c4a52]")}>
                      {has ? p.name.slice(0, 1) : "?"}
                    </span>
                  </div>
                )}
                {!has && <div className="absolute inset-0 bg-[#071014]/35" />}
              </div>
              <div className="p-2">
                <div className="text-[10px] tracking-widest text-[#f0c14a]">{p.rarity}</div>
                <div className="font-semibold">{has ? p.name : "UNSEEN"}</div>
                <div className="text-[11px] text-[#9fb8b4]">{has ? p.role : p.hint}</div>
              </div>
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-[#071014]/75 p-4" onClick={() => setOpen(null)}>
          <div className="grid w-full max-w-lg gap-4 border-2 border-[#f0c14a] bg-[#0c1c22] p-4 sm:grid-cols-[180px_1fr]" onClick={(e) => e.stopPropagation()}>
            <div className="aspect-square overflow-hidden bg-[#14181e]">
              {owned.has(picked.id) && picked.image ? (
                <img src={picked.image} alt="" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center display text-6xl text-[#2c4a52]">?</div>
              )}
            </div>
            <div>
              <div className="text-[10px] tracking-[0.22em] text-[#f0c14a]">{picked.rarity}</div>
              <h3 className="display text-4xl">{owned.has(picked.id) ? picked.name : "UNRECORDED"}</h3>
              <p className="text-sm text-[#c9ddd8]">{owned.has(picked.id) ? picked.blurb : picked.hint}</p>
              <div className="mt-3 space-y-2 text-xs">
                <Bar label="MASS" value={picked.mass / 2.6} />
                <Bar label="SIZE" value={picked.scale / 1.4} />
                <Bar label="FARE VALUE" value={picked.fareWeight / 1.9} />
              </div>
              <div className="mt-3 text-xs text-[#9fb8b4]">Counts as {picked.countAs || "—"} · {picked.role}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#9fb8b4]">{picked.hint}</p>
              <button className="mt-4 border border-[#2c4a52] px-3 py-1 text-sm" onClick={() => setOpen(null)}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[#9fb8b4]">
        <span>{label}</span>
      </div>
      <div className="h-1.5 bg-[#1c3338]">
        <div className="h-full bg-[#f0c14a]" style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
    </div>
  );
}

export function ResultsScreen({
  result,
  save,
  doubled,
  adBusy,
  onWatchAd,
  onRetry,
  onMap,
  onShop,
  onNext,
}: {
  result: RunResult;
  save: SaveData;
  doubled: boolean;
  adBusy: boolean;
  onWatchAd: () => void;
  onRetry: () => void;
  onMap: () => void;
  onShop: () => void;
  onNext?: () => void;
}) {
  const [shown, setShown] = useState(0);
  const [copied, setCopied] = useState(false);
  const station = stationById(result.stationId === "endless" ? "sindorim" : result.stationId);
  const titleStation = result.mode === "endless" ? "ENDLESS RUSH" : station.name;

  useEffect(() => {
    audio.ensure();
    if (result.mode === "endless") audio.play(result.capped || result.peak >= 12 ? "fanfare" : result.spill ? "fail" : "coin");
    else if (result.stars >= 2) audio.play("fanfare");
    else if (result.stars === 0) audio.play("fail");
    else audio.play("coin");
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / 900);
      setShown(Math.round(result.revenue * (1 - Math.pow(1 - u, 3))));
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result]);

  const verdict =
    result.mode === "endless"
      ? result.capped
        ? "The train surrendered. You are a permanent compression engineer."
        : result.spill
          ? "Someone already aboard got launched back onto the platform."
          : "Self-evacuated. The record stands."
      : result.stationId === "seoul" && !result.bossBroken
        ? "The suitcase won. Hit those zips harder."
        : result.stars >= 3
          ? "The legal capacity was only a suggestion."
          : result.stars === 2
            ? "Overcrowded. The crew looked away."
            : result.stars === 1
              ? "Capacity met. 200% waits for the next train."
              : result.boarded === 0
                ? "Doors closed. So did the commute."
                : "Half of them are still on the platform.";

  return (
    <div className="min-h-dvh bg-[#071014] px-4 py-6 text-[#f4efe6]">
      <div className="mx-auto grid max-w-5xl items-start gap-6 lg:grid-cols-[340px_1fr]">
        <article className="receipt relative px-5 pt-5 pb-8">
          <div className="perforation absolute inset-x-0 top-0 h-3" />
          <div className="mt-2 text-center">
            <div className="text-[10px] tracking-[0.28em]">HELL METRO</div>
            <div className="display text-3xl text-[#1c140e]">BOARDING RECEIPT</div>
            <div className="text-xs">{titleStation} · 08:12</div>
          </div>
          <div className="my-3 border-t border-dashed border-[#1c140e]/40" />
          <ReceiptRow k="MODE" v={result.mode === "endless" ? "ENDLESS RUSH" : "CAMPAIGN"} />
          <ReceiptRow k="BOARDED" v={`${result.boarded}`} />
          {result.mode === "campaign" && (
            <>
              <ReceiptRow k="WEIGHTED LOAD" v={`${result.weighted}`} />
              <ReceiptRow k="OFFICIAL CAP" v={`${result.capacity}`} />
              <ReceiptRow k="OCCUPANCY" v={`${Math.round(result.occupancy)}%`} />
              <ReceiptRow k="EJECTED" v={`${result.yeeted}`} />
              <ReceiptRow k="SEATED" v={`${result.seated}`} />
            </>
          )}
          {result.mode === "endless" && (
            <>
              <ReceiptRow k="PEAK" v={`${result.peak}`} />
              <ReceiptRow k="WAVES SURVIVED" v={`${result.wave}`} />
              <ReceiptRow k="RANK" v={rankTitle(result.peak)} />
            </>
          )}
          <ReceiptRow k="BEST COMBO" v={`x${result.comboMax}`} />
          {result.perfect && <ReceiptRow k="NO INCIDENT" v="+15%" />}
          {result.bossBroken && <ReceiptRow k="CASE BONUS" v={won(500)} />}
          <div className="my-3 border-t border-dashed border-[#1c140e]/40" />
          <div className="flex items-end justify-between">
            <span className="text-sm">TOTAL FARE</span>
            <span className="display text-4xl">{won(shown)}</span>
          </div>
          <p className="mt-4 text-center text-[11px]">* Do not fight the doors. We stuff. *</p>
        </article>

        <section>
          <div className="text-[10px] tracking-[0.28em] text-[#7dffe1]">SETTLEMENT</div>
          <h2 className="display text-5xl leading-none sm:text-6xl">
            {result.mode === "endless" ? (
              <>
                {result.peak}
                <span className="text-2xl text-[#f0c14a]">aboard</span>
              </>
            ) : (
              <span className={result.occupancy >= 200 ? "text-[#f0c14a]" : ""}>{Math.round(result.occupancy)}%</span>
            )}
          </h2>
          <p className="mt-3 max-w-lg text-[#d5e6e2]">{verdict}</p>
          {result.mode === "campaign" && (
            <div className="mt-4 flex gap-2">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={cn(
                    "grid h-16 w-16 place-items-center border-2 text-2xl",
                    n <= result.stars ? "stamp-in border-[#f0c14a] text-[#f0c14a]" : "border-[#2c4a52] text-[#2c4a52]",
                  )}
                  style={{ animationDelay: `${n * 0.12}s` }}
                >
                  ★
                </div>
              ))}
            </div>
          )}
          {result.newCards.length > 0 && (
            <div className="mt-5">
              <div className="text-[10px] tracking-[0.22em] text-[#f0c14a]">NEW CARDS</div>
              <div className="mt-2 flex gap-2">
                {result.newCards.map((id) => {
                  const p = PASSENGERS[id];
                  if (!p) return null;
                  return (
                    <div key={id} className="w-20 border border-[#f0c14a] bg-[#0c1c22]">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div className="grid aspect-square place-items-center display text-2xl" style={{ background: p.suit }}>
                          {p.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="px-1 py-1 text-[11px]">{p.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {result.revenue > 0 &&
              (doubled ? (
                <div className="mt-6 border border-[#f0c14a] bg-[#0c1c22] px-4 py-3 text-sm text-[#f0c14a]">
                  Done. That ad doubled your fare: {won(result.revenue * 2)}
                </div>
              ) : (
                <button
                  className="mt-6 w-full border-2 border-[#7dffe1] bg-[#0c1c22] px-4 py-3 text-sm font-bold text-[#7dffe1] disabled:opacity-50"
                  disabled={adBusy}
                  onClick={onWatchAd}
                >
                  AD · {adBusy ? "LOADING..." : `DOUBLE YOUR FARE (+${won(result.revenue)})`}
                </button>
              ))}
          <div className="mt-6 flex flex-wrap gap-2">
            <PanelButton kicker="AGAIN" onClick={onRetry}>
              ONE MORE RUN
            </PanelButton>
            {onNext && (
              <PanelButton kicker="NEXT" tone="mint" onClick={onNext}>
                NEXT STATION
              </PanelButton>
            )}
            <PanelButton tone="ghost" onClick={onMap}>
              LINE MAP
            </PanelButton>
            <PanelButton tone="ghost" onClick={onShop}>
              TICKET BOOTH
            </PanelButton>
          </div>
          <button
            className="mt-4 text-xs text-[#9fb8b4] underline"
            onClick={async () => {
              const text =
                result.mode === "endless"
                  ? `Subway Stuffing — Endless ${result.peak} aboard, ${rankTitle(result.peak)}`
                  : `Subway Stuffing — ${titleStation} occupancy ${Math.round(result.occupancy)}%`;
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "COPIED" : "COPY SCORE TEXT"}
          </button>
          {result.mode === "endless" && (
            <p className="mt-3 text-xs text-[#9fb8b4]">Personal best {save.endlessMax} aboard · {rankTitle(save.endlessMax)}</p>
          )}
        </section>
      </div>
    </div>
  );
}

function ReceiptRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-sm">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Shell({
  title,
  kicker,
  onBack,
  save,
  children,
}: {
  title: string;
  kicker: string;
  onBack: () => void;
  save: SaveData;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#071014] text-[#f4efe6]">
      <div className="hazard h-2" />
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <button className="border border-[#2c4a52] px-3 py-1 text-sm" onClick={onBack}>
          ← TITLE
        </button>
        <div className="text-right">
          <div className="text-[10px] tracking-[0.22em] text-[#7dffe1]">{kicker}</div>
          <div className="led text-[#f0c14a]">{won(save.ticketRevenue)}</div>
        </div>
      </header>
      <div className="px-4 pb-12 sm:px-8">
        <h2 className="display text-5xl leading-none">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function nextStationId(current: string, save: SaveData) {
  const idx = STATIONS.findIndex((s) => s.id === current);
  const next = STATIONS[idx + 1] as StationDef | undefined;
  if (!next) return null;
  if (next.id === "space" && !save.spaceUnlocked) return null;
  return next.id;
}
