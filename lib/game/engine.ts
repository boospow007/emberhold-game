export type Weapon = 'bow' | 'sword' | 'staff';
export type MapId = 'forest' | 'desert' | 'snow';
export type BuildKind = 'tower' | 'wall' | 'farm' | 'frost' | 'shrine';
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
  gold: number;
  kills: number;
  players: Player[];
  enemies: Enemy[];
  buildings: Building[];
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
export const BUILDINGS: Record<
  BuildKind,
  { name: string; cost: number; hp: number; desc: string; tab: string }
> = {
  tower: {
    name: 'ป้อมธนู',
    cost: 35,
    hp: 180,
    desc: 'ยิงไกล • เลือกสายยิงเร็ว / ยิงหนัก',
    tab: 'defense',
  },
  wall: {
    name: 'กำแพง',
    cost: 12,
    hp: 330,
    desc: 'รับแรงบุก • ยื้อเวลาให้ป้อม',
    tab: 'defense',
  },
  farm: {
    name: 'โรงสี',
    cost: 40,
    hp: 120,
    desc: '+18 เหรียญเมื่อผ่านแต่ละ Wave',
    tab: 'economy',
  },
  frost: {
    name: 'ป้อมเวท',
    cost: 60,
    hp: 160,
    desc: 'ยิงเวทชะลอศัตรูเป็นกลุ่ม',
    tab: 'defense',
  },
  shrine: {
    name: 'ศาลาฟื้นฟู',
    cost: 55,
    hp: 140,
    desc: 'ฟื้นฟูผู้เล่นในระยะรอบอาคาร',
    tab: 'economy',
  },
};
export const COLORS = [0xf8c66c, 0x85c8ee, 0xd3a2ef, 0xf6a29b];
export const dist = (
  a: { x: number; z: number },
  b: { x: number; z: number },
) => Math.hypot(a.x - b.x, a.z - b.z);
const terrainCache = new Map<
  MapId,
  { x: number; z: number; r: number; kind: string }[]
>();
export function obstacles(map: MapId) {
  const cached = terrainCache.get(map);
  if (cached) return cached;
  let seed = map === 'forest' ? 73 : map === 'desert' ? 197 : 331;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const out: { x: number; z: number; r: number; kind: string }[] = [];
  for (let i = 0; i < 65; i++) {
    const x = Math.round((rand() - 0.5) * 46),
      z = Math.round((rand() - 0.5) * 46);
    if (
      Math.hypot(x, z) < 7 ||
      out.some((o) => Math.hypot(o.x - x, o.z - z) < 2.8)
    )
      continue;
    out.push({
      x,
      z,
      r: 0.65 + rand() * 0.5,
      kind: map === 'desert' ? 'rock' : rand() > 0.3 ? 'tree' : 'rock',
    });
  }
  terrainCache.set(map, out);
  return out;
}
const fields = new Map<string, Int16Array>();
function waypoint(
  map: MapId,
  from: { x: number; z: number },
  target: { x: number; z: number },
) {
  const obs = obstacles(map);
  const tx = Math.max(-23, Math.min(23, Math.round(target.x))),
    tz = Math.max(-23, Math.min(23, Math.round(target.z)));
  const key = map + ':' + tx + ':' + tz;
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
export function newWorld(map: MapId): World {
  return {
    run: crypto.randomUUID(),
    map,
    phase: 'prep',
    wave: 0,
    timer: 40,
    elapsed: 0,
    gold: 115,
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
    effects: [],
    gems: [],
    left: 0,
    spawn: 0,
    serial: 0,
    acks: {},
    notice: 'สร้างแนวป้องกันก่อนเริ่ม Wave แรก',
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
  return (
    !w.buildings.some(
      (b) =>
        dist(b, { x, z }) <
        (b.kind === 'keep' ? 2.6 : b.kind === 'wall' ? 0.8 : 1.1) + r,
    ) && !obstacles(w.map).some((o) => dist(o, { x, z }) < o.r + r)
  );
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
    if ((k === 'frost' || k === 'shrine') && !p.unlocks.includes(k))
      return 'ยังไม่ได้ปลดล็อก';
    const d = BUILDINGS[k];
    const x = Math.round((c.x ?? 999) * 2) / 2,
      z = Math.round((c.z ?? 999) * 2) / 2;
    if (w.gold < d.cost) return 'เหรียญไม่พอ';
    if (!canBuild(w, k, x, z)) return 'พื้นที่นี้วางไม่ได้';
    if (w.buildings.length >= 90) return 'ฐานมีสิ่งก่อสร้างเต็มแล้ว';
    w.gold -= d.cost;
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
    if (!b || b.kind === 'keep') return 'เลือกอาคารก่อน';
    if (dist(p, b) > 5) return 'เดินเข้าใกล้อาคารก่อน';
    if (b.level >= 3) return 'อัปเกรดเต็มแล้ว';
    if (!['rapid', 'heavy'].includes(c.branch || '')) return 'เลือกสายอัปเกรด';
    const cost = Math.round(BUILDINGS[b.kind].cost * (b.level === 1 ? 1 : 1.6));
    if (w.gold < cost) return 'เหรียญไม่พอ';
    w.gold -= cost;
    b.level++;
    b.branch = c.branch!;
    b.maxHp *= 1.65;
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
  obs: { x: number; z: number; r: number }[],
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
export function step(w: World, inputs: Record<string, Input>, dt: number) {
  if (w.phase === 'over') return;
  dt = Math.min(dt, 0.05);
  const obs = obstacles(w.map);
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
    move(p, input.x, input.z, 5.5, dt, obs, w.buildings);
    p.cool -= dt;
    p.lastHit += dt;
    if (p.lastHit > 4) p.hp = Math.min(p.maxHp, p.hp + dt * 4);
  }
  w.effects = w.effects.filter((e) => (e.life -= dt) > 0);
  if (w.phase === 'prep') {
    w.timer -= dt;
    if (w.timer <= 0) startWave(w);
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
  for (const p of w.players) {
    if (p.dead > 0) continue;
    const range = p.weapon === 'sword' ? 2.2 : p.weapon === 'bow' ? 8 : 6.5;
    const e = w.enemies
      .filter((e) => e.hp > 0 && dist(p, e) <= range)
      .sort((a, b) => dist(p, a) - dist(p, b))[0];
    if (e && p.cool <= 0) {
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
  }
  for (const b of w.buildings) {
    b.cool -= dt;
    if (b.kind === 'shrine') {
      for (const p of w.players)
        if (p.dead <= 0 && dist(p, b) < 5)
          p.hp = Math.min(p.maxHp, p.hp + dt * 5 * b.level);
      continue;
    }
    if (!['keep', 'tower', 'frost'].includes(b.kind) || b.cool > 0) continue;
    const range = b.kind === 'keep' ? 5 : b.branch === 'heavy' ? 9 : 7;
    const e = w.enemies
      .filter((e) => e.hp > 0 && dist(b, e) < range)
      .sort((a, c) => dist(b, a) - dist(b, c))[0];
    if (e) {
      b.cool =
        (b.kind === 'keep' ? 1.4 : 0.95) / (b.branch === 'rapid' ? 1.8 : 1);
      const dmg =
        (b.kind === 'keep' ? 14 : 18) *
        b.level *
        (b.branch === 'heavy' ? 1.8 : 1);
      e.hp -= dmg;
      if (b.kind === 'frost') {
        for (const ee of w.enemies)
          if (dist(e, ee) < 2.4) {
            ee.slow = 2;
            ee.hp -= dmg * 0.4;
          }
      }
      emit(w, b, e, b.kind === 'frost' ? 'staff' : 'arrow');
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
      const goal = waypoint(w.map, e, target);
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
    w.gold += e.kind === 'boss' ? 30 : 2;
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
      for (const pp of w.players) {
        pp.xp += g.value;
        while (pp.xp >= pp.level * 22) {
          pp.xp -= pp.level * 22;
          pp.level++;
          pp.picks++;
        }
      }
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
  w.buildings = w.buildings.filter((b) => b.hp > 0);
  if (w.left === 0 && w.enemies.length === 0) {
    w.phase = 'prep';
    w.timer = 30;
    const income =
      25 +
      w.buildings
        .filter((b) => b.kind === 'farm')
        .reduce((s, b) => s + 18 * b.level, 0);
    w.gold += income;
    for (const b of w.buildings) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.2);
    for (const p of w.players) {
      p.dead = 0;
      p.hp = p.maxHp;
    }
    for (const g of w.gems)
      for (const p of w.players) {
        p.xp += g.value;
        while (p.xp >= p.level * 22) {
          p.xp -= p.level * 22;
          p.level++;
          p.picks++;
        }
      }
    w.gems = [];
    w.notice = 'รอดแล้ว! +' + income + ' เหรียญ · ซ่อมฐานและเลือกพร';
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
