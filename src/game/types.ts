export type Mode = "campaign" | "endless";

export type Screen = "title" | "map" | "shop" | "cards" | "play" | "results";

export type Sfx =
  | "launch"
  | "slap"
  | "slam"
  | "beep"
  | "coin"
  | "zip"
  | "burst"
  | "yeet"
  | "ui"
  | "warn"
  | "chime"
  | "fanfare"
  | "fail";

export type HairStyle =
  | "short"
  | "bob"
  | "bun"
  | "topknot"
  | "helmet"
  | "visor"
  | "beanie"
  | "messy"
  | "cat"
  | "hat";

export type Extra =
  | "none"
  | "tie"
  | "loose-tie"
  | "glasses"
  | "briefcase"
  | "backpack"
  | "scarf"
  | "lightstick"
  | "camera";

export type Face =
  | "tired"
  | "anxious"
  | "smug"
  | "fierce"
  | "sparkle"
  | "grin"
  | "calm"
  | "visor";

export type Rarity = "common" | "rare" | "legendary";

export interface PassengerDef {
  id: string;
  name: string;
  role: string;
  mass: number;
  scale: number;
  fareWeight: number;
  countAs: number;
  bouncy: number;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  suit: string;
  suit2: string;
  pants: string;
  shoe: string;
  extra: Extra;
  face: Face;
  rarity: Rarity;
  blurb: string;
  bark: string[];
  hint: string;
  image?: string;
}

export interface StationDef {
  id: string;
  name: string;
  en: string;
  line: string;
  lineLabel: string;
  color: string;
  time: number;
  capacity: number;
  queue: number;
  fare: number;
  doorTop: number;
  gravity: number;
  wind: number;
  boss: boolean;
  poleTop: number;
  pool: { id: string; w: number }[];
  blurb: string;
  announce: string;
  ads: [string, string];
}

export interface Upgrades {
  compress: number;
  sling: number;
  fare: number;
  delay: number;
  grease: number;
}

export interface HallEntry {
  name: string;
  score: number;
}

export interface SaveData {
  v: 1;
  ticketRevenue: number;
  compress: number;
  sling: number;
  fare: number;
  delay: number;
  grease: number;
  collectedCards: string[];
  endlessMax: number;
  stars: Record<string, number>;
  seenIntro: boolean;
  spaceUnlocked: boolean;
  bossBroken: boolean;
  hall: HallEntry[];
  totalBoarded: number;
  runs: number;
  muted: boolean;
  nickname: string;
}

export interface RunResult {
  mode: Mode;
  stationId: string;
  boarded: number;
  weighted: number;
  capacity: number;
  occupancy: number;
  revenue: number;
  stars: number;
  yeeted: number;
  missed: number;
  comboMax: number;
  seated: number;
  newCards: string[];
  wave: number;
  peak: number;
  bossBroken: boolean;
  spill: boolean;
  capped: boolean;
  launches: number;
  perfect: boolean;
}
