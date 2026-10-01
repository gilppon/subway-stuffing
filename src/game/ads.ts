// Portal ad bridge (Poki / CrazyGames / mock auto-detect).
// Any failure or block falls back on a timeout so gameplay never stalls.
/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    PokiSDK?: any;
    CrazyGames?: any;
  }
}

export type AdKind = "commercial" | "rewarded";
type AdUI = (kind: AdKind, done: (ok: boolean) => void) => void;

const POKI_URL = "https://game-cdn.poki.com/scripts/v2/poki-sdk.js";
const CRAZY_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js";

let adUI: AdUI | null = null;
let provider: "poki" | "crazy" | null = null;
let ready = false;
let initPromise: Promise<void> | null = null;

export function registerAdUI(fn: AdUI | null) {
  adUI = fn;
}

function env(): "poki" | "crazy" | null {
  try {
    const host = window.location.hostname;
    const q = window.location.search;
    if (/poki(-gdn)?\.com$/.test(host) || q.includes("poki")) return "poki";
    if (/(^|\.)crazygames\.com$/.test(host) || q.includes("crazy")) return "crazy";
  } catch {
    /* ignore */
  }
  return null;
}

function loadScript(src: string, timeout = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    const timer = window.setTimeout(() => reject(new Error("sdk timeout")), timeout);
    s.src = src;
    s.async = true;
    s.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    s.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("sdk load error"));
    };
    document.head.appendChild(s);
  });
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), ms))]);
}

export const Ads = {
  get provider() {
    return provider;
  },

  init(): Promise<void> {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const e = env();
      try {
        if (e === "poki") {
          await withTimeout(loadScript(POKI_URL), 5000, undefined as never).catch(() => {});
          await withTimeout(window.PokiSDK?.init() ?? Promise.resolve(), 5000, undefined);
          if (window.PokiSDK) provider = "poki";
        } else if (e === "crazy") {
          await withTimeout(loadScript(CRAZY_URL), 5000, undefined as never).catch(() => {});
          await withTimeout(window.CrazyGames?.SDK?.init() ?? Promise.resolve(), 5000, undefined);
          if (window.CrazyGames?.SDK) {
            provider = "crazy";
            try {
              window.CrazyGames.SDK.game.loadingStart();
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        provider = null;
      }
      ready = true;
    })();
    return withTimeout(initPromise, 8000, undefined);
  },

  loadingFinished() {
    if (!ready) return;
    try {
      if (provider === "poki") window.PokiSDK?.gameLoadingFinished?.();
      else if (provider === "crazy") window.CrazyGames?.SDK?.game?.loadingStop();
    } catch {
      /* ignore */
    }
  },

  gameplayStart() {
    if (!ready) return;
    try {
      if (provider === "poki") window.PokiSDK?.gameplayStart?.();
      else if (provider === "crazy") window.CrazyGames?.SDK?.game?.gameplayStart();
    } catch {
      /* ignore */
    }
  },

  gameplayStop() {
    if (!ready) return;
    try {
      if (provider === "poki") window.PokiSDK?.gameplayStop?.();
      else if (provider === "crazy") window.CrazyGames?.SDK?.game?.gameplayStop();
    } catch {
      /* ignore */
    }
  },

  async commercialBreak(): Promise<void> {
    if (provider === "poki" && ready) {
      try {
        await withTimeout(window.PokiSDK.commercialBreak(), 10000, undefined);
      } catch {
        /* ignore */
      }
      return;
    }
    if (provider === "crazy" && ready) {
      try {
        await withTimeout(
          window.CrazyGames?.SDK?.ad?.requestAd("midgame", {
            adStarted: () => {},
            adFinished: () => {},
            adError: () => {},
          }),
          10000,
          undefined,
        );
      } catch {
        /* ignore */
      }
      return;
    }
    if (!adUI) return;
    await withTimeout(new Promise<void>((r) => adUI!("commercial", () => r())), 8000, undefined);
  },

  async rewardedBreak(): Promise<boolean> {
    if (provider === "poki" && ready) {
      try {
        return Boolean(await withTimeout(window.PokiSDK.rewardedBreak(), 15000, false));
      } catch {
        return false;
      }
    }
    if (provider === "crazy" && ready) {
      try {
        let ok = false;
        await withTimeout(
          window.CrazyGames?.SDK?.ad?.requestAd("rewarded", {
            adStarted: () => {},
            adFinished: () => {
              ok = true;
            },
            adError: () => {
              ok = false;
            },
          }),
          20000,
          undefined,
        );
        return ok;
      } catch {
        return false;
      }
    }
    if (!adUI) return false;
    return withTimeout(new Promise<boolean>((r) => adUI!("rewarded", (ok) => r(ok))), 20000, false);
  },
};