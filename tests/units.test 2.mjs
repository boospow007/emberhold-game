import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newWorld,
  addPlayer,
  command,
  step,
  following,
  workersUsed,
  workerCap,
  terrain,
  BASE_STACK,
} from '../lib/game/engine.ts';
const profile = (squad = 0) => ({
  id: 'p1',
  name: 'Tester',
  power: 0,
  vitality: 0,
  unlocks: [],
  points: 0,
  best: 0,
  squad,
});
const spotAt = (w, d) => {
  const t = terrain(w);
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    const x = Math.round(Math.cos(a) * d),
      z = Math.round(Math.sin(a) * d);
    if (
      t.cell(x, z) === 'plain' &&
      !w.terrain.some((o) => Math.hypot(o.x - x, o.z - z) < 2.5) &&
      !w.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < 3.2)
    )
      return { x, z };
  }
  throw new Error('no spot at ' + d);
};
let seq = 0;
const cmd = (w, c) => command(w, 'p1', { seq: ++seq, ...c });
const make = (squad = 0) => {
  const w = newWorld('forest', 'TEST1');
  addPlayer(w, profile(squad), 'sword');
  Object.assign(w.res, {
    wood: 999,
    gold: 999,
    stone: 999,
    iron: 999,
    food: 999,
  });
  w.buildings[0].level = 4;
  return w;
};
test('army buildings spawn one soldier per level and consume workers per level', () => {
  const w = make();
  const s = spotAt(w, 5);
  assert.equal(cmd(w, { type: 'build', kind: 'barracks', ...s }), '');
  assert.equal(w.units.length, 1);
  assert.equal(w.units[0].kind, 'infantry');
  assert.equal(w.units[0].mode, 'hold');
  assert.equal(workersUsed(w), 1);
  const b = w.buildings[1];
  w.players[0].x = b.x;
  w.players[0].z = b.z + 2;
  assert.equal(cmd(w, { type: 'upgrade', id: b.id, branch: 'grow' }), '');
  assert.equal(w.units.length, 2);
  assert.equal(workersUsed(w), 2);
  const s2 = spotAt(w, 8);
  assert.equal(cmd(w, { type: 'build', kind: 'stable', ...s2 }), '');
  assert.equal(w.units.at(-1).kind, 'knight');
  assert.equal(workersUsed(w), 4);
});
test('upgrading a barracks needs free workers', () => {
  const w = make();
  const s = spotAt(w, 5);
  cmd(w, { type: 'build', kind: 'barracks', ...s });
  for (const [i, d] of [7, 9].entries()) {
    const t = spotAt(w, d);
    assert.equal(
      cmd(w, { type: 'build', kind: 'tower', ...t }),
      '',
      'tower ' + i,
    );
  }
  assert.equal(workersUsed(w), workerCap(w) - 6);
  w.buildings[0].level = 1;
  const b = w.buildings[1];
  w.players[0].x = b.x;
  w.players[0].z = b.z + 2;
  w.buildings[0].level = 4;
  assert.equal(workerCap(w), 9);
  for (let i = 0; i < 3; i++) {
    const t = spotAt(w, 11 + i * 2);
    cmd(w, { type: 'build', kind: 'tower', ...t });
  }
  assert.equal(workersUsed(w), 6);
  cmd(w, { type: 'build', kind: 'ballista', ...spotAt(w, 17) });
  cmd(w, { type: 'build', kind: 'tower', ...spotAt(w, 19) });
  assert.equal(workersUsed(w), 9);
  assert.match(cmd(w, { type: 'upgrade', id: b.id, branch: 'grow' }), /คนงาน/);
});
test('rally takes idle soldiers up to the stack, release holds them in place', () => {
  const w = make(2);
  const p = w.players[0];
  assert.equal(p.stack, BASE_STACK + 2);
  for (const d of [5, 8, 11, 14, 17]) {
    const s = spotAt(w, d);
    assert.equal(cmd(w, { type: 'build', kind: 'barracks', ...s }), '');
  }
  assert.equal(w.units.length, 5);
  p.x = 0;
  p.z = 3;
  assert.match(cmd(w, { type: 'release' }), /ไม่มีทหาร/);
  assert.equal(cmd(w, { type: 'rally' }), '');
  assert.equal(
    following(w, 'p1').length,
    2,
    'only soldiers within 9 units rally',
  );
  p.x = w.units[2].x;
  p.z = w.units[2].z;
  assert.equal(cmd(w, { type: 'rally' }), '');
  assert.equal(following(w, 'p1').length, 4);
  assert.match(cmd(w, { type: 'rally' }), /เต็ม/);
  for (let i = 0; i < 40; i++)
    step(w, { p1: { x: 1, z: 0, commands: [] } }, 0.05);
  for (const u of following(w, 'p1'))
    assert.ok(
      Math.hypot(u.x - p.x, u.z - p.z) < 4,
      'soldier keeps up ' + Math.hypot(u.x - p.x, u.z - p.z),
    );
  const before = following(w, 'p1').map((u) => ({ x: u.x, z: u.z }));
  assert.equal(cmd(w, { type: 'release' }), '');
  assert.equal(following(w, 'p1').length, 0);
  for (let i = 0; i < 40; i++)
    step(w, { p1: { x: 1, z: 0, commands: [] } }, 0.05);
  const held = w.units.filter((u) => u.mode === 'hold');
  for (const [i, u] of held.slice(0, before.length).entries())
    assert.ok(
      Math.hypot(u.x - before[i].x, u.z - before[i].z) < 1.2,
      'held soldier stays put',
    );
});
test('rally and release work during battle and are limited to your own stack', () => {
  const w = make();
  cmd(w, { type: 'build', kind: 'barracks', ...spotAt(w, 5) });
  cmd(w, { type: 'build', kind: 'barracks', ...spotAt(w, 7) });
  cmd(w, { type: 'build', kind: 'barracks', ...spotAt(w, 9) });
  w.phase = 'battle';
  w.left = 0;
  w.spawn = 999;
  w.enemies.push({
    id: 'far',
    kind: 'crawler',
    x: 40,
    z: 40,
    hp: 50,
    maxHp: 50,
    cool: 9,
    angle: 0,
    speed: 0,
    damage: 0,
    slow: 0,
  });
  w.players[0].x = 0;
  w.players[0].z = 4;
  assert.equal(cmd(w, { type: 'rally' }), '');
  assert.equal(following(w, 'p1').length, BASE_STACK);
  assert.equal(cmd(w, { type: 'release' }), '');
});
test('soldiers fight enemies near their post, die, and are replaced at dawn', () => {
  const w = make();
  const s = spotAt(w, 6);
  cmd(w, { type: 'build', kind: 'barracks', ...s });
  const u = w.units[0];
  w.phase = 'battle';
  w.left = 0;
  w.spawn = 999;
  w.players[0].x = -20;
  w.players[0].z = -20;
  w.enemies.push({
    id: 'e1',
    kind: 'crawler',
    x: u.x + 1,
    z: u.z,
    hp: 60,
    maxHp: 60,
    cool: 99,
    angle: 0,
    speed: 0,
    damage: 0,
    slow: 0,
  });
  for (let i = 0; i < 40; i++) step(w, {}, 0.05);
  assert.ok(
    w.enemies.length === 0 || w.enemies[0].hp < 60,
    'soldier attacked the enemy',
  );
  u.hp = 0;
  step(w, {}, 0.05);
  assert.equal(w.units.length, 0);
  w.enemies = [];
  w.left = 0;
  step(w, {}, 0.05);
  assert.equal(w.phase, 'prep');
  assert.equal(w.units.length, 1, 'barracks respawned its soldier at dawn');
});
test('soldiers vanish when their barracks is destroyed, enemies target soldiers', () => {
  const w = make();
  const s = spotAt(w, 6);
  cmd(w, { type: 'build', kind: 'barracks', ...s });
  const b = w.buildings[1];
  const u = w.units[0];
  const post = spotAt(w, 14);
  Object.assign(u, { x: post.x, z: post.z, px: post.x, pz: post.z });
  w.phase = 'battle';
  w.left = 0;
  w.spawn = 999;
  w.players[0].x = -20;
  w.players[0].z = -20;
  w.enemies.push({
    id: 'e1',
    kind: 'crawler',
    x: u.x + 2.5,
    z: u.z,
    hp: 5000,
    maxHp: 5000,
    cool: 0,
    angle: 0,
    speed: 1.6,
    damage: 30,
    slow: 0,
  });
  for (let i = 0; i < 30; i++) step(w, {}, 0.05);
  assert.ok(
    u.hp < u.maxHp || w.units.length === 0,
    'enemy engaged the soldier',
  );
  b.hp = 0;
  w.enemies = [];
  step(w, {}, 0.05);
  assert.equal(w.units.length, 0);
});
