import { useEffect, useRef, useState } from "react";
import type { AdKind } from "../game/ads";

export interface AdState {
  kind: AdKind;
  done: (ok: boolean) => void;
}

/** Mock ad screen used when no real portal SDK is present. */
export default function AdOverlay({ kind, onDone }: { kind: AdKind; onDone: (ok: boolean) => void }) {
  const total = kind === "rewarded" ? 3 : 2;
  const [left, setLeft] = useState(total);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);

  useEffect(() => {
    if (left <= 0) {
      if (!finished.current) {
        finished.current = true;
        doneRef.current(true);
      }
      return;
    }
    const id = window.setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/95 text-center text-white">
      <div className="rounded-full border border-white/30 px-3 py-1 text-xs tracking-widest text-white/60">
        AD · MOCK
      </div>
      <div className="text-6xl">🚇</div>
      <div className="text-2xl font-bold">AD IN PROGRESS...</div>
      <div className="text-5xl font-black tabular-nums text-amber-300">{Math.max(left, 0)}</div>
      <button
        onClick={() => {
          if (finished.current) return;
          finished.current = true;
          doneRef.current(false);
        }}
        className="mt-2 rounded-lg border border-white/30 px-4 py-2 text-sm text-white/70"
      >
        SKIP (FORFEIT REWARD)
      </button>
    </div>
  );
}