export type Weapon = 'bow' | 'sword' | 'staff';
export type MapId = 'forest' | 'desert' | 'snow';
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
  | 'ballista';
export type ObstacleKind = 'tree' | 'rock' | 'ore';
export type Obstacle = {
  id: number;
  x: number;
  z: number;
  r: number;
  kind: ObstacleKind;
  wood: number;
};
export type Profile = {
  id: string;
  name: string;
  points: number;
  power: number;
  vitality: number;
  unlocks: string[];
  best: number;
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
  type: 'build' | 'upgrade' | 'next' | 'perk';
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
  phase: 'prep' | 'battle' | 'over';
  wave: number;
  timer: number;
  elapsed: number;
  res: Record<Resource, number>;
  kills: number;
  players: Player[];
  enemies: Enemy[];
  buildings: Building[];
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
  tab: 'defense' | 'economy' | 'housing';
  tier: number;
  workers: number;
  node?: ObstacleKind;
  upgrades?: Cost[];
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
};
export const KEEP_MAX = 4;
export const KEEP_UPGRADES: Cost[] = [
  { wood: 60, stone: 30 },
  { stone: 60, iron: 30 },
  { iron: 60, gold: 200 },
];
export const KEEP_RADIUS = [0, 11, 15, 19, 23];
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
export function obstacles(map: MapId): Obstacle[] {
  let seed = map === 'forest' ? 73 : map === 'desert' ? 197 : 331;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const out: Obstacle[] = [];
  let rocks = 0;
  for (let i = 0; i < 65; i++) {
    const x = Math.round((rand() - 0.5) * 46),
      z = Math.round((rand() - 0.5) * 46);
    const r = 0.65 + rand() * 0.5;
    const roll = rand();
    if (
      Math.hypot(x, z) < 7 ||
      out.some((o) => Math.hypot(o.x - x, o.z - z) < 2.8)
    )
      continue;
    let kind: ObstacleKind = map === 'desert' || roll <= 0.3 ? 'rock' : 'tree';
    if (kind === 'rock' && ++rocks % 3 === 0) kind = 'ore';
    out.push({
      id: out.length + 1,
      x,
      z,
      r,
      kind,
      wood: kind === 'tree' ? 30 : 0,
    });
  }
  return out;
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
    (s, b) => s + (b.kind === 'keep' ? 0 : BUILDINGS[b.kind].workers),
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
export function newWorld(map: MapId): World {
  return {
    run: crypto.randomUUID(),
    map,
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
    terrain: obstacles(map),
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
  });
}
export function canBuild(w: World, kind: BuildKind, x: number, z: number) {
  const r = kind === 'wall' ? 0.7 : 1.05;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    Math.abs(x) > 22 ||
    Math.abs(z) > 22
  )
    return false;
  if (Math.hypot(x, z) > buildRadius(w)) return false;
  const node = nodeAt(w, kind, x, z);
  if (BUILDINGS[kind].node && !node) return false;
  return (
    !w.buildings.some(
      (b) =>
        dist(b, { x, z }) <
        (b.kind === 'keep' ? 2.6 : b.kind === 'wall' ? 0.8 : 1.1) + r,
    ) && !w.terrain.some((o) => o !== node && dist(o, { x, z }) < o.r + r)
  );
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
    w.buildings.push({
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
    });
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
function waypoint(
  w: World,
  from: { x: number; z: number },
  target: { x: number; z: number },
) {
  const obs = w.terrain;
  const tx = Math.max(-23, Math.min(23, Math.round(target.x))),
    tz = Math.max(-23, Math.min(23, Math.round(target.z)));
  const key = w.map + ':' + w.terrainVersion + ':' + tx + ':' + tz;
  const size = 49,
    index = (x: number, z: number) => (z + 24) * size + x + 24;
  let field = fields.get(key);
  if (!field) {
    field = new Int16Array(size * size);
    field.fill(-1);
    for (let z = -24; z <= 24; z++)
      for (let x = -24; x <= 24; x++)
        if (obs.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.85))
          field[index(x, z)] = -2;
    const queue: number[] = [index(tx, tz)];
    field[queue[0]] = 0;
    let at = 0;
    while (at < queue.length) {
      const a = queue[at++],
        x = a % size,
        z = Math.floor(a / size);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          nz = z + dz;
        if (nx < 0 || nx >= size || nz < 0 || nz >= size) continue;
        const ni = nz * size + nx;
        if (field[ni] !== -1) continue;
        field[ni] = field[a] + 1;
        queue.push(ni);
      }
    }
    if (fields.size > 50) fields.delete(fields.keys().next().value!);
    fields.set(key, field);
  }
  const x = Math.max(-23, Math.min(23, Math.round(from.x))),
    z = Math.max(-23, Math.min(23, Math.round(from.z)));
  let best = { x, z },
    score = 99999;
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx,
        nz = z + dz;
      if (Math.abs(nx) > 24 || Math.abs(nz) > 24) continue;
      const f = field[index(nx, nz)];
      if (f < 0) continue;
      if (
        dx &&
        dz &&
        (field[index(x + dx, z)] < 0 || field[index(x, z + dz)] < 0)
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
  u: { x: number; z: number; angle?: number },
  dx: number,
  dz: number,
  speed: number,
  dt: number,
  obs: Obstacle[],
  buildings: Building[],
  enemy = false,
) {
  const l = Math.hypot(dx, dz);
  if (l < 0.01) return;
  dx /= l;
  dz /= l;
  const nx = Math.max(-23, Math.min(23, u.x + dx * speed * dt)),
    nz = Math.max(-23, Math.min(23, u.z + dz * speed * dt));
  const blocked = (x: number, z: number) =>
    obs.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.3) ||
    buildings.some(
      (b) =>
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
    move(p, input.x, input.z, 5.5, dt, w.terrain, w.buildings);
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
    let spawnX = Math.round(Math.cos(angle) * 22),
      spawnZ = Math.round(Math.sin(angle) * 22);
    for (
      let attempt = 0;
      attempt < 30 &&
      obs.some((o) => Math.hypot(o.x - spawnX, o.z - spawnZ) < o.r + 1.5);
      attempt++
    ) {
      const a = angle + attempt * 0.3;
      spawnX = Math.round(Math.cos(a) * 22);
      spawnZ = Math.round(Math.sin(a) * 22);
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
      b.kind === 'keep'
        ? 5
        : b.kind === 'ballista'
          ? b.branch === 'heavy'
            ? 13
            : 11
          : b.branch === 'heavy'
            ? 9
            : 7;
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
    const nearby = w.players.filter((p) => p.dead <= 0 && dist(p, e) < 5);
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
        e,
        goal.x - e.x,
        goal.z - e.z,
        e.speed * (e.slow > 0 ? 0.45 : 1),
        dt,
        obs,
        w.buildings,
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
  w.buildings = w.buildings.filter((b) => b.hp > 0);
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
