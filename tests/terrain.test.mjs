import test from 'node:test';
import assert from 'node:assert/strict';
import {
  terrainOf,
  generateObstacles,
  reachableFrom,
  normalizeSeed,
  weeklySeed,
  HALF,
  WATER_LEVEL,
} from '../lib/game/terrain.ts';
import {
  newWorld,
  addPlayer,
  step,
  command,
  reachable,
  spawnRadius,
  startWave,
  terrain,
  fieldFor,
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
const SEEDS = [
  'TEST1',
  'ALPHA',
  'BRAVO',
  'CHARLI',
  'DELTA',
  'ECHO7',
  'FOX',
  'GOLF9',
];
test('seed normalisation and weekly seed are stable', () => {
  assert.equal(normalizeSeed(' ab-c1 xyz!! '), 'ABC1XYZ');
  assert.equal(normalizeSeed('ab'), '');
  assert.equal(normalizeSeed('abcdefghijkl'), 'ABCDEFGH');
  assert.equal(weeklySeed(new Date('2026-09-08T12:00:00Z')), 'WK2637');
  assert.equal(weeklySeed(new Date('2026-09-13T23:00:00Z')), 'WK2637');
  assert.equal(weeklySeed(new Date('2026-09-14T01:00:00Z')), 'WK2638');
});
test('the same seed and map always produce identical terrain and obstacles', () => {
  for (const map of ['forest', 'desert', 'snow']) {
    const a = terrainOf('SAME', map).heights,
      b = terrainOf('SAME', map).heights;
    assert.deepEqual(Array.from(a.slice(0, 500)), Array.from(b.slice(0, 500)));
    const oa = generateObstacles('SAME', map),
      ob = generateObstacles('SAME', map);
    assert.deepEqual(oa, ob);
    assert.ok(oa.length > 150, map + ' obstacle count ' + oa.length);
    assert.notDeepEqual(
      Array.from(terrainOf('OTHER', map).heights.slice(0, 50)),
      Array.from(a.slice(0, 50)),
    );
  }
});
test('every map has water, plains, hills and a flat passable keep site', () => {
  for (const map of ['forest', 'desert', 'snow'])
    for (const seed of SEEDS) {
      const t = terrainOf(seed, map);
      const kinds = new Set();
      for (let z = -HALF; z <= HALF; z += 3)
        for (let x = -HALF; x <= HALF; x += 3) kinds.add(t.cell(x, z));
      assert.ok(kinds.has('water'), `${map}/${seed} no water`);
      assert.ok(kinds.has('plain'), `${map}/${seed} no plains`);
      assert.ok(kinds.has('hill'), `${map}/${seed} no hills`);
      for (let z = -5; z <= 5; z++)
        for (let x = -5; x <= 5; x++)
          assert.equal(
            t.cell(x, z),
            'plain',
            `${map}/${seed} keep site ${x},${z}`,
          );
      const obs = generateObstacles(seed, map);
      for (const o of obs)
        assert.ok(
          t.land(o.x, o.z),
          `${map}/${seed} obstacle on ${t.cell(o.x, o.z)}`,
        );
    }
});
test('the outer ring can reach the keep on every seed, and wave spawns are reachable', () => {
  for (const map of ['forest', 'desert', 'snow'])
    for (const seed of SEEDS) {
      const t = terrainOf(seed, map);
      const reach = reachableFrom(t, 0, 0, () => true);
      let open = 0,
        total = 0;
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        total++;
        if (
          reach[
            t.index(
              Math.round(Math.cos(a) * (HALF - 2)),
              Math.round(Math.sin(a) * (HALF - 2)),
            )
          ]
        )
          open++;
      }
      assert.ok(
        open > total * 0.3,
        `${map}/${seed} ring open ${open}/${total}`,
      );
      const w = newWorld(map, seed);
      addPlayer(w, profile, 'bow');
      assert.equal(w.seed, seed);
      startWave(w);
      const seen = new Set();
      for (let i = 0; i < 200 && seen.size < 5; i++) {
        step(w, {}, 0.05);
        for (const e of w.enemies) {
          if (seen.has(e.id)) continue;
          seen.add(e.id);
          const near = [0, 1, -1].some((dx) =>
            [0, 1, -1].some((dz) =>
              reachable(w, Math.round(e.x) + dx, Math.round(e.z) + dz),
            ),
          );
          assert.ok(near, `${map}/${seed} enemy at ${e.x},${e.z} unreachable`);
          assert.ok(Math.hypot(e.x, e.z) <= spawnRadius(w) + 1.5);
        }
      }
      assert.ok(seen.size >= 5, `${map}/${seed} spawned ${seen.size}`);
    }
});
test('water and mountains block movement, bridges open water for everyone', () => {
  const w = newWorld('forest', 'TEST1');
  addPlayer(w, profile, 'bow');
  const t = terrain(w);
  let water = null;
  for (let z = -HALF + 2; z <= HALF - 2 && !water; z++)
    for (let x = -HALF + 2; x <= HALF - 2 && !water; x++)
      if (
        Math.hypot(x, z) < 38 &&
        t.cell(x, z) === 'water' &&
        t.cell(x - 1, z) === 'plain' &&
        t.cell(x - 2, z) === 'plain' &&
        t.cell(x + 1, z) === 'water' &&
        !generateObstacles('TEST1', 'forest').some(
          (o) => Math.hypot(o.x - x, o.z - z) < 3,
        )
      )
        water = { x, z };
  assert.ok(water, 'no shoreline found');
  const p = w.players[0];
  p.x = water.x - 1;
  p.z = water.z;
  for (let i = 0; i < 20; i++)
    step(w, { p1: { x: 1, z: 0, commands: [] } }, 0.05);
  assert.ok(p.x < water.x - 0.4, 'player walked onto water');
  assert.equal(reachable(w, water.x, water.z), false);
  const keep = w.buildings[0];
  keep.level = 4;
  w.res.wood = 500;
  // Placement chains from the nearest building: give the far shore a link.
  w.buildings.push({
    id: 'link',
    kind: 'wall',
    x: water.x - 1,
    z: water.z + 2,
    hp: 300,
    maxHp: 300,
    cool: 0,
    angle: 0,
    level: 1,
    branch: '',
  });
  assert.equal(
    command(w, 'p1', {
      seq: 1,
      type: 'build',
      kind: 'bridge',
      x: water.x,
      z: water.z,
    }),
    '',
  );
  assert.match(
    command(w, 'p1', {
      seq: 2,
      type: 'build',
      kind: 'bridge',
      x: water.x - 1,
      z: water.z,
    }),
    /บนน้ำ/,
  );
  for (let i = 0; i < 20; i++)
    step(w, { p1: { x: 1, z: 0, commands: [] } }, 0.05);
  assert.ok(p.x > water.x - 0.5, 'player could not cross the bridge');
  assert.equal(
    fieldFor(w, keep)[(water.z + HALF) * (HALF * 2 + 1) + water.x + HALF] >= 0,
    true,
  );
});
test('fisher huts need a shore and towers on hills gain range', () => {
  const w = newWorld('forest', 'TEST1');
  addPlayer(w, profile, 'bow');
  w.res.wood = 999;
  w.res.gold = 999;
  w.buildings[0].level = 4;
  const t = terrain(w);
  assert.match(
    command(w, 'p1', { seq: 1, type: 'build', kind: 'fisher', x: 4, z: 0 }),
    /ริมน้ำ/,
  );
  let shore = null;
  for (let z = -HALF + 3; z <= HALF - 3 && !shore; z++)
    for (let x = -HALF + 3; x <= HALF - 3 && !shore; x++)
      if (
        t.cell(x, z) === 'plain' &&
        t.cell(x + 2, z) === 'water' &&
        Math.hypot(x, z) < 40 &&
        !w.terrain.some((o) => Math.hypot(o.x - x, o.z - z) < 2.5)
      )
        shore = { x, z };
  assert.ok(shore);
  w.buildings.push({
    id: 'link',
    kind: 'wall',
    x: shore.x - 3,
    z: shore.z,
    hp: 300,
    maxHp: 300,
    cool: 0,
    angle: 0,
    level: 1,
    branch: '',
  });
  assert.equal(
    command(w, 'p1', { seq: 2, type: 'build', kind: 'fisher', ...shore }),
    '',
  );
  assert.ok(t.h(0, 0) >= WATER_LEVEL);
});
