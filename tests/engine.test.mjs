import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newWorld,
  addPlayer,
  command,
  canBuild,
  step,
  startWave,
  reward,
  workerCap,
  workersUsed,
  terrain,
  spawnRadius,
} from '../lib/game/engine.ts';
const profile = {
  id: 'p1',
  name: 'Tester',
  power: 0,
  vitality: 0,
  unlocks: [],
  points: 0,
  best: 0,
};
const make = () => {
  const w = newWorld('forest', 'TEST1');
  addPlayer(w, profile, 'bow');
  return w;
};
const give = (w, res) => Object.assign(w.res, res);
// A buildable plain cell at roughly the given distance from the keep.
const spotAt = (w, d) => {
  const t = terrain(w);
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    const x = Math.round(Math.cos(a) * d),
      z = Math.round(Math.sin(a) * d);
    if (
      t.cell(x, z) === 'plain' &&
      !w.terrain.some((o) => Math.hypot(o.x - x, o.z - z) < 2.5) &&
      !w.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < 3)
    )
      return { x, z };
  }
  throw new Error('no spot at ' + d);
};
const build = (w, kind, x, z, seq = ++build.seq) =>
  command(w, 'p1', { type: 'build', seq, kind, x, z });
build.seq = 100;
test('free placement enforces terrain, resources, tier, radius and phase rules', () => {
  const w = make();
  assert.equal(canBuild(w, 'tower', 0, 0), false);
  assert.equal(build(w, 'tower', 4, 0), '');
  assert.deepEqual([w.res.wood, w.res.gold], [35, 45]);
  assert.equal(w.buildings.length, 2);
  assert.equal(canBuild(w, 'tower', 4, 0), false);
  assert.match(build(w, 'frost', -4, 0), /ปลดล็อก/);
  assert.match(build(w, 'mine', -4, 0), /ฐานแม่/);
  give(w, { wood: 100 });
  assert.match(build(w, 'quarry', -4, 0), /ต้องวางบนหิน/);
  const far = spotAt(w, 15);
  assert.match(build(w, 'wall', far.x, far.z), /ห่างสิ่งก่อสร้าง/);
  assert.equal(canBuild(w, 'wall', far.x, far.z), false);
  startWave(w);
  assert.notEqual(build(w, 'tower', -4, 0), '');
});
test('buildings keep a snapped facing angle from the build command', () => {
  const w = make();
  give(w, { wood: 500, gold: 500 });
  assert.equal(
    command(w, 'p1', {
      type: 'build',
      seq: 901,
      kind: 'tower',
      x: 4,
      z: 0,
      angle: Math.PI / 2,
    }),
    '',
  );
  assert.ok(Math.abs(w.buildings.at(-1).angle - Math.PI / 2) < 1e-9);
  assert.equal(
    command(w, 'p1', {
      type: 'build',
      seq: 902,
      kind: 'wall',
      x: -4,
      z: 0,
      angle: -Math.PI / 2 + 0.2,
    }),
    '',
  );
  assert.ok(Math.abs(w.buildings.at(-1).angle - (3 * Math.PI) / 2) < 1e-9);
  assert.equal(
    command(w, 'p1', {
      type: 'build',
      seq: 903,
      kind: 'wall',
      x: 0,
      z: -4,
      angle: 'x',
    }),
    '',
  );
  assert.equal(w.buildings.at(-1).angle, 0);
});
test('defense buildings are limited by workers from keep and houses', () => {
  const w = make();
  give(w, { wood: 500, gold: 500 });
  assert.equal(workerCap(w), 3);
  assert.equal(build(w, 'tower', 4, 0), '');
  assert.equal(build(w, 'tower', -4, 0), '');
  assert.equal(build(w, 'tower', 0, 4), '');
  assert.match(build(w, 'tower', 0, -4), /คนงาน/);
  assert.equal(workersUsed(w), 3);
  assert.equal(build(w, 'house', 6, 6), '');
  assert.equal(workerCap(w), 5);
  assert.equal(build(w, 'tower', 0, -4), '');
});
test('keep level gates building tiers, upgrade levels and build radius', () => {
  const w = make();
  give(w, { wood: 500, gold: 500, stone: 500, iron: 500, food: 500 });
  assert.equal(build(w, 'tower', 4, 0), '');
  const tower = w.buildings[1];
  assert.match(
    command(w, 'p1', {
      seq: 1,
      type: 'upgrade',
      id: tower.id,
      branch: 'rapid',
    }),
    /ฐานแม่/,
  );
  w.players[0].x = -15;
  assert.match(
    command(w, 'p1', { seq: 2, type: 'upgrade', id: 'keep', branch: 'keep' }),
    /เดินเข้าใกล้/,
  );
  w.players[0].x = 0;
  w.players[0].z = 3;
  assert.equal(
    command(w, 'p1', { seq: 3, type: 'upgrade', id: 'keep', branch: 'keep' }),
    '',
  );
  assert.equal(w.buildings[0].level, 2);
  assert.equal(w.buildings[0].maxHp, 1500);
  assert.equal(w.res.wood, 500 - 25 - 60);
  assert.equal(w.res.stone, 470);
  assert.equal(workerCap(w), 5);
  assert.equal(
    command(w, 'p1', {
      seq: 4,
      type: 'upgrade',
      id: tower.id,
      branch: 'rapid',
    }),
    '',
  );
  assert.equal(tower.level, 2);
  assert.match(build(w, 'ballista', -4, 0), /ฐานแม่เป็นระดับ 3/);
});
test('placement chains from the nearest building, not just the keep', () => {
  const w = make();
  give(w, { wood: 500, gold: 500 });
  const t = terrain(w);
  const free = (x, z) =>
    t.cell(x, z) === 'plain' &&
    !w.terrain.some((o) => Math.hypot(o.x - x, o.z - z) < 2.5) &&
    !w.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < 3);
  let a = -1;
  for (let ang = 0; ang < Math.PI * 2 && a < 0; ang += 0.05) {
    const pts = [9, 16].map((d) => [
      Math.round(Math.cos(ang) * d),
      Math.round(Math.sin(ang) * d),
    ]);
    const opp = [
      Math.round(-Math.cos(ang) * 17),
      Math.round(-Math.sin(ang) * 17),
    ];
    if (pts.every(([x, z]) => free(x, z)) && free(...opp)) a = ang;
  }
  assert.ok(a >= 0, 'no test angle');
  const near = [Math.round(Math.cos(a) * 9), Math.round(Math.sin(a) * 9)];
  const chain = [Math.round(Math.cos(a) * 16), Math.round(Math.sin(a) * 16)];
  const opp = [Math.round(-Math.cos(a) * 17), Math.round(-Math.sin(a) * 17)];
  assert.match(
    build(w, 'wall', ...chain),
    /ห่างสิ่งก่อสร้าง/,
    'too far from the keep alone',
  );
  assert.equal(build(w, 'wall', ...near), '', 'within 8 (+2) of the keep');
  assert.equal(build(w, 'wall', ...chain), '', 'within 8 of the new wall');
  assert.match(
    build(w, 'wall', ...opp),
    /ห่างสิ่งก่อสร้าง/,
    'opposite side has no link',
  );
  assert.ok(spawnRadius(w) >= 16 + 16 - 1);
});
test('sawmills fell nearby trees for wood on a cadence and stop when the forest is gone', () => {
  const w = make();
  give(w, { wood: 500, gold: 500 });
  const tree = w.terrain
    .filter((o) => o.kind === 'tree')
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  assert.ok(tree, 'a tree on the map');
  const t = terrain(w);
  let spot = null;
  for (let dz = -3; dz <= 3 && !spot; dz++)
    for (let dx = -3; dx <= 3 && !spot; dx++) {
      const x = tree.x + dx,
        z = tree.z + dz;
      const d = Math.hypot(dx, dz);
      if (
        d >= 2 &&
        d <= 3.5 &&
        t.cell(x, z) === 'plain' &&
        !w.terrain.some((o) => Math.hypot(o.x - x, o.z - z) < 2.2)
      )
        spot = { x, z };
    }
  assert.ok(spot, 'a clear spot next to the tree');
  // Bring the base out to the forest edge so the sawmill is linked.
  w.buildings.push({
    id: 'link',
    kind: 'wall',
    x: spot.x - 3,
    z: spot.z,
    hp: 300,
    maxHp: 300,
    cool: 0,
    angle: 0,
    level: 1,
    branch: '',
  });
  w.buildings[0].level = 4;
  assert.equal(build(w, 'sawmill', spot.x, spot.z), '');
  const wood = w.res.wood;
  w.players[0].x = -20;
  w.players[0].z = -20;
  for (let i = 0; i < 20; i++) step(w, {}, 0.05);
  assert.equal(w.res.wood, wood + 5, 'first cut happens right away');
  for (let i = 0; i < 100; i++) step(w, {}, 0.05);
  assert.equal(w.res.wood, wood + 10, 'then one cut every 5 seconds');
  const trees = () =>
    w.terrain.filter(
      (o) => o.kind === 'tree' && Math.hypot(o.x - spot.x, o.z - spot.z) < 6,
    );
  const total = trees().reduce((sum, o) => sum + o.wood, 0) + 10;
  for (let i = 0; i < 20000 && trees().length > 0; i++) step(w, {}, 0.05);
  assert.equal(trees().length, 0);
  assert.equal(
    w.res.wood,
    wood + total,
    'every tree in range yields exactly its wood',
  );
  const after = w.res.wood;
  for (let i = 0; i < 400; i++) step(w, {}, 0.05);
  assert.equal(w.res.wood, after, 'no infinite wood once the forest is gone');
});
test('automatic ranged and melee attacks damage enemies without actions', () => {
  for (const weapon of ['bow', 'sword', 'staff']) {
    const w = make();
    w.players[0].weapon = weapon;
    w.phase = 'battle';
    w.left = 2;
    w.spawn = 999;
    const p = w.players[0];
    w.enemies.push({
      id: 'e',
      kind: 'crawler',
      x: p.x + 1,
      z: p.z,
      hp: 100,
      maxHp: 100,
      cool: 10,
      angle: 0,
      speed: 0,
      damage: 0,
      slow: 0,
    });
    step(w, {}, 0.05);
    assert.ok(w.enemies[0].hp < 100, weapon);
  }
});
test('remote commands are processed exactly once', () => {
  const w = make();
  const input = {
    x: 0,
    z: 0,
    commands: [{ seq: 1, type: 'build', kind: 'tower', x: 4, z: 0 }],
  };
  step(w, { p1: input }, 0.02);
  step(w, { p1: input }, 0.02);
  assert.equal(w.buildings.length, 2);
  assert.equal(w.res.wood, 35);
  assert.equal(w.acks.p1, 1);
});
test('day end pays income per building type and repairs surviving buildings', () => {
  const w = make();
  give(w, { wood: 500, gold: 500, stone: 500 });
  build(w, 'farm', 4, 0);
  w.buildings[0].level = 2;
  const rock = w.terrain.find(
    (o) => o.kind === 'rock' && Math.hypot(o.x, o.z) < 15,
  );
  build(w, 'goldmine', rock.x, rock.z);
  const gold = w.res.gold,
    food = w.res.food;
  w.phase = 'battle';
  w.wave = 1;
  w.left = 0;
  w.buildings[1].hp = 60;
  step(w, {}, 0.02);
  assert.equal(w.phase, 'prep');
  assert.equal(w.res.gold, gold + 20 + 20);
  assert.equal(w.res.food, food + 10);
  assert.equal(w.buildings[1].hp, 84);
  assert.ok(reward(w) >= 12);
});
test('losing a house strains towers until capacity is restored', () => {
  const w = make();
  give(w, { wood: 500, gold: 500 });
  build(w, 'house', 6, 6);
  for (const [x, z] of [
    [4, 0],
    [-4, 0],
    [0, 4],
    [0, -4],
    [-5, -5],
  ])
    assert.equal(build(w, 'tower', x, z), '');
  assert.equal(workersUsed(w), 5);
  const house = w.buildings.find((b) => b.kind === 'house');
  house.hp = 0;
  w.phase = 'battle';
  w.left = 1;
  w.spawn = 999;
  step(w, {}, 0.05);
  assert.ok(workersUsed(w) > workerCap(w));
  assert.match(w.notice, /บ้านคนงาน/);
});
test('character death respawns, keep destruction ends the run', () => {
  const w = make();
  w.phase = 'battle';
  w.left = 1;
  w.spawn = 999;
  w.players[0].hp = 0;
  step(w, {}, 0.05);
  assert.equal(w.players[0].dead, 8);
  assert.notEqual(w.phase, 'over');
  for (let i = 0; i < 162; i++) step(w, {}, 0.05);
  assert.ok(w.players[0].hp > 0);
  w.buildings[0].hp = 0;
  step(w, {}, 0.05);
  assert.equal(w.phase, 'over');
});
test('perks cannot be taken without level-up, upgrades require proximity', () => {
  const w = make();
  assert.notEqual(
    command(w, 'p1', { seq: 1, type: 'perk', branch: 'power' }),
    '',
  );
  w.players[0].picks = 1;
  command(w, 'p1', { seq: 2, type: 'perk', branch: 'power' });
  assert.equal(w.players[0].power, 1.2);
  assert.equal(w.players[0].picks, 0);
  build(w, 'tower', 4, 0);
  w.buildings[0].level = 2;
  w.players[0].x = -15;
  assert.match(
    command(w, 'p1', {
      seq: 4,
      type: 'upgrade',
      id: w.buildings[1].id,
      branch: 'heavy',
    }),
    /เดินเข้าใกล้/,
  );
});
test('a complete first wave resolves without stranded enemies on each map', () => {
  for (const map of ['forest', 'desert', 'snow']) {
    const w = newWorld(map);
    addPlayer(w, profile, 'bow');
    w.buildings[0].hp = w.buildings[0].maxHp = 100000;
    w.players[0].maxHp = w.players[0].hp = 100000;
    w.players[0].power = 10;
    startWave(w);
    for (let i = 0; i < 24000 && w.phase === 'battle'; i++) step(w, {}, 0.05);
    assert.equal(
      w.phase,
      'prep',
      map +
        ': enemies ' +
        w.enemies.map((e) => `${e.x.toFixed(1)},${e.z.toFixed(1)}`).join(';'),
    );
  }
});
