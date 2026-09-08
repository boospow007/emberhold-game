import {
  HALF,
  SIZE,
  type MapId,
  type Obstacle,
  type ObstacleKind,
  terrainOf,
  generateObstacles,
  randomSeed,
  normalizeSeed,
} from './terrain.ts';
export type { MapId, Obstacle, ObstacleKind } from './terrain.ts';
export {
  HALF,
  randomSeed,
  normalizeSeed,
  weeklySeed,
  terrainOf,
} from './terrain.ts';
export type Weapon = 'bow' | 'sword' | 'staff';
export type Resource = 'gold' | 'wood' | 'stone' | 'iron' | 'food';
export type Cost = Partial<Record<Resource, number>>;
export type BuildKind =
  | 'house'
  | 'farm'
  | 'sawmill'
  | 'goldmine'
  | 'quarry'
  | 'mine'
  | 'tower'
  | 'wall'
  | 'frost'
  | 'shrine'
  | 'ballista'
  | 'bridge'
  | 'fisher'
  | 'barracks'
  | 'archery'
  | 'stable';
export type UnitKind = 'infantry' | 'archer' | 'knight';
export type Profile = {
  id: string;
  name: string;
  points: number;
  power: number;
  vitality: number;
  unlocks: string[];
  best: number;
  squad?: number;
};
export type Unit = {
  id: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  cool: number;
  angle: number;
};
export type Player = Unit & {
  name: string;
  weapon: Weapon;
  dead: number;
  level: number;
  xp: number;
  picks: number;
  power: number;
  haste: number;
  lastHit: number;
  color: number;
  unlocks: string[];
  task: '' | 'chop';
  stack: number;
};
export type Enemy = Unit & {
  kind: string;
  speed: number;
  damage: number;
  slow: number;
};
export type Building = Unit & {
  kind: BuildKind | 'keep';
  level: number;
  branch: string;
};
export type Soldier = Unit & {
  kind: UnitKind;
  home: string;
  owner: string;
  mode: 'follow' | 'hold';
  px: number;
  pz: number;
  slot: number;
};
export type Effect = {
  id: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
  kind: string;
  life: number;
};
export type Gem = { id: number; x: number; z: number; value: number };
export type Command = {
  seq: number;
  type: 'build' | 'upgrade' | 'next' | 'perk' | 'rally' | 'release';
  kind?: BuildKind;
  x?: number;
  z?: number;
  id?: string;
  branch?: string;
};
export type Input = { x: number; z: number; commands: Command[] };
export type World = {
  run: string;
  map: MapId;
  seed: string;
  phase: 'prep' | 'battle' | 'over';
  wave: number;
  timer: number;
  elapsed: number;
  res: Record<Resource, number>;
  kills: number;
  players: Player[];
  enemies: Enemy[];
  buildings: Building[];
  units: Soldier[];
  terrain: Obstacle[];
  terrainVersion: number;
  effects: Effect[];
  gems: Gem[];
  left: number;
  spawn: number;
  serial: number;
  acks: Record<string, number>;
  notice: string;
};
export const MAPS = {
  forest: {
    name: 'ป่าสนเรืองแสง',
    en: 'THE VERDANT REACH',
    ground: 0x577862,
    dark: 0x254637,
    sky: 0x182e2e,
  },
  desert: {
    name: 'ผาหินอำพัน',
    en: 'AMBER WASTES',
    ground: 0xa98b61,
    dark: 0x75573b,
    sky: 0x3a3029,
  },
  snow: {
    name: 'หุบเขาเหมันต์',
    en: 'FROSTBOUND',
    ground: 0xa2babe,
    dark: 0x678990,
    sky: 0x283b48,
  },
};
export const RESOURCES: Record<Resource, { name: string; short: string }> = {
  gold: { name: 'ทอง', short: 'ทอง' },
  wood: { name: 'ไม้', short: 'ไม้' },
  stone: { name: 'หิน', short: 'หิน' },
  iron: { name: 'เหล็ก', short: 'เหล็ก' },
  food: { name: 'อาหาร', short: 'อาหาร' },
};
export const RESOURCE_ORDER: Resource[] = [
  'gold',
  'wood',
  'stone',
  'iron',
  'food',
];
export type BuildInfo = {
  name: string;
  cost: Cost;
  hp: number;
  desc: string;
  tab: 'defense' | 'economy' | 'housing' | 'army';
  tier: number;
  workers: number;
  node?: ObstacleKind;
  water?: 'on' | 'near';
  upgrades?: Cost[];
  unit?: UnitKind;
};
export const UNITS: Record<
  UnitKind,
  {
    name: string;
    hp: number;
    damage: number;
    range: number;
    cool: number;
    speed: number;
    workers: number;
  }
> = {
  infantry: {
    name: 'ทหารราบ',
    hp: 90,
    damage: 12,
    range: 1.3,
    cool: 0.8,
    speed: 4.4,
    workers: 1,
  },
  archer: {
    name: 'นักธนู',
    hp: 55,
    damage: 9,
    range: 7,
    cool: 0.7,
    speed: 4.4,
    workers: 1,
  },
  knight: {
    name: 'อัศวิน',
    hp: 180,
    damage: 22,
    range: 1.5,
    cool: 0.9,
    speed: 5.2,
    workers: 2,
  },
};
export const BUILDINGS: Record<BuildKind, BuildInfo> = {
  house: {
    name: 'บ้านคนงาน',
    cost: { wood: 25 },
    hp: 150,
    desc: 'คนงาน 2 / 5 / 10 ตามระดับ • อัปเกรดต้องใช้อาหาร',
    tab: 'housing',
    tier: 1,
    workers: 0,
    upgrades: [
      { wood: 30, food: 20 },
      { stone: 30, food: 40 },
    ],
  },
  farm: {
    name: 'ไร่นา',
    cost: { wood: 30 },
    hp: 120,
    desc: '+10 อาหารต่อระดับเมื่อจบวัน',
    tab: 'economy',
    tier: 1,
    workers: 0,
  },
  sawmill: {
    name: 'โรงเลื่อย',
    cost: { wood: 20, gold: 20 },
    hp: 120,
    desc: 'ตัดไม้เองจากต้นไม้ในรัศมี +4 ต่อต้น (สูงสุด 3)',
    tab: 'economy',
    tier: 1,
    workers: 0,
  },
  goldmine: {
    name: 'เหมืองทอง',
    cost: { wood: 40, stone: 20 },
    hp: 160,
    desc: 'สร้างบนหิน • +20 ทองต่อระดับเมื่อจบวัน',
    tab: 'economy',
    tier: 2,
    workers: 1,
    node: 'rock',
  },
  quarry: {
    name: 'เหมืองหิน',
    cost: { wood: 40, gold: 30 },
    hp: 160,
    desc: 'สร้างบนหิน • +12 หินต่อระดับเมื่อจบวัน',
    tab: 'economy',
    tier: 2,
    workers: 1,
    node: 'rock',
  },
  mine: {
    name: 'เหมืองเหล็ก',
    cost: { stone: 40, gold: 50 },
    hp: 180,
    desc: 'สร้างบนสายแร่ • +8 เหล็กต่อระดับเมื่อจบวัน',
    tab: 'economy',
    tier: 3,
    workers: 2,
    node: 'ore',
  },
  tower: {
    name: 'ป้อมธนู',
    cost: { wood: 25, gold: 15 },
    hp: 180,
    desc: 'ยิงไกล • เลือกสายยิงเร็ว / ยิงหนัก',
    tab: 'defense',
    tier: 1,
    workers: 1,
  },
  wall: {
    name: 'กำแพง',
    cost: { wood: 8 },
    hp: 330,
    desc: 'รับแรงบุก • อัปเกรดเป็นกำแพงหินด้วยหิน',
    tab: 'defense',
    tier: 1,
    workers: 0,
    upgrades: [{ stone: 10 }, { stone: 20 }],
  },
  frost: {
    name: 'ป้อมเวท',
    cost: { stone: 30, gold: 40 },
    hp: 160,
    desc: 'ยิงเวทชะลอศัตรูเป็นกลุ่ม',
    tab: 'defense',
    tier: 2,
    workers: 2,
  },
  shrine: {
    name: 'ศาลาฟื้นฟู',
    cost: { wood: 30, gold: 35 },
    hp: 140,
    desc: 'ฟื้นฟูผู้เล่นในระยะรอบอาคาร',
    tab: 'economy',
    tier: 2,
    workers: 1,
  },
  ballista: {
    name: 'บัลลิสตา',
    cost: { iron: 25, stone: 30, gold: 40 },
    hp: 220,
    desc: 'ยิงไกลมาก ระเบิดเป็นวง',
    tab: 'defense',
    tier: 3,
    workers: 2,
  },
  bridge: {
    name: 'สะพาน',
    cost: { wood: 20 },
    hp: 200,
    desc: 'วางบนน้ำ ให้ทุกฝ่ายข้ามธารน้ำได้',
    tab: 'economy',
    tier: 1,
    workers: 0,
    water: 'on',
  },
  fisher: {
    name: 'กระท่อมชาวประมง',
    cost: { wood: 25 },
    hp: 120,
    desc: 'สร้างริมน้ำ • +8 อาหารต่อระดับเมื่อจบวัน',
    tab: 'economy',
    tier: 1,
    workers: 0,
    water: 'near',
  },
  barracks: {
    name: 'ค่ายทหารราบ',
    cost: { wood: 35, gold: 20 },
    hp: 200,
    desc: 'ทหารราบ 1 นายต่อระดับ ประชิด • ฟื้นตอนเช้าถ้าค่ายยังอยู่',
    tab: 'army',
    tier: 1,
    workers: 1,
    unit: 'infantry',
  },
  archery: {
    name: 'ค่ายธนู',
    cost: { wood: 45, gold: 30 },
    hp: 180,
    desc: 'นักธนู 1 นายต่อระดับ ยิงไกล เลือดน้อย',
    tab: 'army',
    tier: 2,
    workers: 1,
    unit: 'archer',
  },
  stable: {
    name: 'ค่ายอัศวิน',
    cost: { iron: 20, gold: 60, food: 30 },
    hp: 240,
    desc: 'อัศวิน 1 นายต่อระดับ เร็ว เลือดหนา ใช้คนงาน 2',
    tab: 'army',
    tier: 3,
    workers: 2,
    unit: 'knight',
  },
};
export const BASE_STACK = 2;
export const MAX_SQUAD = 8;
export const squadCost = (level: number) => 80 + level * 60;
export const KEEP_MAX = 4;
export const KEEP_UPGRADES: Cost[] = [
  { wood: 60, stone: 30 },
  { stone: 60, iron: 30 },
  { iron: 60, gold: 200 },
];
export const KEEP_RADIUS = [0, 12, 20, 30, 44];
export const HOUSE_WORKERS = [0, 2, 5, 10];
export const KEEP_WORKERS = [0, 3, 5, 7, 9];
export const START_RES: Record<Resource, number> = {
  gold: 60,
  wood: 60,
  stone: 0,
  iron: 0,
  food: 20,
};
export const COLORS = [0xf8c66c, 0x85c8ee, 0xd3a2ef, 0xf6a29b];
export const dist = (
  a: { x: number; z: number },
  b: { x: number; z: number },
) => Math.hypot(a.x - b.x, a.z - b.z);
export const terrain = (w: World) => terrainOf(w.seed, w.map);
export const spawnRadius = (w: World) =>
  Math.min(HALF - 2, buildRadius(w) + 16);
export function bridgeAt(w: World, x: number, z: number) {
  return w.buildings.some(
    (b) => b.kind === 'bridge' && b.hp > 0 && dist(b, { x, z }) < 1.05,
  );
}
export function passable(w: World, x: number, z: number) {
  return terrain(w).land(x, z) || bridgeAt(w, x, z);
}
export const keepOf = (w: World) => w.buildings[0];
export const buildRadius = (w: World) =>
  KEEP_RADIUS[Math.min(KEEP_MAX, keepOf(w).level)];
export function workerCap(w: World) {
  return w.buildings.reduce(
    (s, b) =>
      s +
      (b.kind === 'keep'
        ? KEEP_WORKERS[Math.min(KEEP_MAX, b.level)]
        : b.kind === 'house'
          ? HOUSE_WORKERS[Math.min(3, b.level)]
          : 0),
    0,
  );
}
export function workersUsed(w: World) {
  return w.buildings.reduce(
    (s, b) =>
      s +
      (b.kind === 'keep'
        ? 0
        : BUILDINGS[b.kind].workers * (BUILDINGS[b.kind].unit ? b.level : 1)),
    0,
  );
}
export function canAfford(w: World, cost: Cost) {
  return (Object.keys(cost) as Resource[]).every(
    (k) => w.res[k] >= (cost[k] || 0),
  );
}
export function pay(w: World, cost: Cost) {
  for (const k of Object.keys(cost) as Resource[]) w.res[k] -= cost[k] || 0;
}
export function missing(w: World, cost: Cost): Resource | null {
  for (const k of RESOURCE_ORDER) if (w.res[k] < (cost[k] || 0)) return k;
  return null;
}
export function upgradeCost(b: Building): Cost {
  if (b.kind === 'keep')
    return KEEP_UPGRADES[Math.min(KEEP_UPGRADES.length - 1, b.level - 1)];
  const info = BUILDINGS[b.kind];
  if (info.upgrades)
    return info.upgrades[Math.min(info.upgrades.length - 1, b.level - 1)];
  const mul = b.level === 1 ? 1 : 1.6;
  const out: Cost = {};
  for (const k of Object.keys(info.cost) as Resource[])
    out[k] = Math.round((info.cost[k] || 0) * mul);
  return out;
}
export function branches(kind: Building['kind']) {
  return kind === 'tower' || kind === 'frost' || kind === 'ballista'
    ? ['rapid', 'heavy']
    : kind === 'keep'
      ? ['keep']
      : ['grow'];
}
export function nodeAt(w: World, kind: BuildKind, x: number, z: number) {
  const need = BUILDINGS[kind].node;
  if (!need) return null;
  return (
    w.terrain.find((o) => o.kind === need && dist(o, { x, z }) < 1.2) || null
  );
}
export function newWorld(map: MapId, seed?: string): World {
  const s = normalizeSeed(seed || '') || randomSeed();
  return {
    run: crypto.randomUUID(),
    map,
    seed: s,
    phase: 'prep',
    wave: 0,
    timer: 0,
    elapsed: 0,
    res: { ...START_RES },
    kills: 0,
    players: [],
    enemies: [],
    buildings: [
      {
        id: 'keep',
        kind: 'keep',
        x: 0,
        z: 0,
        hp: 1000,
        maxHp: 1000,
        cool: 0,
        angle: 0,
        level: 1,
        branch: '',
      },
    ],
    units: [],
    terrain: generateObstacles(s, map),
    terrainVersion: 0,
    effects: [],
    gems: [],
    left: 0,
    spawn: 0,
    serial: 0,
    acks: {},
    notice: 'ตัดไม้ สร้างแนวป้องกัน แล้วกดเริ่มวันแรกเมื่อพร้อม',
  };
}
export function addPlayer(w: World, profile: Profile, weapon: Weapon) {
  if (w.players.some((p) => p.id === profile.id)) return;
  const i = w.players.length;
  w.players.push({
    id: profile.id,
    name: profile.name || 'ผู้พิทักษ์',
    x: 2 + i,
    z: 3,
    hp: 100 + profile.vitality * 15,
    maxHp: 100 + profile.vitality * 15,
    cool: 0,
    angle: 0,
    weapon,
    dead: 0,
    level: 1,
    xp: 0,
    picks: 0,
    power: 1 + profile.power * 0.08,
    haste: 1,
    lastHit: 0,
    color: COLORS[i % 4],
    unlocks: profile.unlocks,
    task: '',
    stack: BASE_STACK + Math.min(MAX_SQUAD, profile.squad || 0),
  });
}
function spawnSoldier(w: World, b: Building, slot: number) {
  const kind = BUILDINGS[b.kind as BuildKind].unit!;
  const u = UNITS[kind];
  const a = (slot * 2.1 + b.level) % (Math.PI * 2);
  w.units.push({
    id: 'u' + ++w.serial,
    kind,
    home: b.id,
    owner: '',
    mode: 'hold',
    x: b.x + Math.cos(a) * 1.6,
    z: b.z + Math.sin(a) * 1.6,
    px: b.x + Math.cos(a) * 1.6,
    pz: b.z + Math.sin(a) * 1.6,
    slot,
    hp: u.hp,
    maxHp: u.hp,
    cool: 0,
    angle: 0,
  });
}
export function following(w: World, pid: string) {
  return w.units.filter((u) => u.mode === 'follow' && u.owner === pid);
}
export function canBuild(w: World, kind: BuildKind, x: number, z: number) {
  const r = kind === 'wall' ? 0.7 : 1.05;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    Math.abs(x) > HALF - 1 ||
    Math.abs(z) > HALF - 1
  )
    return false;
  if (Math.hypot(x, z) > buildRadius(w)) return false;
  const node = nodeAt(w, kind, x, z);
  if (BUILDINGS[kind].node && !node) return false;
  if (waterError(w, kind, x, z)) return false;
  return (
    !w.buildings.some(
      (b) =>
        dist(b, { x, z }) <
        (b.kind === 'keep' ? 2.6 : b.kind === 'wall' ? 0.8 : 1.1) + r,
    ) && !w.terrain.some((o) => o !== node && dist(o, { x, z }) < o.r + r)
  );
}
export function waterError(w: World, kind: BuildKind, x: number, z: number) {
  const t = terrain(w);
  const need = BUILDINGS[kind].water;
  const c = t.cell(x, z);
  if (need === 'on') return c === 'water' ? '' : 'สะพานต้องวางบนน้ำ';
  if (c === 'water') return 'วางบนน้ำไม่ได้';
  if (c === 'mountain') return 'วางบนภูเขาไม่ได้';
  if (need === 'near') {
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++)
        if (t.cell(x + dx, z + dz) === 'water') return '';
    return 'ต้องสร้างริมน้ำ';
  }
  return '';
}
export function buildGate(w: World, p: Player, kind: BuildKind): string {
  const d = BUILDINGS[kind];
  if ((kind === 'frost' || kind === 'shrine') && !p.unlocks.includes(kind))
    return 'ยังไม่ได้ปลดล็อก';
  if (d.tier > keepOf(w).level) return `ต้องอัปเกรดฐานแม่เป็นระดับ ${d.tier}`;
  const lack = missing(w, d.cost);
  if (lack) return RESOURCES[lack].name + 'ไม่พอ';
  if (d.workers && workersUsed(w) + d.workers > workerCap(w))
    return 'คนงานไม่พอ สร้างหรืออัปเกรดบ้านคนงาน';
  return '';
}
export function buildError(
  w: World,
  p: Player,
  kind: BuildKind,
  x: number,
  z: number,
): string {
  const d = BUILDINGS[kind];
  const gate = buildGate(w, p, kind);
  if (gate) return gate;
  if (Math.hypot(x, z) > buildRadius(w)) return 'ไกลจากฐานแม่เกินไป';
  const water = waterError(w, kind, x, z);
  if (water) return water;
  if (d.node && !nodeAt(w, kind, x, z))
    return d.node === 'ore' ? 'ต้องวางบนสายแร่' : 'ต้องวางบนหิน';
  if (!canBuild(w, kind, x, z)) return 'พื้นที่นี้วางไม่ได้';
  if (w.buildings.length >= 90) return 'ฐานมีสิ่งก่อสร้างเต็มแล้ว';
  return '';
}
export function upgradeError(w: World, p: Player, b: Building, branch: string) {
  if (dist(p, b) > (b.kind === 'keep' ? 6 : 5)) return 'เดินเข้าใกล้อาคารก่อน';
  if (b.kind === 'keep') {
    if (b.level >= KEEP_MAX) return 'ฐานแม่ระดับสูงสุดแล้ว';
  } else {
    if (b.level >= 3) return 'อัปเกรดเต็มแล้ว';
    if (b.level >= keepOf(w).level)
      return `ต้องอัปเกรดฐานแม่เป็นระดับ ${b.level + 1} ก่อน`;
  }
  if (!branches(b.kind).includes(branch)) return 'เลือกสายอัปเกรด';
  if (
    b.kind !== 'keep' &&
    BUILDINGS[b.kind].unit &&
    workersUsed(w) + BUILDINGS[b.kind].workers > workerCap(w)
  )
    return 'คนงานไม่พอ สร้างหรืออัปเกรดบ้านคนงาน';
  const lack = missing(w, upgradeCost(b));
  if (lack) return RESOURCES[lack].name + 'ไม่พอ';
  return '';
}
function clearFields() {
  fields.clear();
}
export function command(w: World, pid: string, c: Command): string {
  const p = w.players.find((p) => p.id === pid);
  if (!p || w.phase === 'over') return 'รอบจบแล้ว';
  if (c.type === 'next') {
    if (w.phase === 'prep') startWave(w);
    return '';
  }
  if (c.type === 'perk') {
    if (p.picks < 1) return 'ยังไม่มีพรให้เลือก';
    if (c.branch === 'power') p.power += 0.2;
    else if (c.branch === 'haste') p.haste += 0.12;
    else if (c.branch === 'vitality') {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 50);
    } else return 'พรไม่ถูกต้อง';
    p.picks--;
    return '';
  }
  if (c.type === 'rally') {
    const mine = following(w, pid).length;
    if (mine >= p.stack) return 'กองกำลังเต็มแล้ว';
    const free = w.units
      .filter((u) => u.mode === 'hold' && dist(u, p) < 9)
      .sort((a, b) => dist(a, p) - dist(b, p))
      .slice(0, p.stack - mine);
    if (!free.length) return 'ไม่มีทหารว่างใกล้ตัว';
    for (const u of free) {
      u.mode = 'follow';
      u.owner = pid;
    }
    return '';
  }
  if (c.type === 'release') {
    const mine = following(w, pid);
    if (!mine.length) return 'ไม่มีทหารที่ตามอยู่';
    for (const u of mine) {
      u.mode = 'hold';
      u.owner = '';
      u.px = u.x;
      u.pz = u.z;
    }
    return '';
  }
  if (w.phase !== 'prep') return 'สร้างและอัปเกรดได้ในช่วงพัก';
  if (c.type === 'build') {
    const k = c.kind;
    if (!k || !Object.hasOwn(BUILDINGS, k)) return 'ไม่พบสิ่งก่อสร้าง';
    const d = BUILDINGS[k];
    let x = Math.round((c.x ?? 999) * 2) / 2,
      z = Math.round((c.z ?? 999) * 2) / 2;
    const err = buildError(w, p, k, x, z);
    if (err) return err;
    const node = nodeAt(w, k, x, z);
    if (node) {
      x = node.x;
      z = node.z;
      w.terrain = w.terrain.filter((o) => o !== node);
      w.terrainVersion++;
      clearFields();
    }
    pay(w, d.cost);
    if (k === 'bridge') {
      w.terrainVersion++;
      clearFields();
    }
    const built: Building = {
      id: 'b' + ++w.serial,
      kind: k,
      x,
      z,
      hp: d.hp,
      maxHp: d.hp,
      cool: 0,
      angle: 0,
      level: 1,
      branch: '',
    };
    w.buildings.push(built);
    if (d.unit) spawnSoldier(w, built, 1);
    return '';
  }
  if (c.type === 'upgrade') {
    const b = w.buildings.find((b) => b.id === c.id);
    if (!b) return 'เลือกอาคารก่อน';
    const err = upgradeError(w, p, b, c.branch || '');
    if (err) return err;
    pay(w, upgradeCost(b));
    b.level++;
    if (b.kind === 'keep') {
      b.maxHp += 500;
      b.hp = b.maxHp;
      w.notice = `ฐานแม่ระดับ ${b.level} · สร้างได้ไกลขึ้นและปลดล็อกสิ่งก่อสร้างใหม่`;
      return '';
    }
    b.branch = c.branch!;
    b.maxHp *= b.kind === 'house' ? 1.3 : 1.65;
    b.hp = b.maxHp;
    if (BUILDINGS[b.kind].unit) spawnSoldier(w, b, b.level);
    return '';
  }
  return '';
}
export function startWave(w: World) {
  w.phase = 'battle';
  w.wave++;
  w.timer = 0;
  w.left = Math.round((9 + w.wave * 5) * (1 + 0.45 * (w.players.length - 1)));
  w.spawn = 0.2;
  w.notice =
    w.wave % 5 === 0 ? 'ระวัง! ผู้ทำลายฐานกำลังมา' : 'ศัตรูกำลังบุก ปกป้องเปลวไฟ!';
}
export function income(w: World): Cost {
  const out: Cost = { gold: 20 };
  for (const b of w.buildings) {
    if (b.kind === 'farm') out.food = (out.food || 0) + 10 * b.level;
    else if (b.kind === 'fisher') out.food = (out.food || 0) + 8 * b.level;
    else if (b.kind === 'goldmine') out.gold = (out.gold || 0) + 20 * b.level;
    else if (b.kind === 'quarry') out.stone = (out.stone || 0) + 12 * b.level;
    else if (b.kind === 'mine') out.iron = (out.iron || 0) + 8 * b.level;
    else if (b.kind === 'sawmill') {
      const trees = w.terrain.filter(
        (o) => o.kind === 'tree' && dist(o, b) < 6,
      ).length;
      out.wood = (out.wood || 0) + Math.min(3, trees) * 4 * b.level;
    }
  }
  return out;
}
export function costText(c: Cost) {
  return RESOURCE_ORDER.filter((k) => c[k])
    .map((k) => `${RESOURCES[k].short} ${c[k]}`)
    .join(' · ');
}
const fields = new Map<string, Int16Array>();
const cellIndex = (x: number, z: number) => (z + HALF) * SIZE + x + HALF;
const clampCell = (v: number) =>
  Math.max(-HALF + 1, Math.min(HALF - 1, Math.round(v)));
export function fieldFor(w: World, target: { x: number; z: number }) {
  const obs = w.terrain;
  const tx = clampCell(target.x),
    tz = clampCell(target.z);
  const key =
    w.seed + ':' + w.map + ':' + w.terrainVersion + ':' + tx + ':' + tz;
  let field = fields.get(key);
  if (field) return field;
  field = new Int16Array(SIZE * SIZE);
  field.fill(-1);
  for (let z = -HALF; z <= HALF; z++)
    for (let x = -HALF; x <= HALF; x++)
      if (!passable(w, x, z)) field[cellIndex(x, z)] = -2;
  for (const o of obs) {
    const rr = o.r + 0.85;
    for (let z = Math.ceil(o.z - rr); z <= Math.floor(o.z + rr); z++)
      for (let x = Math.ceil(o.x - rr); x <= Math.floor(o.x + rr); x++)
        if (
          Math.abs(x) <= HALF &&
          Math.abs(z) <= HALF &&
          Math.hypot(o.x - x, o.z - z) < rr
        )
          field[cellIndex(x, z)] = -2;
  }
  const queue: number[] = [cellIndex(tx, tz)];
  field[queue[0]] = 0;
  let at = 0;
  while (at < queue.length) {
    const a = queue[at++],
      x = a % SIZE,
      z = Math.floor(a / SIZE);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz;
      if (nx < 0 || nx >= SIZE || nz < 0 || nz >= SIZE) continue;
      const ni = nz * SIZE + nx;
      if (field[ni] !== -1) continue;
      field[ni] = field[a] + 1;
      queue.push(ni);
    }
  }
  if (fields.size > 40) fields.delete(fields.keys().next().value!);
  fields.set(key, field);
  return field;
}
export function reachable(w: World, x: number, z: number) {
  const f = fieldFor(w, w.buildings[0]);
  return f[cellIndex(clampCell(x), clampCell(z))] >= 0;
}
function waypoint(
  w: World,
  from: { x: number; z: number },
  target: { x: number; z: number },
) {
  const obs = w.terrain;
  const field = fieldFor(w, target);
  const x = clampCell(from.x),
    z = clampCell(from.z);
  let best = { x, z },
    score = 99999;
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx,
        nz = z + dz;
      if (Math.abs(nx) > HALF || Math.abs(nz) > HALF) continue;
      const f = field[cellIndex(nx, nz)];
      if (f < 0) continue;
      if (
        dx &&
        dz &&
        (field[cellIndex(x + dx, z)] < 0 || field[cellIndex(x, z + dz)] < 0)
      )
        continue;
      const v = f + Math.hypot(nx - from.x, nz - from.z) * 0.35;
      if (v < score) {
        score = v;
        best = { x: nx, z: nz };
      }
    }
  if (
    Math.hypot(from.x - target.x, from.z - target.z) < 3 &&
    !obs.some(
      (o) =>
        Math.hypot(
          o.x - (from.x + target.x) / 2,
          o.z - (from.z + target.z) / 2,
        ) <
        o.r + 0.7,
    )
  )
    return target;
  return best;
}
function emit(
  w: World,
  a: { x: number; z: number },
  b: { x: number; z: number },
  kind: string,
) {
  w.effects.push({
    id: ++w.serial,
    x: a.x,
    z: a.z,
    tx: b.x,
    tz: b.z,
    kind,
    life: 0.25,
  });
}
function move(
  w: World,
  u: { x: number; z: number; angle?: number },
  dx: number,
  dz: number,
  speed: number,
  dt: number,
  enemy = false,
) {
  const l = Math.hypot(dx, dz);
  if (l < 0.01) return;
  dx /= l;
  dz /= l;
  const obs = w.terrain,
    buildings = w.buildings,
    t = terrain(w);
  const lim = HALF - 1;
  const nx = Math.max(-lim, Math.min(lim, u.x + dx * speed * dt)),
    nz = Math.max(-lim, Math.min(lim, u.z + dz * speed * dt));
  if (enemy && t.y(nx, nz) > t.y(u.x, u.z) + 0.05) {
    speed *= 0.7;
  }
  const blocked = (x: number, z: number) =>
    !passable(w, x, z) ||
    obs.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.3) ||
    buildings.some(
      (b) =>
        b.kind !== 'bridge' &&
        Math.hypot(b.x - x, b.z - z) <
          (b.kind === 'keep' ? 1.6 : b.kind === 'wall' ? 0.65 : 0.75) +
            (enemy ? 0.35 : 0.1),
    );
  if (!blocked(nx, nz)) {
    u.x = nx;
    u.z = nz;
  } else if (!blocked(nx, u.z)) u.x = nx;
  else if (!blocked(u.x, nz)) u.z = nz;
  else if (enemy) {
    const tx = u.x - dz * speed * dt,
      tz = u.z + dx * speed * dt;
    if (!blocked(tx, tz)) {
      u.x = tx;
      u.z = tz;
    }
  }
  u.angle = Math.atan2(dx, dz);
}
function levelUp(p: Player, xp: number) {
  p.xp += xp;
  while (p.xp >= p.level * 22) {
    p.xp -= p.level * 22;
    p.level++;
    p.picks++;
  }
}
function stepUnits(w: World, dt: number) {
  for (const u of w.units) {
    if (u.hp <= 0) continue;
    const info = UNITS[u.kind];
    u.cool -= dt;
    const owner =
      u.mode === 'follow' ? w.players.find((p) => p.id === u.owner) : null;
    if (u.mode === 'follow' && (!owner || owner.dead > 0)) {
      u.mode = 'hold';
      u.owner = '';
      u.px = u.x;
      u.pz = u.z;
    }
    const anchor = owner ? owner : { x: u.px, z: u.pz };
    const leash = owner ? 4 : 3.5;
    const e = w.enemies
      .filter(
        (e) =>
          e.hp > 0 &&
          dist(u, e) <= Math.max(info.range, 2.2) + 1.5 &&
          dist(anchor, e) < leash + info.range + 1,
      )
      .sort((a, b) => dist(u, a) - dist(u, b))[0];
    if (e && dist(u, e) <= info.range) {
      u.angle = Math.atan2(e.x - u.x, e.z - u.z);
      if (u.cool <= 0) {
        u.cool = info.cool;
        e.hp -= info.damage;
        emit(w, u, e, u.kind === 'archer' ? 'arrow' : 'hit');
      }
      continue;
    }
    if (e && dist(anchor, u) < leash) {
      move(w, u, e.x - u.x, e.z - u.z, info.speed, dt);
      continue;
    }
    if (owner) {
      const a = (u.slot * 1.9 + w.units.indexOf(u)) % (Math.PI * 2);
      const tx = owner.x - Math.sin(owner.angle) * 1.4 + Math.cos(a) * 1.1,
        tz = owner.z - Math.cos(owner.angle) * 1.4 + Math.sin(a) * 1.1;
      if (dist(u, { x: tx, z: tz }) > 0.8)
        move(w, u, tx - u.x, tz - u.z, info.speed * 1.2, dt);
    } else if (dist(u, anchor) > 0.6) {
      move(w, u, anchor.x - u.x, anchor.z - u.z, info.speed, dt);
    }
  }
}
export function step(w: World, inputs: Record<string, Input>, dt: number) {
  if (w.phase === 'over') return;
  dt = Math.min(dt, 0.05);
  const obs = w.terrain;
  for (const p of w.players) {
    const input = inputs[p.id] || { x: 0, z: 0, commands: [] };
    for (const c of input.commands || []) {
      if (c.seq > (w.acks[p.id] || 0)) {
        const msg = command(w, p.id, c);
        w.acks[p.id] = c.seq;
        if (msg) w.notice = msg;
      }
    }
    if (p.dead > 0) {
      p.dead -= dt;
      if (p.dead <= 0) {
        p.hp = p.maxHp;
        p.x = 2;
        p.z = 3;
      }
      continue;
    }
    move(w, p, input.x, input.z, 5.5, dt);
    p.cool -= dt;
    p.lastHit += dt;
    if (p.lastHit > 4) p.hp = Math.min(p.maxHp, p.hp + dt * 4);
  }
  w.effects = w.effects.filter((e) => (e.life -= dt) > 0);
  const strained = workersUsed(w) > workerCap(w);
  for (const p of w.players) {
    if (p.dead > 0) continue;
    const range = p.weapon === 'sword' ? 2.2 : p.weapon === 'bow' ? 8 : 6.5;
    const e = w.enemies
      .filter((e) => e.hp > 0 && dist(p, e) <= range)
      .sort((a, b) => dist(p, a) - dist(p, b))[0];
    if (e) {
      p.task = '';
      if (p.cool <= 0) {
        p.cool =
          (p.weapon === 'bow' ? 0.55 : p.weapon === 'sword' ? 0.65 : 1.05) /
          p.haste;
        p.angle = Math.atan2(e.x - p.x, e.z - p.z);
        const damage =
          (p.weapon === 'sword' ? 30 : p.weapon === 'bow' ? 20 : 26) * p.power;
        for (const target of w.enemies) {
          if (
            target === e ||
            (p.weapon === 'sword' && dist(p, target) < 2.3) ||
            (p.weapon === 'staff' && dist(e, target) < 2.1)
          )
            target.hp -= damage;
        }
        emit(w, p, e, p.weapon);
      }
      continue;
    }
    const tree = w.terrain.find(
      (o) => o.kind === 'tree' && dist(o, p) < o.r + 1.1,
    );
    p.task = tree ? 'chop' : '';
    if (tree && p.cool <= 0) {
      p.cool = 0.9 / p.haste;
      p.angle = Math.atan2(tree.x - p.x, tree.z - p.z);
      const got = Math.min(5, tree.wood);
      tree.wood -= got;
      w.res.wood += got;
      emit(w, p, tree, 'chop');
      if (tree.wood <= 0) {
        w.terrain = w.terrain.filter((o) => o !== tree);
        w.terrainVersion++;
        clearFields();
        p.task = '';
      }
    }
  }
  stepUnits(w, dt);
  if (w.phase === 'prep') {
    w.timer += dt;
    return;
  }
  w.elapsed += dt;
  w.timer += dt;
  w.spawn -= dt;
  if (w.left > 0 && w.spawn <= 0 && w.enemies.length < 150) {
    w.spawn = Math.max(0.18, 0.75 - w.wave * 0.025);
    const n = ++w.serial;
    const angle = (n * 2.399963 + w.wave * 0.7) % (Math.PI * 2);
    const boss = w.wave % 5 === 0 && w.left === 1;
    const kind = boss
      ? 'boss'
      : n % 6 === 0
        ? 'brute'
        : n % 4 === 0
          ? 'runner'
          : 'crawler';
    let spawnX = 0,
      spawnZ = 0,
      found = false;
    for (let ring = spawnRadius(w); ring >= 10 && !found; ring -= 4)
      for (let attempt = 0; attempt < 40 && !found; attempt++) {
        const a = angle + attempt * 0.31;
        spawnX = Math.round(Math.cos(a) * ring);
        spawnZ = Math.round(Math.sin(a) * ring);
        found =
          reachable(w, spawnX, spawnZ) &&
          !obs.some((o) => Math.hypot(o.x - spawnX, o.z - spawnZ) < o.r + 1.2);
      }
    const hp =
      (kind === 'boss'
        ? 450
        : kind === 'brute'
          ? 75
          : kind === 'runner'
            ? 22
            : 35) *
      (1 + w.wave * 0.16);
    w.enemies.push({
      id: 'e' + n,
      kind,
      x: spawnX,
      z: spawnZ,
      hp,
      maxHp: hp,
      cool: 0.3,
      angle: 0,
      speed: kind === 'runner' ? 3.2 : kind === 'boss' ? 1 : 1.6,
      damage:
        (kind === 'boss' ? 40 : kind === 'brute' ? 15 : 8) *
        (1 + w.wave * 0.08),
      slow: 0,
    });
    w.left--;
  }
  for (const b of w.buildings) {
    b.cool -= dt;
    if (b.kind === 'shrine') {
      for (const p of w.players)
        if (p.dead <= 0 && dist(p, b) < 5)
          p.hp = Math.min(p.maxHp, p.hp + dt * 5 * b.level);
      continue;
    }
    if (!['keep', 'tower', 'frost', 'ballista'].includes(b.kind) || b.cool > 0)
      continue;
    const range =
      (b.kind === 'keep'
        ? 5
        : b.kind === 'ballista'
          ? b.branch === 'heavy'
            ? 13
            : 11
          : b.branch === 'heavy'
            ? 9
            : 7) * (terrain(w).cell(b.x, b.z) === 'hill' ? 1.2 : 1);
    const e = w.enemies
      .filter((e) => e.hp > 0 && dist(b, e) < range)
      .sort((a, c) => dist(b, a) - dist(b, c))[0];
    if (e) {
      b.cool =
        ((b.kind === 'keep' ? 1.4 : b.kind === 'ballista' ? 2.2 : 0.95) /
          (b.branch === 'rapid' ? 1.8 : 1)) *
        (strained && b.kind !== 'keep' ? 1.75 : 1);
      const dmg =
        (b.kind === 'keep' ? 14 : b.kind === 'ballista' ? 45 : 18) *
        b.level *
        (b.branch === 'heavy' ? 1.8 : 1);
      e.hp -= dmg;
      if (b.kind === 'frost') {
        for (const ee of w.enemies)
          if (dist(e, ee) < 2.4) {
            ee.slow = 2;
            ee.hp -= dmg * 0.4;
          }
      } else if (b.kind === 'ballista') {
        for (const ee of w.enemies)
          if (ee !== e && dist(e, ee) < 1.6) ee.hp -= dmg * 0.5;
      }
      emit(
        w,
        b,
        e,
        b.kind === 'frost' ? 'staff' : b.kind === 'ballista' ? 'bolt' : 'arrow',
      );
    }
  }
  for (const e of w.enemies) {
    if (e.hp <= 0) continue;
    e.cool -= dt;
    e.slow -= dt;
    let target: Unit = w.buildings[0];
    const nearby: Unit[] = [
      ...w.players.filter((p) => p.dead <= 0 && dist(p, e) < 5),
      ...w.units.filter((u) => u.hp > 0 && dist(u, e) < 4),
    ];
    if (nearby.length && e.kind !== 'boss')
      target = nearby.sort((a, b) => dist(a, e) - dist(b, e))[0];
    const nearBuilding = w.buildings
      .filter((b) => dist(b, e) < (b.kind === 'keep' ? 3 : 2.1))
      .sort((a, b) => dist(a, e) - dist(b, e))[0];
    if (nearBuilding) target = nearBuilding;
    const attackRange =
      'kind' in target
        ? (target as Building).kind === 'keep'
          ? 2.5
          : 1.8
        : 1.1;
    if (dist(e, target) > attackRange) {
      const goal = waypoint(w, e, target);
      move(
        w,
        e,
        goal.x - e.x,
        goal.z - e.z,
        e.speed * (e.slow > 0 ? 0.45 : 1),
        dt,
        true,
      );
    } else if (e.cool <= 0) {
      e.cool = 1;
      target.hp -= e.damage;
      emit(w, e, target, 'hit');
      if ('lastHit' in target) (target as Player).lastHit = 0;
    }
  }
  for (const e of w.enemies.filter((e) => e.hp <= 0)) {
    w.kills++;
    w.res.gold += e.kind === 'boss' ? 30 : 2;
    w.gems.push({
      id: ++w.serial,
      x: e.x,
      z: e.z,
      value: e.kind === 'boss' ? 30 : 5,
    });
  }
  w.enemies = w.enemies.filter((e) => e.hp > 0);
  w.units = w.units.filter((u) => u.hp > 0);
  if (w.gems.length > 180) {
    w.gems[0].value += w.gems[1].value;
    w.gems.splice(1, 1);
  }
  for (const g of w.gems) {
    const p = w.players.find((p) => p.dead <= 0 && dist(p, g) < 3);
    if (p) {
      for (const pp of w.players) levelUp(pp, g.value);
      g.value = 0;
    }
  }
  w.gems = w.gems.filter((g) => g.value > 0);
  for (const p of w.players)
    if (p.hp <= 0 && p.dead <= 0) {
      p.dead = 8;
      p.hp = 0;
      w.notice = p.name + ' กำลังฟื้นคืนชีพ';
    }
  if (w.buildings[0].hp <= 0) {
    w.phase = 'over';
    w.notice = 'เปลวไฟดับลง แต่การเดินทางยังไม่จบ';
    return;
  }
  const before = w.buildings.length;
  if (w.buildings.some((b) => b.hp <= 0 && b.kind === 'bridge')) {
    w.terrainVersion++;
    clearFields();
  }
  w.buildings = w.buildings.filter((b) => b.hp > 0);
  const homes = new Set(w.buildings.map((b) => b.id));
  for (const u of w.units) if (!homes.has(u.home)) u.hp = 0;
  w.units = w.units.filter((u) => u.hp > 0);
  if (w.buildings.length < before && workersUsed(w) > workerCap(w))
    w.notice = 'บ้านคนงานถูกทำลาย ป้อมทำงานช้าลงจนกว่าจะสร้างบ้านใหม่';
  if (w.left === 0 && w.enemies.length === 0) {
    w.phase = 'prep';
    w.timer = 0;
    const gain = income(w);
    for (const k of Object.keys(gain) as Resource[]) w.res[k] += gain[k] || 0;
    for (const b of w.buildings) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.2);
    for (const p of w.players) {
      p.dead = 0;
      p.hp = p.maxHp;
    }
    for (const b of w.buildings) {
      const info = b.kind === 'keep' ? null : BUILDINGS[b.kind];
      if (!info?.unit) continue;
      const have = new Set(
        w.units.filter((u) => u.home === b.id).map((u) => u.slot),
      );
      for (let slot = 1; slot <= b.level; slot++)
        if (!have.has(slot)) spawnSoldier(w, b, slot);
    }
    for (const u of w.units) u.hp = u.maxHp;
    for (const g of w.gems) for (const p of w.players) levelUp(p, g.value);
    w.gems = [];
    w.notice = 'รอดแล้ว! +' + costText(gain) + ' · ซ่อมฐานและเลือกพร';
  }
}
export function reward(w: World) {
  return Math.max(
    0,
    (w.wave - (w.phase === 'battle' || w.phase === 'over' ? 1 : 0)) * 12 +
      Math.floor(w.kills / 5) +
      Math.floor(w.elapsed / 60) * 2,
  );
}
