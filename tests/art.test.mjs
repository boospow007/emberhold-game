import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { screenDirection } from '../lib/game/art.ts';

test('thumb directions project onto the same screen axes in the isometric camera', () => {
  const camera = new T.OrthographicCamera(-10, 10, 18, -18, 0.1, 260);
  camera.position.set(28, 34, 28);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const origin = new T.Vector3().project(camera);
  for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const world = screenDirection(x, y);
    assert.ok(Math.abs(Math.hypot(world.x, world.z) - 1) < 1e-9);
    const projected = new T.Vector3(world.x, 0, world.z).project(camera).sub(origin);
    if (x) {
      assert.ok(projected.x * x > 0);
      assert.ok(Math.abs(projected.y) < 1e-9);
    } else {
      // Pointer y grows downwards, while normalized device y grows upwards.
      assert.ok(projected.y * y < 0);
      assert.ok(Math.abs(projected.x) < 1e-9);
    }
  }
});
