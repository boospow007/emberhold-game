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
test('free placement enforces terrain, money, unlock and phase rules', () => {
  const w = make();
  assert.equal(canBuild(w, 'tower', 0, 0), false);
  assert.equal(
    command(w, 'p1', { type: 'build', seq: 1, kind: 'tower', x: 4, z: 0 }),
    '',
  );
  assert.equal(w.gold, 80);
  assert.equal(w.buildings.length, 2);
  assert.equal(canBuild(w, 'tower', 4, 0), false);
  assert.notEqual(
    command(w, 'p1', { type: 'build', seq: 2, kind: 'frost', x: -4, z: 0 }),
    '',
  );
  startWave(w);
  assert.notEqual(
    command(w, 'p1', { type: 'build', seq: 3, kind: 'tower', x: -4, z: 0 }),
    '',
  );
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
  assert.equal(w.gold, 80);
  assert.equal(w.acks.p1, 1);
});
test('wave completion pays farm income and repairs surviving buildings', () => {
  const w = make();
  command(w, 'p1', { seq: 1, type: 'build', kind: 'farm', x: 4, z: 0 });
  const before = w.gold;
  w.phase = 'battle';
  w.wave = 1;
  w.left = 0;
  w.buildings[0].hp = 700;
  step(w, {}, 0.02);
  assert.equal(w.phase, 'prep');
  assert.equal(w.gold, before + 43);
  assert.equal(w.buildings[0].hp, 900);
  assert.ok(reward(w) >= 12);
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
  command(w, 'p1', { seq: 3, type: 'build', kind: 'tower', x: 4, z: 0 });
  w.players[0].x = -15;
  assert.notEqual(
    command(w, 'p1', {
      seq: 4,
      type: 'upgrade',
      id: w.buildings[1].id,
      branch: 'heavy',
    }),
    '',
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
