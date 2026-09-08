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
  income,
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
  const w = newWorld('forest');
  addPlayer(w, profile, 'bow');
  return w;
};
const give = (w, res) => Object.assign(w.res, res);
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
  assert.match(build(w, 'quarry', -4, 0), /ฐานแม่/);
  assert.match(build(w, 'wall', 0, -14), /ไกลจากฐานแม่/);
  assert.equal(canBuild(w, 'wall', 0, -14), false);
  startWave(w);
  assert.notEqual(build(w, 'tower', -4, 0), '');
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
  assert.equal(build(w, 'wall', 0, -14), '');
  assert.match(build(w, 'mine', -4, 0), /ฐานแม่เป็นระดับ 3/);
});
test('quarries and mines must sit on matching resource nodes and replace them', () => {
  const w = make();
  give(w, { wood: 500, gold: 500, stone: 500 });
  w.buildings[0].level = 2;
  assert.match(build(w, 'quarry', 4, 0), /ต้องวางบนหิน/);
  const rock = w.terrain.find(
    (o) => o.kind === 'rock' && Math.hypot(o.x, o.z) < 15,
  );
  assert.ok(rock);
  const before = w.terrain.length;
  assert.equal(build(w, 'quarry', rock.x + 0.5, rock.z), '');
  assert.equal(w.terrain.length, before - 1);
  const q = w.buildings.at(-1);
  assert.deepEqual([q.kind, q.x, q.z], ['quarry', rock.x, rock.z]);
  assert.equal(income(w).stone, 12);
});
test('the hero chops nearby trees for wood and clears them when exhausted', () => {
  const w = make();
  const tree = w.terrain.find((o) => o.kind === 'tree');
  const p = w.players[0];
  p.x = tree.x + tree.r + 0.5;
  p.z = tree.z;
  const wood = w.res.wood;
  step(w, {}, 0.05);
  assert.equal(p.task, 'chop');
  assert.equal(w.res.wood, wood + 5);
  for (let i = 0; i < 200 && w.terrain.includes(tree); i++) step(w, {}, 0.05);
  assert.ok(!w.terrain.includes(tree));
  assert.equal(w.res.wood, wood + 30);
  assert.equal(p.task, '');
});
test('prep phase never starts a wave on its own', () => {
  const w = make();
  for (let i = 0; i < 2000; i++) step(w, {}, 0.05);
  assert.equal(w.phase, 'prep');
  assert.equal(w.wave, 0);
  command(w, 'p1', { seq: 1, type: 'next' });
  assert.equal(w.phase, 'battle');
  assert.equal(w.wave, 1);
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
