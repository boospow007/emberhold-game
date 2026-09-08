import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, addPlayer, step } from '../lib/game/engine.ts';
const origin = process.env.GAME_TEST_ORIGIN || 'http://localhost:3000';
function client() {
  let cookie = '';
  return async (action, data = {}) => {
    const r = await fetch(origin + '/api/game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ action, ...data }),
    });
    if (r.headers.get('set-cookie'))
      cookie = r.headers.get('set-cookie').split(';')[0];
    return { status: r.status, ...(await r.json()) };
  };
}
test('room discovery, joins, replicated input/builds, room limit and host authorization', async () => {
  const host = client(),
    guest = client(),
    third = client(),
    fourth = client(),
    fifth = client();
  const hp = (await host('profile')).profile,
    gp = (await guest('profile')).profile;
  assert.notEqual(hp.id, gp.id);
  const r = await host('create', { map: 'forest', weapon: 'bow' });
  assert.equal(r.status, 200);
  assert.match(r.code, /^\d{6}$/);
  try {
    assert.ok((await guest('list')).rooms.some((x) => x.code === r.code));
    assert.equal(
      (await guest('join', { code: r.code, weapon: 'sword' })).status,
      200,
    );
    assert.equal(
      (await third('join', { code: r.code, weapon: 'staff' })).status,
      200,
    );
    assert.equal(
      (await fourth('join', { code: r.code, weapon: 'bow' })).status,
      200,
    );
    assert.equal(
      (await fifth('join', { code: r.code, weapon: 'bow' })).status,
      409,
    );
    const lobby = await host('lobby', { code: r.code });
    assert.equal(lobby.players.length, 4);
    assert.equal(lobby.players.find((p) => p.id === gp.id).weapon, 'sword');
    const world = newWorld('forest');
    for (const p of lobby.players) addPlayer(world, p, p.weapon);
    await host('sync', {
      code: r.code,
      snapshot: world,
      input: { x: 0, z: 0, commands: [] },
    });
    const first = await guest('sync', {
      code: r.code,
      input: {
        x: 1,
        z: 0,
        commands: [{ seq: 1, type: 'build', kind: 'tower', x: 4, z: 0 }],
      },
    });
    assert.equal(first.snapshot.run, world.run);
    const h = await host('sync', {
      code: r.code,
      snapshot: world,
      input: { x: 0, z: 0, commands: [] },
    });
    const beforeX = world.players.find((p) => p.id === gp.id).x;
    step(
      world,
      Object.fromEntries(h.players.map((p) => [p.id, p.input])),
      0.05,
    );
    assert.ok(world.players.find((p) => p.id === gp.id).x > beforeX);
    assert.equal(world.buildings.length, 2);
    await host('sync', { code: r.code, snapshot: world, input: {} });
    const g = await guest('sync', { code: r.code, input: {} });
    assert.equal(g.snapshot.buildings.length, 2);
    assert.equal(g.snapshot.gold, 80);
    assert.equal(g.snapshot.acks[gp.id], 1);
    const fake = { ...world, gold: 999999 };
    await guest('sync', { code: r.code, snapshot: fake, input: {} });
    assert.equal((await host('lobby', { code: r.code })).snapshot.gold, 80);
    assert.equal(
      (await fifth('join', { code: r.code, weapon: 'bow' })).status,
      404,
    );
    await guest('leave', { code: r.code });
    assert.equal((await host('lobby', { code: r.code })).players.length, 3);
    world.phase = 'over';
    world.wave = 3;
    world.kills = 30;
    world.elapsed = 90;
    await host('sync', { code: r.code, snapshot: world, input: {} });
    const claim = await host('claim');
    assert.equal(claim.profile.points, 32);
    const twice = await host('claim');
    assert.equal(twice.profile.points, 32);
    assert.equal((await host('purchase', { item: 'power' })).profile.power, 1);
    assert.equal((await host('purchase', { item: 'vitality' })).status, 400);
  } finally {
    await host('leave', { code: r.code });
  }
  assert.equal((await guest('lobby', { code: r.code })).status, 410);
});
test('solo rewards persist and cannot be redeemed twice', async () => {
  const c = client();
  const p = (await c('profile')).profile;
  const run = crypto.randomUUID();
  await c('solo-reward', { run, points: 60, wave: 4 });
  await c('solo-reward', { run, points: 60, wave: 4 });
  const fresh = await c('profile');
  assert.equal(fresh.profile.points, 60);
  assert.equal(fresh.profile.id, p.id);
  assert.equal(fresh.profile.best, 4);
  const bought = await c('purchase', { item: 'frost' });
  assert.deepEqual(bought.profile.unlocks, ['frost']);
  assert.equal(bought.profile.points, 0);
  assert.equal((await c('purchase', { item: 'frost' })).status, 400);
});
