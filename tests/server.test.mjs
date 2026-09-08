// Needs the realtime server running: `cd server && PVP_SECRET=test-secret npm run dev`
// (or without PVP_SECRET for dev-open mode; tickets are then ignored).
import test from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify } from '../server/src/ticket.ts';
const origin = process.env.PVP_TEST_ORIGIN || 'http://localhost:8787';
const secret = process.env.PVP_SECRET || 'test-secret';
test('tickets verify only with the right secret and before expiry', () => {
  const t = sign({ id: 'abc', name: 'A', exp: Date.now() + 60000 }, 'k1');
  assert.equal(verify(t, 'k1')?.id, 'abc');
  assert.equal(verify(t, 'k2'), null);
  assert.equal(verify(t + 'x', 'k1'), null);
  assert.equal(
    verify(sign({ id: 'abc', name: 'A', exp: Date.now() - 1 }, 'k1'), 'k1'),
    null,
  );
});
test('health reports and the websocket echoes for a valid ticket', async () => {
  const health = await (await fetch(origin + '/health')).json();
  assert.equal(health.ok, true);
  const ticket = sign(
    { id: 'p1', name: 'Tester', exp: Date.now() + 60000 },
    secret,
  );
  const ws = new WebSocket(
    origin.replace(/^http/, 'ws') + '/ws?ticket=' + ticket,
  );
  const messages = [];
  const got = (n) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 4000);
      const check = () => {
        if (messages.length >= n) {
          clearTimeout(timer);
          resolve(messages);
        }
      };
      ws.addEventListener('message', (e) => {
        messages.push(JSON.parse(e.data));
        check();
      });
      ws.addEventListener('error', () => reject(new Error('socket error')));
      check();
    });
  await new Promise((r) => ws.addEventListener('open', r));
  ws.send(JSON.stringify({ type: 'ping' }));
  ws.send(JSON.stringify({ type: 'input', x: 1 }));
  await got(3);
  assert.equal(messages[0].type, 'hello');
  assert.equal(messages[0].id, 'p1');
  assert.equal(messages[1].type, 'pong');
  assert.deepEqual(messages[2], { type: 'echo', msg: { type: 'input', x: 1 } });
  ws.close();
});
test('a forged ticket is rejected at the upgrade', async () => {
  const bad = sign({ id: 'p1', name: 'X', exp: Date.now() + 60000 }, 'wrong');
  const ws = new WebSocket(origin.replace(/^http/, 'ws') + '/ws?ticket=' + bad);
  const outcome = await new Promise((resolve) => {
    ws.addEventListener('open', () => resolve('open'));
    ws.addEventListener('error', () => resolve('rejected'));
    ws.addEventListener('close', () => resolve('rejected'));
  });
  assert.equal(outcome, 'rejected');
});
