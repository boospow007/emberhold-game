// Deterministic world generation from a seed string.
// Heights are never serialized: every client regenerates them from
// (seed, map) and caches the result, so co-op snapshots stay small.
export type MapId = 'forest' | 'desert' | 'snow';
export type ObstacleKind = 'tree' | 'rock' | 'ore';
export type Obstacle = {
  id: number;
  x: number;
  z: number;
  r: number;
  kind: ObstacleKind;
  wood: number;
};
export type CellKind = 'water' | 'plain' | 'hill' | 'mountain';
export const HALF = 56;
export const SIZE = HALF * 2 + 1;
export const WATER_LEVEL = 0.32;
export const HILL_LEVEL = 0.58;
export const MOUNTAIN_LEVEL = 0.72;
const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomSeed() {
  const v = crypto.getRandomValues(new Uint32Array(8));
  return Array.from(v, (n) => SEED_CHARS[n % SEED_CHARS.length]).join('');
}
export function normalizeSeed(s: string) {
  const clean = (s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return clean.length >= 3 ? clean : '';
}
export function weeklySeed(date = new Date()) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - first.getTime()) / 86400000 -
        3 +
        ((first.getUTCDay() + 6) % 7)) /
        7,
    );
  return `WK${String(d.getUTCFullYear()).slice(2)}${String(week).padStart(2, '0')}`;
}
export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function lattice(seed: number) {
  const cache = new Map<number, number>();
  return (ix: number, iz: number) => {
    const key = ix * 100003 + iz;
    let v = cache.get(key);
    if (v === undefined) {
      v = rng(hashString(seed + ':' + ix + ':' + iz))();
      cache.set(key, v);
    }
    return v;
  };
}
function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
function noise(
  l: (x: number, z: number) => number,
  x: number,
  z: number,
  scale: number,
) {
  const fx = x / scale,
    fz = z / scale,
    ix = Math.floor(fx),
    iz = Math.floor(fz),
    tx = smooth(fx - ix),
    tz = smooth(fz - iz);
  const a = l(ix, iz),
    b = l(ix + 1, iz),
    c = l(ix, iz + 1),
    d = l(ix + 1, iz + 1);
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}
export type Terrain = {
  seed: string;
  map: MapId;
  heights: Float32Array;
  index: (x: number, z: number) => number;
  h: (x: number, z: number) => number;
  y: (x: number, z: number) => number;
  cell: (x: number, z: number) => CellKind;
  land: (x: number, z: number) => boolean;
};
const cache = new Map<string, Terrain>();
export function terrainOf(seed: string, map: MapId): Terrain {
  const key = seed + ':' + map;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = hashString(seed + '|' + map);
  const l1 = lattice(base),
    l2 = lattice(base ^ 0x9e3779b9),
    r = rng(base ^ 0x85ebca6b);
  const heights = new Float32Array(SIZE * SIZE);
  const index = (x: number, z: number) => (z + HALF) * SIZE + (x + HALF);
  for (let z = -HALF; z <= HALF; z++)
    for (let x = -HALF; x <= HALF; x++) {
      let v =
        noise(l1, x, z, 34) * 0.55 +
        noise(l1, x + 500, z + 500, 15) * 0.3 +
        noise(l2, x, z, 6) * 0.15;
      const d = Math.hypot(x, z);
      if (d < 14) v = v * smooth(d / 14) + 0.46 * (1 - smooth(d / 14));
      if (map === 'desert') v = v * 0.9 + 0.06;
      if (map === 'snow') v = v * 1.05;
      heights[index(x, z)] = v;
    }
  const paint = (cx: number, cz: number, rad: number, value: number) => {
    for (let z = Math.floor(cz - rad); z <= Math.ceil(cz + rad); z++)
      for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
        if (Math.abs(x) > HALF || Math.abs(z) > HALF) continue;
        const d = Math.hypot(x - cx, z - cz);
        if (d < rad) {
          const i = index(x, z);
          const t = smooth(Math.min(1, d / rad));
          heights[i] = value * (1 - t) + heights[i] * t;
        }
      }
  };
  // River: winds from one edge to the opposite edge and stays clear of the keep.
  const side = Math.floor(r() * 4);
  const sway = (r() - 0.5) * 40;
  const off = (r() > 0.5 ? 1 : -1) * (16 + r() * 10);
  const fords: { x: number; z: number }[] = [];
  const fordAt = [0.3 + r() * 0.15, 0.6 + r() * 0.2];
  for (let t = 0; t <= 1; t += 0.01) {
    const along = -HALF + t * SIZE;
    const across =
      off +
      Math.sin(t * Math.PI * 1.7 + sway) * 9 +
      noise(l2, t * 300, 77, 20) * 12 -
      6;
    const x = side % 2 === 0 ? along : across,
      z = side % 2 === 0 ? across : along;
    paint(x, z, 3.2, 0.2);
    for (const f of fordAt) if (Math.abs(t - f) < 0.006) fords.push({ x, z });
  }
  for (const f of fords) paint(f.x, f.z, 3.6, 0.4);
  // Lakes.
  for (let i = 0; i < 2; i++) {
    const a = r() * Math.PI * 2,
      d = 26 + r() * 22;
    paint(Math.cos(a) * d, Math.sin(a) * d, 5 + r() * 3, 0.2);
  }
  // Keep plateau: flat core, then blend outwards.
  paint(0, 0, 11, 0.46);
  for (let z = -8; z <= 8; z++)
    for (let x = -8; x <= 8; x++)
      if (Math.hypot(x, z) <= 8) heights[index(x, z)] = 0.46;
  const h = (x: number, z: number) =>
    heights[
      index(
        Math.max(-HALF, Math.min(HALF, Math.round(x))),
        Math.max(-HALF, Math.min(HALF, Math.round(z))),
      )
    ];
  const cell = (x: number, z: number): CellKind => {
    const v = h(x, z);
    return v < WATER_LEVEL
      ? 'water'
      : v < HILL_LEVEL
        ? 'plain'
        : v < MOUNTAIN_LEVEL
          ? 'hill'
          : 'mountain';
  };
  const land = (x: number, z: number) => {
    const c = cell(x, z);
    return c === 'plain' || c === 'hill';
  };
  const y = (x: number, z: number) => Math.max(0, (h(x, z) - WATER_LEVEL) * 8);
  const t: Terrain = { seed, map, heights, index, h, y, cell, land };
  carveAccess(t);
  cache.set(key, t);
  return t;
}
// Guarantee the outer ring can reach the keep by carving plains along rays.
function carveAccess(t: Terrain) {
  const reach = reachableFrom(t, 0, 0, () => true);
  const ring = HALF - 2;
  let open = 0;
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const x = Math.round(Math.cos(a) * ring),
      z = Math.round(Math.sin(a) * ring);
    if (reach[t.index(x, z)]) open++;
  }
  if (open >= 40) return;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    for (let d = 0; d <= HALF; d += 0.5) {
      const x = Math.cos(a) * d,
        z = Math.sin(a) * d;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const cx = Math.round(x) + dx,
            cz = Math.round(z) + dz;
          if (Math.abs(cx) > HALF || Math.abs(cz) > HALF) continue;
          const i = t.index(cx, cz);
          if (
            t.heights[i] < WATER_LEVEL + 0.02 ||
            t.heights[i] >= MOUNTAIN_LEVEL - 0.02
          )
            t.heights[i] = 0.46;
        }
    }
  }
}
export function reachableFrom(
  t: Terrain,
  sx: number,
  sz: number,
  free: (x: number, z: number) => boolean,
) {
  const seen = new Uint8Array(SIZE * SIZE);
  const queue = [t.index(Math.round(sx), Math.round(sz))];
  seen[queue[0]] = 1;
  let at = 0;
  while (at < queue.length) {
    const a = queue[at++],
      x = (a % SIZE) - HALF,
      z = Math.floor(a / SIZE) - HALF;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz;
      if (Math.abs(nx) > HALF || Math.abs(nz) > HALF) continue;
      const ni = t.index(nx, nz);
      if (seen[ni] || !t.land(nx, nz) || !free(nx, nz)) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return seen;
}
export function generateObstacles(seed: string, map: MapId): Obstacle[] {
  const t = terrainOf(seed, map);
  const r = rng(hashString(seed + '#obstacles#' + map));
  const forest = lattice(hashString(seed + '#forest'));
  const out: Obstacle[] = [];
  const cellsOf: Map<number, Obstacle[]> = new Map();
  const near = (x: number, z: number, d: number) => {
    for (let cz = Math.floor((z - d) / 4); cz <= Math.floor((z + d) / 4); cz++)
      for (
        let cx = Math.floor((x - d) / 4);
        cx <= Math.floor((x + d) / 4);
        cx++
      )
        for (const o of cellsOf.get(cx * 1000 + cz) || [])
          if (Math.hypot(o.x - x, o.z - z) < d) return true;
    return false;
  };
  const cap = map === 'desert' ? 240 : 300;
  for (let i = 0; i < 6000 && out.length < cap; i++) {
    const x = Math.round((r() - 0.5) * (SIZE - 4)),
      z = Math.round((r() - 0.5) * (SIZE - 4));
    if (Math.hypot(x, z) < 7 || !t.land(x, z)) continue;
    const c = t.cell(x, z);
    const f = noise(forest, x, z, 18);
    const roll = r();
    let kind: ObstacleKind | null = null;
    if (map === 'desert') {
      if (c === 'hill' && roll < 0.7) kind = roll < 0.25 ? 'ore' : 'rock';
      else if (roll < 0.22) kind = 'tree';
      else if (roll < 0.4) kind = 'rock';
    } else if (c === 'hill') {
      kind = roll < 0.3 ? 'ore' : roll < 0.75 ? 'rock' : 'tree';
    } else if (f > 0.5 && roll < 0.85) kind = 'tree';
    else if (roll < 0.12) kind = 'rock';
    if (!kind) continue;
    if (near(x, z, kind === 'tree' ? 2.2 : 2.8)) continue;
    const o: Obstacle = {
      id: out.length + 1,
      x,
      z,
      r: 0.65 + r() * 0.5,
      kind,
      wood: kind === 'tree' ? 30 : 0,
    };
    out.push(o);
    const key = Math.floor(x / 4) * 1000 + Math.floor(z / 4);
    if (!cellsOf.has(key)) cellsOf.set(key, []);
    cellsOf.get(key)!.push(o);
  }
  // Every base can reach stone and iron without expanding: guarantee two
  // rocks and one ore vein on land near the keep.
  const guarantee = (
    kind: ObstacleKind,
    count: number,
    rMin: number,
    rMax: number,
  ) => {
    let have = out.filter(
      (o) => o.kind === kind && Math.hypot(o.x, o.z) <= rMax + 0.5,
    ).length;
    for (let i = 0; i < 400 && have < count; i++) {
      const a = r() * Math.PI * 2,
        d = rMin + r() * (rMax - rMin);
      const x = Math.round(Math.cos(a) * d),
        z = Math.round(Math.sin(a) * d);
      if (!t.land(x, z) || near(x, z, 2.8)) continue;
      const o: Obstacle = {
        id: out.length + 1,
        x,
        z,
        r: 0.75 + r() * 0.3,
        kind,
        wood: 0,
      };
      out.push(o);
      const key = Math.floor(x / 4) * 1000 + Math.floor(z / 4);
      if (!cellsOf.has(key)) cellsOf.set(key, []);
      cellsOf.get(key)!.push(o);
      have++;
    }
  };
  guarantee('rock', 2, 8, 11);
  guarantee('ore', 1, 9, 12);
  return out;
}
