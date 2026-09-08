import type { Profile, Weapon, MapId, Input, World } from './engine';
export type RoomInfo = {
  code: string;
  host: boolean;
  map: MapId;
  seed: string;
  days: number;
};
export type RoomSummary = {
  code: string;
  name: string;
  map: MapId;
  days: number;
  count: number;
};
export type SavedSeed = {
  id: string;
  seed: string;
  map: MapId;
  name: string;
  best: number;
  created: number;
};
export type LobbyMember = Profile & {
  weapon: Weapon;
  input: Input;
  updated: number;
  online: boolean;
};
type Results = {
  profile: { profile: Profile };
  name: { ok: boolean };
  purchase: { profile: Profile };
  list: { rooms: RoomSummary[] };
  create: RoomInfo;
  join: RoomInfo;
  lobby: {
    status: string;
    map: MapId;
    seed: string;
    days: number;
    players: LobbyMember[];
    snapshot: World | null;
  };
  seeds: { seeds: SavedSeed[] };
  'seed-save': { seeds: SavedSeed[] };
  'seed-delete': { seeds: SavedSeed[] };
  sync: Results['lobby'];
  leave: { ok: boolean };
  'solo-reward': { profile: Profile };
  claim: { profile: Profile };
};
export async function api<K extends keyof Results>(
  action: K,
  data: Record<string, unknown> = {},
): Promise<Results[K]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
      signal: controller.signal,
    });
    const value = (await response.json()) as Results[K] & { error?: string };
    if (!response.ok) throw new Error(value.error || 'เชื่อมต่อไม่สำเร็จ');
    return value;
  } finally {
    clearTimeout(timer);
  }
}
