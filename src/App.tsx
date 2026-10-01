import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdOverlay, { type AdState } from "./components/AdOverlay";
import { GameView } from "./components/GameView";
import { CardsScreen, MapScreen, ResultsScreen, ShopScreen, TitleScreen, nextStationId } from "./components/Screens";
import { Ads, registerAdUI } from "./game/ads";
import { audio } from "./game/audio";
import { ENDLESS_STATION, SPACE_PASS_COST, UPGRADES, stationById } from "./game/content";
import { applyResult, defaultSave, loadSave, persistSave } from "./game/save";
import type { Mode, RunResult, SaveData, Screen } from "./game/types";

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [screen, setScreen] = useState<Screen>("title");
  const [stationId, setStationId] = useState("sindorim");
  const [mode, setMode] = useState<Mode>("campaign");
  const [result, setResult] = useState<RunResult | null>(null);
  const [session, setSession] = useState(1);
  const [ad, setAd] = useState<AdState | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const [doubled, setDoubled] = useState(false);
  const sessionRef = useRef(1);

  // Portal SDK init + mock ad UI registration
  useEffect(() => {
    registerAdUI((kind, done) => setAd({ kind, done }));
    void Ads.init().then(() => Ads.loadingFinished());
    return () => registerAdUI(null);
  }, []);

  useEffect(() => {
    persistSave(save);
  }, [save]);

  useEffect(() => {
    audio.setMuted(save.muted);
  }, [save.muted]);

  // Rewarded ad: double the result revenue
  const watchDouble = useCallback(async () => {
    if (!result || doubled || adBusy) return;
    setAdBusy(true);
    try {
      if (await Ads.rewardedBreak()) {
        setSave((s) => ({ ...s, ticketRevenue: s.ticketRevenue + result.revenue }));
        setDoubled(true);
        audio.play("coin");
      }
    } finally {
      setAdBusy(false);
    }
  }, [result, doubled, adBusy]);

  const upgrades = useMemo(
    () => ({
      compress: save.compress,
      sling: save.sling,
      fare: save.fare,
      delay: save.delay,
      grease: save.grease,
    }),
    [save.compress, save.sling, save.fare, save.delay, save.grease],
  );

  function bootAudio() {
    audio.ensure();
    audio.play("ui");
  }

  function ride(id: string, nextMode: Mode) {
    bootAudio();
    setStationId(id);
    setMode(nextMode);
    setSession((n) => n + 1);
    sessionRef.current += 1;
    setDoubled(false);
    setScreen("play");
    Ads.gameplayStart();
  }

  /** Interstitial only at the rest point between runs (every 2nd run) */
  async function leaveTo(next: () => void) {
    if (sessionRef.current > 1 && sessionRef.current % 2 === 0) {
      await Ads.commercialBreak();
    }
    Ads.gameplayStop();
    next();
  }

  function buy(id: (typeof UPGRADES)[number]["id"]) {
    const up = UPGRADES.find((u) => u.id === id);
    if (!up) return;
    const level = save[id];
    if (level >= up.max) return;
    const cost = up.costs[level] ?? 0;
    if (save.ticketRevenue < cost) return;
    bootAudio();
    audio.play("coin");
    setSave((s) => ({ ...s, ticketRevenue: s.ticketRevenue - cost, [id]: level + 1 }));
  }

  function buySpace() {
    if (save.spaceUnlocked || save.ticketRevenue < SPACE_PASS_COST) return;
    bootAudio();
    audio.play("coin");
    setSave((s) => ({ ...s, ticketRevenue: s.ticketRevenue - SPACE_PASS_COST, spaceUnlocked: true }));
  }

  const station = mode === "endless" ? ENDLESS_STATION : stationById(stationId);
  const nextId = result && result.mode === "campaign" && result.stars >= 1 ? nextStationId(result.stationId, save) : null;

  return (
    <>
      {screen === "title" && (
        <TitleScreen
          save={save}
          onRide={() => {
            const order = ["sindorim", "gangnam", "hongdae", "sadang", "seoul", "space"];
            const pending = order.find((id) => {
              if (id === "space" && !save.spaceUnlocked) return false;
              return !(save.stars[id] > 0);
            });
            ride(pending ?? "sindorim", "campaign");
          }}
          onEndless={() => ride("endless", "endless")}
          onMap={() => {
            bootAudio();
            setScreen("map");
          }}
          onShop={() => {
            bootAudio();
            setScreen("shop");
          }}
          onCards={() => {
            bootAudio();
            setScreen("cards");
          }}
          onMute={() => setSave((s) => ({ ...s, muted: !s.muted }))}
          onNick={(nickname) => setSave((s) => ({ ...s, nickname }))}
        />
      )}
      {screen === "map" && (
        <MapScreen
          save={save}
          onBack={() => setScreen("title")}
          onPlay={(id) => ride(id, "campaign")}
          onBuySpace={buySpace}
        />
      )}
      {screen === "shop" && (
        <ShopScreen
          save={save}
          onBack={() => setScreen("title")}
          onBuy={buy}
          onBuySpace={buySpace}
          onReset={() => setSave({ ...defaultSave(), muted: save.muted })}
        />
      )}
      {screen === "cards" && <CardsScreen save={save} onBack={() => setScreen("title")} />}
      {screen === "play" && (
        <GameView
          key={session}
          station={station}
          mode={mode}
          upgrades={upgrades}
          owned={save.collectedCards}
          seenIntro={save.seenIntro}
          muted={save.muted}
          onIntroSeen={() => setSave((s) => (s.seenIntro ? s : { ...s, seenIntro: true }))}
          onComplete={(r) => {
            setSave((s) => applyResult(s, r));
            setResult(r);
            setDoubled(false);
            setScreen("results");
            Ads.gameplayStop();
          }}
          onExit={() => {
            Ads.gameplayStop();
            setScreen(mode === "endless" ? "title" : "map");
          }}
          onToggleMute={() => setSave((s) => ({ ...s, muted: !s.muted }))}
        />
      )}
      {screen === "results" && result && (
        <ResultsScreen
          result={result}
          save={save}
          doubled={doubled}
          adBusy={adBusy}
          onWatchAd={watchDouble}
          onRetry={() => ride(result.mode === "endless" ? "endless" : result.stationId, result.mode)}
          onMap={() => void leaveTo(() => setScreen("map"))}
          onShop={() => void leaveTo(() => setScreen("shop"))}
          onNext={nextId ? () => ride(nextId, "campaign") : undefined}
        />
      )}
      {ad && (
        <AdOverlay
          kind={ad.kind}
          onDone={(ok: boolean) => {
            setAd(null);
            ad.done(ok);
          }}
        />
      )}
    </>
  );
}
