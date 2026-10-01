import type { HallEntry, RunResult, SaveData } from "./types";

const KEY = "hellmetro-save-v1";

export const SEED_HALL: HallEntry[] = [
  { name: "Manager Kim", score: 19 },
  { name: "Parasocial Club", score: 16 },
  { name: "Line 2 Ghost", score: 13 },
  { name: "Late Fairy", score: 8 },
  { name: "Door Gap Master", score: 6 },
];

export function defaultSave(): SaveData {
  return {
    v: 1,
    ticketRevenue: 0,
    compress: 0,
    sling: 0,
    fare: 0,
    delay: 0,
    grease: 0,
    collectedCards: [],
    endlessMax: 0,
    stars: {},
    seenIntro: false,
    spaceUnlocked: false,
    bossBroken: false,
    hall: SEED_HALL.map((h) => ({ ...h })),
    totalBoarded: 0,
    runs: 0,
    muted: false,
    nickname: "Dispatcher",
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...defaultSave(),
      ...parsed,
      v: 1,
      stars: parsed.stars ?? {},
      collectedCards: parsed.collectedCards ?? [],
      hall: parsed.hall?.length ? parsed.hall : SEED_HALL.map((h) => ({ ...h })),
    };
  } catch {
    return defaultSave();
  }
}

export function persistSave(save: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode / sandbox */
  }
}

export function insertHall(hall: HallEntry[], name: string, score: number) {
  const prev = hall.find((h) => h.name === name)?.score ?? 0;
  const best = Math.max(prev, score);
  const next = hall.filter((h) => h.name !== name);
  next.push({ name, score: best });
  next.sort((a, b) => b.score - a.score);
  return next.slice(0, 6);
}

export function applyResult(save: SaveData, result: RunResult): SaveData {
  const cards = new Set(save.collectedCards);
  for (const id of result.newCards) cards.add(id);
  if (result.bossBroken) cards.add("luggage");
  const stars = { ...save.stars };
  if (result.mode === "campaign") {
    stars[result.stationId] = Math.max(stars[result.stationId] ?? 0, result.stars);
  }
  const nickname = save.nickname.trim() || "Dispatcher";
  return {
    ...save,
    ticketRevenue: save.ticketRevenue + result.revenue,
    collectedCards: [...cards],
    stars,
    endlessMax: result.mode === "endless" ? Math.max(save.endlessMax, result.peak) : save.endlessMax,
    hall: result.mode === "endless" ? insertHall(save.hall, nickname, result.peak) : save.hall,
    spaceUnlocked: save.spaceUnlocked || result.bossBroken,
    bossBroken: save.bossBroken || result.bossBroken,
    totalBoarded: save.totalBoarded + result.boarded,
    runs: save.runs + 1,
  };
}
