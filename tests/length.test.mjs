import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newWorld,
  addPlayer,
  step,
  startWave,
  reward,
  daysSurvived,
  bossCount,
  isFinal,
  LENGTHS,
  LENGTH_BONUS,
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
const godMode = (w) => {
  w.buildings[0].hp = w.buildings[0].maxHp = 1e9;
  w.players[0].maxHp = w.players[0].hp = 1e9;
  w.players[0].power = 50;
};
const finishWave = (w) => {
  for (let i = 0; i < 40000 && w.phase === 'battle'; i++) step(w, {}, 0.05);
};
test('length options are validated and default to unlimited', () => {
  assert.deepEqual(LENGTHS, [30, 80, 100, 120, 150, 0]);
  assert.equal(newWorld('forest', 'TEST1', 80).days, 80);
  assert.equal(newWorld('forest', 'TEST1', 77).days, 0);
  assert.equal(newWorld('forest', 'TEST1').days, 0);
});
test('boss waves every 10 days bring several bosses, the final night doubles the horde', () => {
  const w = newWorld('forest', 'TEST1', 30);
  addPlayer(w, profile, 'bow');
  w.wave = 4;
  startWave(w);
  assert.equal(w.wave, 5);
  assert.equal(bossCount(w), 1);
  const normal = w.left;
  w.phase = 'prep';
  w.wave = 9;
  startWave(w);
  assert.equal(bossCount(w), 3);
  assert.ok(
    w.left > Math.round((9 + 10 * 5) * 1.25),
    'boss wave has more enemies',
  );
  w.phase = 'prep';
  w.wave = 29;
  startWave(w);
  assert.ok(isFinal(w));
  assert.equal(bossCount(w), 4);
  assert.equal(w.left, Math.round((9 + 30 * 5) * 2));
  assert.match(w.notice, /คืนสุดท้าย/);
  assert.ok(normal < w.left);
});
test('surviving the final night wins the run with a completion bonus', () => {
  const w = newWorld('forest', 'TEST1', 30);
  addPlayer(w, profile, 'bow');
  godMode(w);
  w.wave = 29;
  w.phase = 'prep';
  startWave(w);
  let bosses = 0;
  const seen = new Set();
  for (let i = 0; i < 40000 && w.phase === 'battle'; i++) {
    step(w, {}, 0.05);
    for (const e of w.enemies)
      if (e.kind === 'boss' && !seen.has(e.id)) {
        seen.add(e.id);
        bosses++;
      }
  }
  assert.equal(w.phase, 'over');
  assert.equal(w.won, true);
  assert.equal(bosses, 4);
  assert.equal(daysSurvived(w), 30);
  assert.equal(
    reward(w) - (Math.floor(w.kills / 5) + Math.floor(w.elapsed / 60) * 2),
    30 * 12 + LENGTH_BONUS[30],
  );
  assert.match(w.notice, /รุ่งเช้า/);
  step(w, {}, 0.05);
  assert.equal(w.phase, 'over', 'a won run stays finished');
});
test('unlimited runs never win and losing the keep is never a win', () => {
  const w = newWorld('forest', 'TEST1', 0);
  addPlayer(w, profile, 'bow');
  godMode(w);
  w.wave = 149;
  w.phase = 'prep';
  startWave(w);
  assert.equal(isFinal(w), false);
  finishWave(w);
  assert.equal(w.phase, 'prep');
  assert.equal(w.won, false);
  const lost = newWorld('forest', 'TEST1', 30);
  addPlayer(lost, profile, 'bow');
  lost.wave = 29;
  lost.phase = 'prep';
  startWave(lost);
  lost.buildings[0].hp = 0;
  step(lost, {}, 0.05);
  assert.equal(lost.phase, 'over');
  assert.equal(lost.won, false);
  assert.equal(daysSurvived(lost), 29);
  assert.equal(reward(lost), 29 * 12 + Math.floor(lost.kills / 5));
});
