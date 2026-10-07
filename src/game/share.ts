import { ENDLESS_STATION, STATIONS } from './content';
import type { Mode, RunResult } from './types';

export interface SubwayChallenge {
  mode: Mode;
  stationId: string;
  boarded: number;
  occupancy: number;
  peak: number;
  combo: number;
}

function param(key: string): string | null {
  const params = new URLSearchParams(window.location.search);
  return window.PokiSDK?.getURLParam?.(key) || params.get(key) || params.get(`gd${key}`);
}

export function readSubwayChallenge(): SubwayChallenge | null {
  if (param('type') !== 'subway_challenge') return null;
  const mode = param('mode');
  const requestedStation = param('station');
  const stationId = mode === 'endless' ? ENDLESS_STATION.id : requestedStation;
  if ((mode !== 'campaign' && mode !== 'endless') || !stationId) return null;
  if (mode === 'campaign' && !STATIONS.some((station) => station.id === stationId)) return null;
  const number = (key: string) => {
    const value = Number(param(key));
    return Number.isFinite(value) ? value : 0;
  };
  return { mode: mode as Mode, stationId, boarded: number('boarded'), occupancy: number('occupancy'), peak: number('peak'), combo: number('combo') };
}

export async function createSubwayShareUrl(result: RunResult): Promise<string> {
  const params = {
    type: 'subway_challenge',
    mode: result.mode,
    station: result.mode === 'endless' ? ENDLESS_STATION.id : result.stationId,
    boarded: String(result.boarded),
    occupancy: String(Math.round(result.occupancy)),
    peak: String(result.peak),
    combo: String(result.comboMax),
  };
  try {
    const url = await window.PokiSDK?.shareableURL?.(params);
    if (url) return url;
  } catch {
    // Retain a working fallback when the Poki SDK is not available.
  }
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}
