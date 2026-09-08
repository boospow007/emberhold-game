import * as T from 'three';
import { World, MAPS, Obstacle, BuildKind, canBuild, terrain } from './engine';
import {
  HALF,
  SIZE,
  WATER_LEVEL,
  HILL_LEVEL,
  MOUNTAIN_LEVEL,
  type Terrain,
} from './terrain.ts';
export class GameScene {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(42, 1, 0.1, 260);
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
  ground: Terrain | null = null;
  hemi!: T.HemisphereLight;
  water: T.Mesh | null = null;
  waterBase: Float32Array | null = null;
  dying: { g: T.Object3D; at: number; kind: string; base: number }[] = [];
  night = 0;
  shakeAt = -9999;
  lastKeepHp = Infinity;
  skyDay = new T.Color();
  skyNight = new T.Color();
  sun: T.DirectionalLight;
  disposed = false;
  constructor(
    public container: HTMLElement,
    world: World,
  ) {
    const map = world.map;
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
    this.scene.fog = new T.Fog(colors.sky, 60, 150);
    this.hemi = new T.HemisphereLight(0xffeac4, 0x496579, 2.5);
    this.scene.add(this.hemi);
    this.skyDay.setHex(colors.sky);
    this.skyNight
      .setHex(colors.sky)
      .multiplyScalar(0.45)
      .lerp(new T.Color(0x0c1424), 0.4);
    const sun = new T.DirectionalLight(0xffe3ab, 3.5);
    sun.position.set(-16, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -40,
      right: 40,
      top: 40,
      bottom: -40,
      near: 0.5,
      far: 120,
    });
    this.sun = sun;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.root = new T.Group();
    this.scene.add(this.root, this.effects, this.gemGroup);
    this.buildGround(world);
    this.map = map;
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
  buildGround(world: World) {
    const t = terrain(world);
    this.ground = t;
    const colors = MAPS[world.map];
    const geo = new T.PlaneGeometry(SIZE - 1, SIZE - 1, SIZE - 1, SIZE - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as T.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const c = new T.Color();
    const sand = new T.Color(world.map === 'snow' ? 0xc5d3d6 : 0xd6c58f),
      plain = new T.Color(colors.ground),
      hill = new T.Color(
        world.map === 'desert'
          ? 0x8f7a58
          : world.map === 'snow'
            ? 0x8ea3a6
            : 0x6f8a63,
      ),
      rock = new T.Color(world.map === 'desert' ? 0x6e5847 : 0x5f6b6d),
      peak = new T.Color(world.map === 'desert' ? 0x8a705b : 0xe6eef0);
    for (let i = 0; i < pos.count; i++) {
      const x = Math.round(pos.getX(i)),
        z = Math.round(pos.getZ(i));
      const h = t.h(x, z);
      const y = t.y(x, z) - (h < WATER_LEVEL ? (WATER_LEVEL - h) * 6 : 0);
      pos.setY(i, y - 0.02);
      if (h < WATER_LEVEL + 0.03) c.copy(sand);
      else if (h < HILL_LEVEL)
        c.copy(plain).lerp(
          hill,
          ((h - WATER_LEVEL) / (HILL_LEVEL - WATER_LEVEL)) * 0.6,
        );
      else if (h < MOUNTAIN_LEVEL)
        c.copy(hill).lerp(
          rock,
          (h - HILL_LEVEL) / (MOUNTAIN_LEVEL - HILL_LEVEL),
        );
      else c.copy(rock).lerp(peak, Math.min(1, (h - MOUNTAIN_LEVEL) / 0.15));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new T.Mesh(
      geo,
      new T.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        flatShading: true,
      }),
    );
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.root.add(mesh);
    const water = new T.Mesh(
      new T.PlaneGeometry(SIZE + 4, SIZE + 4, 40, 40),
      new T.MeshStandardMaterial({
        color: world.map === 'snow' ? 0x6f9cb8 : 0x3f89a8,
        transparent: true,
        opacity: 0.78,
        roughness: 0.3,
        metalness: 0.1,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.08;
    water.receiveShadow = true;
    this.root.add(water);
    this.water = water;
    this.waterBase = new Float32Array(
      (water.geometry.attributes.position as T.BufferAttribute).array,
    );
    const rim = this.box(SIZE + 6, 3, SIZE + 6, colors.dark);
    rim.position.y = -2.2;
    this.root.add(rim);
  }
  y(x: number, z: number) {
    return this.ground ? this.ground.y(x, z) : 0;
  }
  terrainMesh(o: Obstacle) {
    const g = new T.Group();
    const map = this.map;
    g.position.set(o.x, this.y(o.x, o.z), o.z);
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
  syncTerrain(w: World, now: number) {
    const live = new Set<number>();
    for (const o of w.terrain) {
      live.add(o.id);
      let g = this.terrainMeshes.get(o.id);
      if (!g) {
        g = this.terrainMesh(o);
        g.userData.wood = o.wood;
        this.root.add(g);
        this.terrainMeshes.set(o.id, g);
      }
      if (o.kind === 'tree') {
        if (o.wood < g.userData.wood) g.userData.hitAt = now;
        g.userData.wood = o.wood;
        const k = 0.6 + 0.4 * Math.min(1, o.wood / 30);
        g.scale.set(k, k, k);
        const t = (now - (g.userData.hitAt ?? -9999)) / 320;
        g.rotation.z = t < 1 ? Math.sin(t * Math.PI * 3) * 0.12 * (1 - t) : 0;
      }
    }
    for (const [id, g] of this.terrainMeshes)
      if (!live.has(id)) {
        this.terrainMeshes.delete(id);
        this.dying.push({ g, at: now, kind: 'tree', base: g.scale.x });
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
      flame.name = 'flame';
      g.add(flame);
      const light = new T.PointLight(0xffc46a, 12, 12);
      light.position.y = 4;
      light.name = 'flame-light';
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
    } else if (kind === 'bridge') {
      const deck = this.box(2.4, 0.18, 2.4, 0x8a6a48);
      deck.position.y = 0.32;
      g.add(deck);
      for (const x of [-1, 1]) {
        const rail = this.box(0.12, 0.5, 2.4, 0x5d4733);
        rail.position.set(x, 0.62, 0);
        g.add(rail);
      }
      for (const z of [-0.9, 0.9])
        for (const x of [-0.9, 0.9]) {
          const post = this.box(0.22, 0.9, 0.22, 0x5d4733);
          post.position.set(x, 0.1, z);
          g.add(post);
        }
    } else if (kind === 'fisher') {
      const b = this.box(1.2, 0.9, 1.0, 0x9c8a6a);
      b.position.y = 0.45;
      g.add(b);
      const r = new T.Mesh(new T.ConeGeometry(1.1, 0.7, 4), this.mat(0x6b8e9a));
      r.rotation.y = Math.PI / 4;
      r.position.y = 1.25;
      g.add(r);
      const rod = this.box(0.05, 1.6, 0.05, 0x3f3226);
      rod.position.set(0.8, 0.9, 0.5);
      rod.rotation.z = -0.5;
      g.add(rod);
    } else if (kind === 'barracks' || kind === 'archery' || kind === 'stable') {
      const col =
        kind === 'barracks'
          ? 0x8d6b4f
          : kind === 'archery'
            ? 0x6f8a63
            : 0x9a8a6a;
      const b = this.box(1.9, 0.9, 1.5, col);
      b.position.y = 0.45;
      g.add(b);
      const roof = new T.Mesh(
        new T.ConeGeometry(1.5, 0.9, 4),
        this.mat(kind === 'stable' ? 0x7a4a3a : 0x5a4a3a),
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 1.35;
      g.add(roof);
      const pole = this.box(0.08, 1.8, 0.08, 0x3f3226);
      pole.position.set(0.9, 1.2, -0.6);
      g.add(pole);
      const flag = this.box(
        0.5,
        0.3,
        0.04,
        branch === 'grow' && level > 1 ? 0xf2c36d : 0xa45c3d,
      );
      flag.position.set(1.15, 1.95, -0.6);
      g.add(flag);
      if (kind === 'archery') {
        const targetRing = new T.Mesh(
          new T.RingGeometry(0.2, 0.4, 12),
          new T.MeshBasicMaterial({ color: 0xe8d8b0, side: T.DoubleSide }),
        );
        targetRing.position.set(-0.8, 0.7, 0.78);
        g.add(targetRing);
      }
      if (kind === 'stable') {
        const fence = this.box(1.6, 0.35, 0.08, 0x5d4733);
        fence.position.set(0, 0.35, 1.0);
        g.add(fence);
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
    body.material = this.mat(color).clone();
    body.position.y = 0.75;
    body.name = 'body';
    g.add(body);
    const head = new T.Mesh(
      new T.IcosahedronGeometry(enemy ? 0.3 : 0.26, 0),
      this.mat(enemy ? 0x4d2736 : 0xe8c39c),
    );
    head.position.y = 1.4;
    head.name = 'head';
    g.add(head);
    for (const [i, x] of [-0.18, 0.18].entries()) {
      const leg = this.box(0.18, 0.45, 0.23, enemy ? 0x402b3a : 0x233b39);
      leg.position.set(x, 0.25, 0);
      leg.name = i === 0 ? 'legL' : 'legR';
      g.add(leg);
    }
    if (!enemy) {
      const cape = this.box(0.56, 0.75, 0.07, color);
      cape.position.set(0, 0.85, -0.25);
      cape.rotation.x = -0.2;
      cape.name = 'cape';
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
      weapon.name = 'weapon';
      g.add(weapon);
    } else {
      for (const x of [-0.42, 0.42]) {
        const arm = this.box(0.16, 0.5, 0.16, color);
        arm.position.set(x, 0.85, 0.05);
        arm.name = x < 0 ? 'armL' : 'armR';
        g.add(arm);
      }
    }
    const base =
      kind === 'boss'
        ? 2.5
        : kind === 'brute'
          ? 1.45
          : kind === 'runner'
            ? 0.78
            : 1;
    g.scale.setScalar(base);
    g.userData.baseScale = base;
    return g;
  }
  soldier(kind: string, color: number) {
    const g = new T.Group();
    const body = this.box(
      0.42,
      0.6,
      0.34,
      kind === 'knight' ? 0xb7bcc4 : 0x7d8f7a,
    );
    body.material = (body.material as T.MeshStandardMaterial).clone();
    body.position.y = 0.62;
    body.name = 'body';
    g.add(body);
    const head = new T.Mesh(
      new T.IcosahedronGeometry(0.2, 0),
      this.mat(0xe8c39c),
    );
    head.position.y = 1.12;
    head.name = 'head';
    g.add(head);
    const helm = this.box(
      0.44,
      0.14,
      0.4,
      kind === 'knight' ? 0xd2b673 : 0x5a6b66,
    );
    helm.position.y = 1.26;
    g.add(helm);
    for (const [i, x] of [-0.14, 0.14].entries()) {
      const leg = this.box(0.15, 0.36, 0.2, 0x3b4a45);
      leg.position.set(x, 0.2, 0);
      leg.name = i === 0 ? 'legL' : 'legR';
      g.add(leg);
    }
    const tab = this.box(0.5, 0.08, 0.08, color);
    tab.position.set(0, 0.95, -0.2);
    tab.name = 'tab';
    g.add(tab);
    const weapon = this.box(
      kind === 'archer' ? 0.08 : 0.1,
      kind === 'knight' ? 1.1 : 0.8,
      0.1,
      kind === 'archer' ? 0x8a6a48 : 0xd8d2c0,
    );
    weapon.position.set(0.32, 0.7, 0.15);
    weapon.rotation.z = -0.3;
    weapon.name = 'weapon';
    g.add(weapon);
    if (kind === 'knight') {
      const shield = this.box(0.08, 0.5, 0.4, 0xa45c3d);
      shield.position.set(-0.32, 0.65, 0.05);
      g.add(shield);
    }
    const base = kind === 'knight' ? 1.15 : 1;
    g.scale.setScalar(base);
    g.userData.baseScale = base;
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
  // Per-frame character motion: walk cycle, attack swing, hit flash, spawn pop.
  animateUnit(
    g: T.Group,
    u: { x: number; z: number; hp: number; cool: number; angle: number },
    now: number,
    dt: number,
  ) {
    const d = g.userData;
    if (d.born === undefined) {
      d.born = now;
      d.tx = u.x;
      d.tz = u.z;
      d.lastCool = u.cool;
      d.lastHp = u.hp;
      d.phase = Math.random() * 6;
    }
    const moved = Math.hypot(u.x - d.tx, u.z - d.tz);
    d.tx = u.x;
    d.tz = u.z;
    const speed = dt > 0 ? moved / dt : 0;
    const walk = Math.min(1, speed / 3.5);
    d.walk = (d.walk ?? 0) + (walk - (d.walk ?? 0)) * Math.min(1, dt * 12);
    d.phase += dt * (4 + speed * 2.2);
    if (u.cool > d.lastCool + 0.05) d.attackAt = now;
    d.lastCool = u.cool;
    if (u.hp < d.lastHp - 0.01) d.hitAt = now;
    d.lastHp = u.hp;
    const swing = Math.sin(d.phase) * 0.75 * d.walk;
    const legL = g.getObjectByName('legL'),
      legR = g.getObjectByName('legR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
    const armL = g.getObjectByName('armL'),
      armR = g.getObjectByName('armR');
    if (armL) armL.rotation.x = -swing * 0.8;
    if (armR) armR.rotation.x = swing * 0.8;
    const body = g.getObjectByName('body') as T.Mesh | undefined;
    const head = g.getObjectByName('head');
    const cape = g.getObjectByName('cape');
    const bob = Math.abs(Math.sin(d.phase)) * 0.07 * d.walk;
    const breathe = Math.sin(now * 0.003 + d.phase) * 0.012;
    const at = (now - (d.attackAt ?? -9999)) / 200;
    const lunge = at < 1 ? Math.sin(at * Math.PI) : 0;
    if (body) {
      body.position.y =
        (d.bodyY ?? (d.bodyY = body.position.y)) + bob + breathe;
      body.position.z = lunge * 0.18;
      body.rotation.x = lunge * 0.25 - d.walk * 0.08;
      const hit = (now - (d.hitAt ?? -9999)) / 260;
      const m = body.material as T.MeshStandardMaterial;
      if (hit < 1)
        m.emissive.setRGB(0.9 * (1 - hit), 0.25 * (1 - hit), 0.2 * (1 - hit));
      else if (m.emissive.r > 0) m.emissive.setRGB(0, 0, 0);
    }
    if (head) {
      head.position.y =
        (d.headY ?? (d.headY = head.position.y)) + bob * 1.1 + breathe;
      head.position.z = lunge * 0.22;
    }
    if (cape) cape.rotation.x = -0.2 - d.walk * 0.5 - lunge * 0.3;
    const weapon = g.getObjectByName('weapon');
    if (weapon) {
      const rest = d.weaponZ ?? (d.weaponZ = weapon.rotation.z);
      weapon.rotation.z = rest - lunge * 1.1;
      weapon.rotation.x = -lunge * 0.6;
    }
    const born = Math.min(1, (now - d.born) / 260);
    const pop = born < 1 ? 1 + Math.sin(born * Math.PI) * 0.18 : 1;
    const hitScale = (now - (d.hitAt ?? -9999)) / 200;
    const flinch = hitScale < 1 ? 1 + Math.sin(hitScale * Math.PI) * 0.1 : 1;
    const base = d.baseScale ?? 1;
    g.scale.setScalar(base * (0.2 + 0.8 * born) * pop * flinch);
  }
  animateDying(now: number) {
    for (const item of this.dying.slice()) {
      const dur =
        item.kind === 'building'
          ? 650
          : item.kind === 'tree'
            ? 700
            : item.kind === 'gem'
              ? 320
              : 380;
      const t = Math.min(1, (now - item.at) / dur);
      const g = item.g;
      if (item.kind === 'building') {
        g.scale.setScalar(item.base * (1 - t * 0.85));
        g.position.y -= t * 0.05;
        g.rotation.z = t * 0.35;
        g.rotation.x = t * 0.2;
      } else if (item.kind === 'tree') {
        g.rotation.x = Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5) * 1.45;
        g.scale.setScalar(item.base * (1 - Math.max(0, t - 0.7) / 0.3));
      } else if (item.kind === 'gem') {
        g.scale.setScalar(item.base * (1 + t * 2.2));
        g.position.y += 0.04;
        const m = (g as T.Mesh).material as T.MeshStandardMaterial;
        m.transparent = true;
        m.opacity = 1 - t;
      } else {
        g.scale.setScalar(item.base * (1 - t));
        g.rotation.x = t * 1.2;
        g.position.y -= t * 0.03;
      }
      if (t >= 1) {
        g.parent?.remove(g);
        this.disposeGeometry(g, item.kind === 'gem');
        this.dying.splice(this.dying.indexOf(item), 1);
      }
    }
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
    // Day / night: battles darken the sky and let the keep's flame carry the light.
    const target = w.phase === 'battle' ? 1 : 0;
    this.night += (target - this.night) * Math.min(1, dt * 1.4);
    this.sun.intensity = 3.5 - 2.1 * this.night;
    this.hemi.intensity = 2.5 - 1.2 * this.night;
    const sky = this.skyDay.clone().lerp(this.skyNight, this.night);
    (this.scene.background as T.Color).copy(sky);
    (this.scene.fog as T.Fog).color.copy(sky);
    const p = w.players.find((p) => p.id === localId) || w.players[0];
    if (p)
      this.follow.lerp(
        new T.Vector3(
          Math.max(-HALF + 8, Math.min(HALF - 8, p.x)),
          0,
          Math.max(-HALF + 4, Math.min(HALF - 4, p.z)),
        ),
        1 - Math.exp(-dt * 5),
      );
    this.sun.position.set(this.follow.x - 16, 30, this.follow.z + 12);
    this.sun.target.position.set(this.follow.x, 0, this.follow.z);
    this.sun.target.updateMatrixWorld();
    const keep = w.buildings[0];
    if (keep && keep.hp < this.lastKeepHp - 0.01) this.shakeAt = now;
    this.lastKeepHp = keep ? keep.hp : Infinity;
    const shakeT = (now - this.shakeAt) / 320;
    const shake = shakeT < 1 ? (1 - shakeT) * 0.35 : 0;
    const sx = Math.sin(now * 0.09) * shake,
      sz = Math.cos(now * 0.11) * shake;
    const mobile = this.width / this.height < 0.8;
    const py = p ? this.y(p.x, p.z) : 0;
    this.camera.position.set(
      this.follow.x + sx,
      py + (mobile ? 28 : 31),
      this.follow.z + (mobile ? 23 : 25) + sz,
    );
    this.camera.lookAt(this.follow.x + sx, py, this.follow.z - 2 + sz);
    this.syncTerrain(w, now);
    if (this.water && this.waterBase) {
      const pos = this.water.geometry.attributes.position as T.BufferAttribute;
      const t = now * 0.0012;
      for (let i = 0; i < pos.count; i++) {
        const x = this.waterBase[i * 3],
          yb = this.waterBase[i * 3 + 1];
        pos.setZ(
          i,
          Math.sin(x * 0.35 + t) * 0.05 + Math.cos(yb * 0.28 + t * 0.8) * 0.05,
        );
      }
      pos.needsUpdate = true;
      this.water.geometry.computeVertexNormals();
    }
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
        g.userData.born = now;
        g.userData.lastHp = b.hp;
        g.position.set(b.x, b.kind === 'bridge' ? -0.3 : this.y(b.x, b.z), b.z);
        this.scene.add(g);
        this.entities.set(b.id, g);
      }
      const d = g.userData;
      if (b.hp < d.lastHp - 0.01) d.hitAt = now;
      d.lastHp = b.hp;
      const fan = g.getObjectByName('fan');
      if (fan) fan.rotation.z += dt;
      const flame = g.getObjectByName('flame');
      if (flame) {
        const f =
          1 + Math.sin(now * 0.021) * 0.12 + Math.sin(now * 0.037 + 1) * 0.08;
        flame.scale.set(f, 1.2 + (f - 1) * 1.5, f);
        flame.rotation.y = now * 0.002;
        const light = g.getObjectByName('flame-light') as
          | T.PointLight
          | undefined;
        if (light)
          light.intensity =
            (12 + Math.sin(now * 0.017) * 2.5) * (1 + this.night * 0.9);
      }
      const born = Math.min(1, (now - d.born) / 420);
      const pop =
        born < 1 ? 1 - Math.cos(born * Math.PI * 0.5) * (1 - born) : 1;
      const overshoot = born < 1 ? 1 + Math.sin(born * Math.PI) * 0.12 : 1;
      const hit = (now - (d.hitAt ?? -9999)) / 300;
      const wobble =
        hit < 1 ? Math.sin(hit * Math.PI * 3) * 0.06 * (1 - hit) : 0;
      const base = b.kind === 'keep' ? 1 + (b.level - 1) * 0.08 : 1;
      g.scale.setScalar(base * pop * overshoot);
      g.rotation.z = wobble;
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
        g.position.set(u.x, this.y(u.x, u.z), u.z);
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
          ring.name = 'ring';
          g.add(ring);
        }
      }
      g.position.x += (u.x - g.position.x) * Math.min(1, dt * 18);
      g.position.z += (u.z - g.position.z) * Math.min(1, dt * 18);
      g.position.y = this.y(g.position.x, g.position.z);
      g.rotation.y = u.angle;
      g.visible = !isPlayer || u.dead <= 0;
      this.animateUnit(g, u, now, dt);
      const ring = g.getObjectByName('ring');
      if (ring) {
        const k = 1 + Math.sin(now * 0.005) * 0.07;
        ring.scale.set(k, k, 1);
      }
      this.health(g, u.hp, u.maxHp, isPlayer ? 2.05 : 1.9);
    }
    for (const u of w.units) {
      live.add(u.id);
      let g = this.entities.get(u.id);
      if (!g) {
        const owner = w.players.find((p) => p.id === u.owner);
        g = this.soldier(u.kind, owner ? owner.color : 0x9edca2);
        g.userData.owner = u.owner;
        g.position.set(u.x, this.y(u.x, u.z), u.z);
        this.scene.add(g);
        this.entities.set(u.id, g);
      }
      if (g.userData.owner !== u.owner) {
        const owner = w.players.find((p) => p.id === u.owner);
        const tab = g.getObjectByName('tab') as T.Mesh | undefined;
        if (tab) tab.material = this.mat(owner ? owner.color : 0x9edca2);
        g.userData.owner = u.owner;
      }
      g.position.x += (u.x - g.position.x) * Math.min(1, dt * 18);
      g.position.z += (u.z - g.position.z) * Math.min(1, dt * 18);
      g.position.y = this.y(g.position.x, g.position.z);
      g.rotation.y = u.angle;
      this.animateUnit(g, u, now, dt);
      this.health(g, u.hp, u.maxHp, 1.6);
    }
    for (const [id, g] of this.entities)
      if (!live.has(id)) {
        this.entities.delete(id);
        const isBuilding =
          !!g.getObjectByName('health') && !g.getObjectByName('body');
        const bar = g.getObjectByName('health');
        if (bar) bar.visible = false;
        this.dying.push({
          g,
          at: now,
          kind: isBuilding ? 'building' : 'unit',
          base: g.scale.x,
        });
      }
    this.animateDying(now);
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
      const from = new T.Vector3(e.x, this.y(e.x, e.z) + 1, e.z),
        to = new T.Vector3(e.tx, this.y(e.tx, e.tz) + 1, e.tz);
      const t = 1 - Math.max(0, Math.min(1, e.life / 0.25));
      if (e.kind === 'arrow' || e.kind === 'bolt' || e.kind === 'staff') {
        // Projectile flies from shooter to target over the effect's lifetime.
        const pos = from.clone().lerp(to, Math.min(1, t * 1.3));
        pos.y += Math.sin(Math.min(1, t * 1.3) * Math.PI) * 0.6;
        const bolt = new T.Mesh(
          e.kind === 'staff'
            ? new T.OctahedronGeometry(0.22)
            : new T.BoxGeometry(0.08, 0.08, e.kind === 'bolt' ? 0.9 : 0.6),
          new T.MeshBasicMaterial({ color }),
        );
        bolt.position.copy(pos);
        bolt.lookAt(to);
        if (e.kind === 'staff') bolt.rotation.y = now * 0.01;
        this.effects.add(bolt);
        const trail = new T.Line(
          new T.BufferGeometry().setFromPoints([
            from.clone().lerp(to, Math.max(0, t * 1.3 - 0.35)),
            pos,
          ]),
          new T.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }),
        );
        this.effects.add(trail);
      } else {
        const line = new T.Line(
          new T.BufferGeometry().setFromPoints([from, to]),
          new T.LineBasicMaterial({
            color,
            transparent: true,
            opacity: Math.max(0.1, e.life * 4),
          }),
        );
        this.effects.add(line);
      }
      if (e.kind === 'chop') {
        for (let i = 0; i < 3; i++) {
          const chip = new T.Mesh(
            new T.BoxGeometry(0.1, 0.06, 0.12),
            new T.MeshBasicMaterial({ color: 0xd8b487 }),
          );
          const a = i * 2.1 + e.tx;
          chip.position.set(
            e.tx + Math.cos(a) * t * 0.9,
            this.y(e.tx, e.tz) + 0.9 + Math.sin(t * Math.PI) * 0.7 - t * 0.4,
            e.tz + Math.sin(a) * t * 0.9,
          );
          chip.rotation.set(t * 4, a, t * 3);
          this.effects.add(chip);
        }
      }
      if (e.kind === 'sword' || e.kind === 'staff' || e.kind === 'hit') {
        const big = e.kind === 'sword';
        const ring = new T.Mesh(
          new T.RingGeometry(
            (big ? 1.2 : 0.5) + t * (big ? 0.7 : 0.6),
            (big ? 1.4 : 0.6) + t * (big ? 0.7 : 0.6),
            20,
          ),
          new T.MeshBasicMaterial({
            color,
            side: T.DoubleSide,
            transparent: true,
            opacity: Math.max(0, e.life * 3),
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        const rx = e.kind === 'sword' ? e.x : e.tx,
          rz = e.kind === 'sword' ? e.z : e.tz;
        ring.position.set(rx, this.y(rx, rz) + 0.15, rz);
        this.effects.add(ring);
      }
    }
    const gemIds = new Set(w.gems.map((g) => g.id));
    for (const [gid, mesh] of this.gemMeshes)
      if (!gemIds.has(gid)) {
        this.gemMeshes.delete(gid);
        mesh.material = (mesh.material as T.Material).clone();
        this.dying.push({ g: mesh, at: now, kind: 'gem', base: 1 });
      }
    for (const gem of w.gems) {
      let m = this.gemMeshes.get(gem.id);
      if (!m) {
        m = new T.Mesh(this.gemGeometry, this.mat(0x92e5d6));
        m.userData.born = now;
        this.gemMeshes.set(gem.id, m);
        this.gemGroup.add(m);
      }
      const born = Math.min(1, (now - m.userData.born) / 300);
      m.scale.setScalar(0.3 + 0.7 * born + Math.sin(born * Math.PI) * 0.3);
      m.position.set(
        gem.x,
        this.y(gem.x, gem.z) + 0.3 + Math.sin(now * 0.003 + gem.id) * 0.08,
        gem.z,
      );
      m.rotation.y = now * 0.001 + gem.id;
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
      this.ghost.position.set(
        placement.x,
        this.y(placement.x, placement.z) + Math.sin(now * 0.004) * 0.08 + 0.08,
        placement.z,
      );
      const valid = canBuild(w, placement.kind, placement.x, placement.z);
      const ring = this.ghost.getObjectByName('placement-ring');
      if (ring) {
        const k = 1 + Math.sin(now * 0.006) * 0.08;
        ring.scale.set(k, k, 1);
        ((ring as T.Mesh).material as T.MeshBasicMaterial).color.setHex(
          valid ? 0x8ee3b7 : 0xf26d6d,
        );
      }
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
    if (!this.ray.ray.intersectPlane(this.plane, v)) return null;
    for (let i = 0; i < 3; i++) {
      const plane = new T.Plane(new T.Vector3(0, 1, 0), -this.y(v.x, v.z));
      const hit = new T.Vector3();
      if (!this.ray.ray.intersectPlane(plane, hit)) break;
      v.copy(hit);
    }
    return { x: Math.round(v.x * 2) / 2, z: Math.round(v.z * 2) / 2 };
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
    this.dying = [];
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
