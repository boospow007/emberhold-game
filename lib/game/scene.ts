import * as T from 'three';
import { World, MAPS, Obstacle, BuildKind, canBuild } from './engine';
export class GameScene {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(42, 1, 0.1, 180);
  renderer: T.WebGLRenderer;
  root: T.Group;
  entities = new Map<string, T.Group>();
  materials = new Map<number, T.MeshStandardMaterial>();
  ray = new T.Raycaster();
  plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  ghost: T.Group | null = null;
  ghostKind = '';
  localId = '';
  width = 1;
  height = 1;
  follow = new T.Vector3(0, 0, 3);
  map = '';
  resizeObserver: ResizeObserver;
  last = performance.now();
  effects = new T.Group();
  gemGroup = new T.Group();
  gemMeshes = new Map<number, T.Mesh>();
  gemGeometry = new T.OctahedronGeometry(0.14);
  terrainMeshes = new Map<number, T.Group>();
  disposed = false;
  constructor(
    public container: HTMLElement,
    map: World['map'],
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);
    const colors = MAPS[map];
    this.scene.background = new T.Color(colors.sky);
    this.scene.fog = new T.Fog(colors.sky, 48, 105);
    this.scene.add(new T.HemisphereLight(0xffeac4, 0x496579, 2.5));
    const sun = new T.DirectionalLight(0xffe3ab, 3.5);
    sun.position.set(-16, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -30,
      right: 30,
      top: 30,
      bottom: -30,
      near: 0.5,
      far: 90,
    });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.root = new T.Group();
    this.scene.add(this.root, this.effects, this.gemGroup);
    const ground = this.box(50, 0.7, 50, colors.ground);
    ground.position.y = -0.4;
    ground.receiveShadow = true;
    this.root.add(ground);
    const rim = this.box(51, 1.5, 51, colors.dark);
    rim.position.y = -1.45;
    this.root.add(rim);
    // Game terrain: procedural low-poly meshes, with deterministic collision geometry.
    const path = this.box(
      3,
      0.02,
      47,
      map === 'snow' ? 0xb6c8c7 : map === 'desert' ? 0xb89869 : 0x7d8861,
    );
    path.position.y = -0.02;
    this.root.add(path);
    const cross = this.box(
      47,
      0.02,
      2.5,
      map === 'snow' ? 0xb6c8c7 : map === 'desert' ? 0xb89869 : 0x7d8861,
    );
    this.root.add(cross);
    this.map = map;
    for (let i = 0; i < 110; i++) {
      const x = Math.sin(i * 173.3) * 24,
        z = Math.cos(i * 52.7) * 24;
      const peb = this.box(
        0.09 + (i % 3) * 0.06,
        0.07,
        0.12,
        map === 'snow' ? 0xd8e3de : 0x9cab76,
      );
      peb.position.set(x, 0, z);
      this.root.add(peb);
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }
  mat(color: number) {
    let m = this.materials.get(color);
    if (!m) {
      m = new T.MeshStandardMaterial({
        color,
        roughness: 0.9,
        flatShading: true,
      });
      this.materials.set(color, m);
    }
    return m;
  }
  box(w: number, h: number, d: number, c: number) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), this.mat(c));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  resize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.fov = this.width / this.height < 0.75 ? 48 : 42;
    this.camera.updateProjectionMatrix();
  }
  terrainMesh(o: Obstacle) {
    const g = new T.Group();
    const map = this.map;
    g.position.set(o.x, 0, o.z);
    if (o.kind === 'tree') {
      const trunk = this.box(0.35, 1.4, 0.35, 0x5d4733);
      trunk.position.y = 0.7;
      g.add(trunk);
      for (let j = 0; j < 3; j++) {
        const m = new T.Mesh(
          new T.ConeGeometry(o.r * 1.5 * (1 - j * 0.17), 2, 5),
          this.mat(
            map === 'snow'
              ? j === 2
                ? 0xdbe5dd
                : 0x72998e
              : j === 2
                ? 0x436e4e
                : 0x315b42,
          ),
        );
        m.position.y = 1.7 + j * 0.7;
        m.castShadow = true;
        g.add(m);
      }
    } else {
      const r = new T.Mesh(
        new T.DodecahedronGeometry(o.r),
        this.mat(
          o.kind === 'ore' ? 0x6b5a4a : map === 'desert' ? 0x8b654d : 0x7e8b83,
        ),
      );
      r.position.y = o.r * 0.45;
      r.scale.set(1, 1.1, 0.9);
      r.rotation.set(0.2, o.x, 0.3);
      r.castShadow = true;
      g.add(r);
      if (o.kind === 'ore') {
        for (let j = 0; j < 3; j++) {
          const vein = new T.Mesh(
            new T.OctahedronGeometry(0.16),
            new T.MeshStandardMaterial({
              color: 0xd9b25a,
              emissive: 0x4a3a10,
              roughness: 0.5,
              metalness: 0.6,
            }),
          );
          vein.position.set(
            Math.sin(j * 2.1 + o.x) * o.r * 0.6,
            o.r * 0.5 + j * 0.2,
            Math.cos(j * 2.1 + o.z) * o.r * 0.6,
          );
          g.add(vein);
        }
      }
    }
    return g;
  }
  syncTerrain(w: World) {
    const live = new Set<number>();
    for (const o of w.terrain) {
      live.add(o.id);
      let g = this.terrainMeshes.get(o.id);
      if (!g) {
        g = this.terrainMesh(o);
        this.root.add(g);
        this.terrainMeshes.set(o.id, g);
      }
      if (o.kind === 'tree') {
        const k = 0.6 + 0.4 * Math.min(1, o.wood / 30);
        g.scale.set(k, k, k);
      }
    }
    for (const [id, g] of this.terrainMeshes)
      if (!live.has(id)) {
        this.root.remove(g);
        this.disposeGeometry(g);
        this.terrainMeshes.delete(id);
      }
  }
  building(kind: string, branch = '', level = 1) {
    const g = new T.Group();
    if (kind === 'keep') {
      const base = this.box(3.2, 1, 3.2, 0xa9afa0);
      base.position.y = 0.5;
      g.add(base);
      const body = this.box(2.2, 2.2, 2.2, 0xd1c9ad);
      body.position.y = 1.6;
      g.add(body);
      const roof = new T.Mesh(
        new T.ConeGeometry(2, 1.7, 4),
        this.mat(0x335b55),
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 3.45;
      g.add(roof);
      for (const x of [-1.6, 1.6])
        for (const z of [-1.6, 1.6]) {
          const t = this.box(0.7, 2.4, 0.7, 0xb3b7a2);
          t.position.set(x, 1.2, z);
          g.add(t);
        }
      const flame = new T.Mesh(
        new T.OctahedronGeometry(0.45),
        new T.MeshBasicMaterial({ color: 0xffc46a }),
      );
      flame.position.y = 4.6;
      g.add(flame);
      const light = new T.PointLight(0xffc46a, 12, 12);
      light.position.y = 4;
      g.add(light);
    } else if (kind === 'wall') {
      const b = this.box(
        1.25,
        1.5 + (level - 1) * 0.3,
        1.25,
        level >= 2 ? 0x8d9294 : 0xa2aa98,
      );
      b.position.y = (1.5 + (level - 1) * 0.3) / 2;
      g.add(b);
      for (const x of [-0.43, 0.43]) {
        const c = this.box(0.35, 0.35, 1.25, level >= 2 ? 0xb3b7b5 : 0xc0c3ac);
        c.position.set(x, 1.65 + (level - 1) * 0.3, 0);
        g.add(c);
      }
    } else if (kind === 'farm') {
      const b = this.box(1.65, 1.2, 1.45, 0xd3b77f);
      b.position.y = 0.6;
      g.add(b);
      const r = new T.Mesh(new T.ConeGeometry(1.5, 1.1, 4), this.mat(0xa45c3d));
      r.rotation.y = Math.PI / 4;
      r.position.y = 1.65;
      g.add(r);
      const fan = new T.Group();
      fan.name = 'fan';
      for (let j = 0; j < 4; j++) {
        const blade = this.box(0.18, 1.2, 0.08, 0xf3dfaf);
        blade.position.y = 0.55;
        const pivot = new T.Group();
        pivot.rotation.z = (j * Math.PI) / 2;
        pivot.add(blade);
        fan.add(pivot);
      }
      fan.position.set(0, 1.8, 0.9);
      g.add(fan);
    } else if (kind === 'house') {
      const w = 1.3 + level * 0.15;
      const b = this.box(
        w,
        0.9 + level * 0.25,
        w,
        level >= 3 ? 0xc9c2ae : 0xd9b98a,
      );
      b.position.y = (0.9 + level * 0.25) / 2;
      g.add(b);
      const r = new T.Mesh(
        new T.ConeGeometry(w * 0.95, 0.9, 4),
        this.mat(level >= 2 ? 0x8a4a3a : 0xa45c3d),
      );
      r.rotation.y = Math.PI / 4;
      r.position.y = 0.9 + level * 0.25 + 0.45;
      g.add(r);
      const door = this.box(0.3, 0.45, 0.06, 0x4a3524);
      door.position.set(0, 0.23, w / 2 + 0.01);
      g.add(door);
    } else if (kind === 'sawmill') {
      const b = this.box(1.6, 0.9, 1.3, 0x8f6b48);
      b.position.y = 0.45;
      g.add(b);
      const r = this.box(1.9, 0.12, 1.6, 0x5d4733);
      r.position.y = 1.0;
      g.add(r);
      const blade = new T.Mesh(
        new T.CylinderGeometry(0.45, 0.45, 0.06, 12),
        this.mat(0xb9bcb5),
      );
      blade.rotation.z = Math.PI / 2;
      blade.position.set(0.9, 0.7, 0);
      blade.name = 'fan';
      g.add(blade);
      const log = this.box(0.3, 0.3, 1.4, 0x7a5a3c);
      log.position.set(-0.6, 1.2, 0);
      g.add(log);
    } else if (kind === 'quarry' || kind === 'goldmine' || kind === 'mine') {
      const base = new T.Mesh(
        new T.DodecahedronGeometry(1),
        this.mat(
          kind === 'goldmine'
            ? 0x8d7a55
            : kind === 'mine'
              ? 0x5a5150
              : 0x7e8b83,
        ),
      );
      base.position.y = 0.4;
      base.scale.set(1.1, 0.9, 1);
      g.add(base);
      const frame = this.box(0.9, 1.0, 0.12, 0x5d4733);
      frame.position.set(0, 0.5, 1.0);
      g.add(frame);
      const hole = this.box(0.6, 0.7, 0.06, 0x1b1a17);
      hole.position.set(0, 0.35, 1.05);
      g.add(hole);
      const cart = this.box(0.5, 0.3, 0.4, 0x4a3524);
      cart.position.set(0.9, 0.15, 0.9);
      g.add(cart);
      const ore = new T.Mesh(
        new T.OctahedronGeometry(0.18),
        new T.MeshStandardMaterial({
          color:
            kind === 'goldmine'
              ? 0xf1c454
              : kind === 'mine'
                ? 0xa9b1b8
                : 0xc7cfc9,
          metalness: 0.5,
          roughness: 0.4,
        }),
      );
      ore.position.set(0.9, 0.4, 0.9);
      g.add(ore);
      for (let i = 1; i < level; i++) {
        const lamp = new T.Mesh(
          new T.OctahedronGeometry(0.1),
          new T.MeshBasicMaterial({ color: 0xffc46a }),
        );
        lamp.position.set(-0.7 + i * 0.5, 1.15, 0.9);
        g.add(lamp);
      }
    } else if (kind === 'ballista') {
      const b = this.box(1.5, 1.2, 1.5, 0x9a9c8a);
      b.position.y = 0.6;
      g.add(b);
      const top = this.box(
        1.8,
        0.3,
        1.8,
        branch === 'heavy' ? 0xc8a569 : 0xb8b09a,
      );
      top.position.y = 1.35;
      g.add(top);
      const arm = this.box(2.2, 0.18, 0.18, 0x67452c);
      arm.position.y = 1.85;
      g.add(arm);
      const rail = this.box(0.2, 0.2, 1.9, 0x403b32);
      rail.position.set(0, 1.85, 0.2);
      g.add(rail);
      const bolt = this.box(
        0.1,
        0.1,
        1.2,
        branch === 'rapid' ? 0xe9bf6e : 0xd8d2c0,
      );
      bolt.position.set(0, 2.0, 0.3);
      g.add(bolt);
    } else if (kind === 'shrine') {
      const b = this.box(1.5, 0.4, 1.5, 0xb5b5a4);
      b.position.y = 0.2;
      g.add(b);
      const stone = new T.Mesh(
        new T.OctahedronGeometry(0.7),
        this.mat(0x8cddad),
      );
      stone.position.y = 1.4;
      g.add(stone);
    } else {
      const b = this.box(1.25, 1.8, 1.25, 0xaab39c);
      b.position.y = 0.9;
      g.add(b);
      const top = this.box(
        1.7,
        0.35,
        1.7,
        branch === 'heavy' ? 0xc8a569 : 0xd3c8a5,
      );
      top.position.y = 1.95;
      g.add(top);
      if (kind === 'frost') {
        const crystal = new T.Mesh(
          new T.OctahedronGeometry(0.55),
          this.mat(0x81d6e3),
        );
        crystal.position.y = 2.55;
        g.add(crystal);
      } else {
        const bow = this.box(
          1.6,
          0.2,
          0.2,
          branch === 'rapid' ? 0xe9bf6e : 0x67452c,
        );
        bow.position.y = 2.4;
        g.add(bow);
        const arrow = this.box(0.12, 0.12, 1.5, 0x403b32);
        arrow.position.y = 2.4;
        g.add(arrow);
      }
    }
    return g;
  }
  character(color: number, enemy = false, kind = 'bow') {
    const g = new T.Group();
    const body = this.box(enemy ? 0.7 : 0.52, enemy ? 0.65 : 0.75, 0.42, color);
    body.position.y = 0.75;
    g.add(body);
    const head = new T.Mesh(
      new T.IcosahedronGeometry(enemy ? 0.3 : 0.26, 0),
      this.mat(enemy ? 0x4d2736 : 0xe8c39c),
    );
    head.position.y = 1.4;
    g.add(head);
    for (const x of [-0.18, 0.18]) {
      const leg = this.box(0.18, 0.45, 0.23, enemy ? 0x402b3a : 0x233b39);
      leg.position.set(x, 0.25, 0);
      g.add(leg);
    }
    if (!enemy) {
      const cape = this.box(0.56, 0.75, 0.07, color);
      cape.position.set(0, 0.85, -0.25);
      cape.rotation.x = -0.2;
      g.add(cape);
      const helmet = this.box(0.56, 0.18, 0.48, 0xd2b673);
      helmet.position.y = 1.58;
      g.add(helmet);
      const weapon = this.box(
        kind === 'bow' ? 0.1 : 0.12,
        kind === 'sword' ? 0.85 : 1,
        0.13,
        kind === 'staff' ? 0x89d8d1 : 0xe2d2a7,
      );
      weapon.position.set(0.42, 0.8, 0.2);
      weapon.rotation.z = -0.25;
      g.add(weapon);
    }
    if (kind === 'boss') g.scale.setScalar(2.5);
    else if (kind === 'brute') g.scale.setScalar(1.45);
    else if (kind === 'runner') g.scale.set(0.75, 0.8, 0.75);
    return g;
  }
  health(g: T.Group, hp: number, max: number, y: number) {
    let bar = g.getObjectByName('health') as T.Group;
    if (!bar) {
      bar = new T.Group();
      bar.name = 'health';
      const bg = this.box(1.25, 0.08, 0.09, 0x25312e);
      const fill = this.box(1.21, 0.085, 0.095, 0x9edca2);
      fill.name = 'fill';
      bar.add(bg, fill);
      bar.position.y = y;
      g.add(bar);
    }
    bar.rotation.y = -g.rotation.y;
    bar.visible = hp < max;
    const fill = bar.getObjectByName('fill')!;
    const v = Math.max(0, hp / max);
    fill.scale.x = v;
    fill.position.x = -(1 - v) * 0.605;
  }
  render(
    w: World,
    localId: string,
    placement: { kind: BuildKind; x: number; z: number } | null,
  ) {
    this.localId = localId;
    const now = performance.now(),
      dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const p = w.players.find((p) => p.id === localId) || w.players[0];
    if (p)
      this.follow.lerp(
        new T.Vector3(p.x * 0.75, 0, p.z * 0.75),
        1 - Math.exp(-dt * 5),
      );
    const mobile = this.width / this.height < 0.8;
    this.camera.position.set(
      this.follow.x,
      mobile ? 28 : 31,
      this.follow.z + (mobile ? 23 : 25),
    );
    this.camera.lookAt(this.follow.x, 0, this.follow.z - 2);
    this.syncTerrain(w);
    const live = new Set<string>();
    for (const b of w.buildings) {
      live.add(b.id);
      let g = this.entities.get(b.id);
      const key = b.kind + b.level + b.branch;
      if (g && g.userData.key !== key) {
        this.scene.remove(g);
        this.disposeGeometry(g);
        this.entities.delete(b.id);
        g = undefined;
      }
      if (!g) {
        g = this.building(b.kind, b.branch, b.level);
        g.userData.key = key;
        g.position.set(b.x, 0, b.z);
        this.scene.add(g);
        this.entities.set(b.id, g);
      }
      const fan = g.getObjectByName('fan');
      if (fan) fan.rotation.z += dt;
      if (b.kind === 'keep') g.scale.setScalar(1 + (b.level - 1) * 0.08);
      this.health(g, b.hp, b.maxHp, b.kind === 'keep' ? 5.3 : 3.3);
    }
    for (const u of [...w.players, ...w.enemies]) {
      live.add(u.id);
      let g = this.entities.get(u.id);
      const isPlayer = 'weapon' in u;
      if (!g) {
        g = this.character(
          isPlayer
            ? u.color
            : u.kind === 'boss'
              ? 0xa15275
              : u.kind === 'runner'
                ? 0xd18e71
                : 0x9e6176,
          !isPlayer,
          isPlayer ? u.weapon : u.kind,
        );
        g.position.set(u.x, 0, u.z);
        this.scene.add(g);
        this.entities.set(u.id, g);
        if (u.id === localId) {
          const ring = new T.Mesh(
            new T.RingGeometry(0.6, 0.72, 32),
            new T.MeshBasicMaterial({
              color: 0xf8d887,
              side: T.DoubleSide,
              transparent: true,
              opacity: 0.9,
            }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.04;
          g.add(ring);
        }
      }
      g.position.x += (u.x - g.position.x) * Math.min(1, dt * 18);
      g.position.z += (u.z - g.position.z) * Math.min(1, dt * 18);
      g.rotation.y = u.angle;
      g.visible = !isPlayer || u.dead <= 0;
      this.health(g, u.hp, u.maxHp, isPlayer ? 2.05 : 1.9);
    }
    for (const [id, g] of this.entities)
      if (!live.has(id)) {
        this.scene.remove(g);
        this.disposeGeometry(g);
        this.entities.delete(id);
      }
    this.clearDynamic(this.effects);
    for (const e of w.effects) {
      const color =
        e.kind === 'staff'
          ? 0x9de0ed
          : e.kind === 'hit'
            ? 0xf98977
            : e.kind === 'chop'
              ? 0xc9a36a
              : e.kind === 'bolt'
                ? 0xffffff
                : 0xffdc8c;
      const points = [new T.Vector3(e.x, 1, e.z), new T.Vector3(e.tx, 1, e.tz)];
      const geo = new T.BufferGeometry().setFromPoints(points);
      const line = new T.Line(
        geo,
        new T.LineBasicMaterial({
          color,
          transparent: true,
          opacity: Math.max(0.1, e.life * 4),
        }),
      );
      this.effects.add(line);
      if (e.kind === 'sword' || e.kind === 'staff') {
        const ring = new T.Mesh(
          new T.RingGeometry(
            e.kind === 'sword' ? 1.6 : 1.3,
            e.kind === 'sword' ? 1.8 : 1.5,
            20,
          ),
          new T.MeshBasicMaterial({
            color,
            side: T.DoubleSide,
            transparent: true,
            opacity: e.life * 3,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(
          e.kind === 'sword' ? e.x : e.tx,
          0.15,
          e.kind === 'sword' ? e.z : e.tz,
        );
        this.effects.add(ring);
      }
    }
    const gemIds = new Set(w.gems.map((g) => g.id));
    for (const [gid, mesh] of this.gemMeshes)
      if (!gemIds.has(gid)) {
        this.gemGroup.remove(mesh);
        this.gemMeshes.delete(gid);
      }
    for (const gem of w.gems) {
      let m = this.gemMeshes.get(gem.id);
      if (!m) {
        m = new T.Mesh(this.gemGeometry, this.mat(0x92e5d6));
        this.gemMeshes.set(gem.id, m);
        this.gemGroup.add(m);
      }
      m.position.set(gem.x, 0.3 + Math.sin(now * 0.003 + gem.id) * 0.08, gem.z);
      m.rotation.y = now * 0.001;
    }
    if (placement) {
      if (!this.ghost || this.ghostKind !== placement.kind) {
        if (this.ghost) {
          this.scene.remove(this.ghost);
          this.disposeGeometry(this.ghost);
        }
        this.ghost = this.building(placement.kind);
        this.ghostKind = placement.kind;
        this.ghost.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.material = (o.material as T.Material).clone();
            (o.material as T.Material).transparent = true;
            (o.material as T.Material).opacity = 0.65;
          }
        });
        const r = new T.Mesh(
          new T.RingGeometry(1.2, 1.3, 32),
          new T.MeshBasicMaterial({ color: 0x8ee3b7, side: T.DoubleSide }),
        );
        r.rotation.x = -Math.PI / 2;
        r.position.y = 0.06;
        r.name = 'placement-ring';
        this.ghost.add(r);
        this.scene.add(this.ghost);
      }
      this.ghost.position.set(placement.x, 0, placement.z);
      const valid = canBuild(w, placement.kind, placement.x, placement.z);
      this.ghost.traverse((o) => {
        if (o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial)
          o.material.emissive.setHex(valid ? 0x143320 : 0x661a22);
      });
    } else if (this.ghost) {
      this.scene.remove(this.ghost);
      this.disposeGeometry(this.ghost, true);
      this.ghost = null;
    }
    this.renderer.render(this.scene, this.camera);
  }
  point(clientX: number, clientY: number) {
    const rect = this.container.getBoundingClientRect();
    this.ray.setFromCamera(
      new T.Vector2(
        ((clientX - rect.left) / this.width) * 2 - 1,
        (-(clientY - rect.top) / this.height) * 2 + 1,
      ),
      this.camera,
    );
    const v = new T.Vector3();
    return this.ray.ray.intersectPlane(this.plane, v)
      ? { x: Math.round(v.x * 2) / 2, z: Math.round(v.z * 2) / 2 }
      : null;
  }
  project(x: number, z: number) {
    const v = new T.Vector3(x, 0, z).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.width,
      y: (-0.5 * v.y + 0.5) * this.height,
    };
  }
  disposeGeometry(o: T.Object3D, materials = false) {
    o.traverse((obj) => {
      if (obj instanceof T.Mesh || obj instanceof T.Line) {
        obj.geometry.dispose();
        if (materials) {
          const ms = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          ms.forEach((m) => m.dispose());
        }
      }
    });
  }
  clearDynamic(g: T.Group, materials = true) {
    this.disposeGeometry(g, materials);
    g.clear();
  }
  dispose() {
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.disposeGeometry(this.scene, true);
    this.materials.clear();
    this.gemGeometry.dispose();
    this.gemMeshes.clear();
    this.terrainMeshes.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
