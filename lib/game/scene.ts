import * as T from 'three';
import { ART, ComicArt, softenBox, screenDirection, ISO_ANGLE } from './art';
import {
  World,
  MAPS,
  Obstacle,
  BuildKind,
  canBuild,
  terrain,
  dist,
} from './engine';
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
  camera = new T.OrthographicCamera(-16, 16, 24, -24, 0.1, 260);
  art = new ComicArt();
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer: T.WebGLRenderer;
  root: T.Group;
  entities = new Map<string, T.Group>();
  materials = new Map<number, T.MeshToonMaterial>();
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
  windowMat = new T.MeshStandardMaterial({
    color: 0x3b3a2c,
    emissive: 0xffb454,
    emissiveIntensity: 0,
    roughness: 0.6,
  });
  glowMat = new T.MeshStandardMaterial({
    color: 0xffc46a,
    emissive: 0xff9a2a,
    emissiveIntensity: 1.4,
    roughness: 0.4,
  });
  eyeMat = new T.MeshStandardMaterial({
    color: 0x2a0a10,
    emissive: 0xff3d3d,
    emissiveIntensity: 1.2,
  });
  smokes: { m: T.Mesh; born: number; life: number; vx: number; vz: number }[] =
    [];
  smokeGroup = new T.Group();
  smokeGeo = new T.IcosahedronGeometry(0.22, 0);
  smokeMat = new T.MeshStandardMaterial({
    color: 0xd9dcd6,
    transparent: true,
    opacity: 0.5,
    roughness: 1,
  });
  bursts: { g: T.Group; born: number }[] = [];
  lastLevel = new Map<string, number>();
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
    this.renderer.toneMapping = T.LinearToneMapping;
    this.renderer.toneMappingExposure = 1;
    container.appendChild(this.renderer.domElement);
    const colors = MAPS[map];
    this.scene.background = new T.Color(colors.sky);
    this.scene.fog = new T.Fog(colors.sky, 60, 150);
    this.hemi = new T.HemisphereLight(0xfff0cc, 0x767071, 2.0);
    this.scene.add(this.hemi);
    this.skyDay.setHex(
      world.map === 'forest'
        ? 0xc4c58c
        : world.map === 'desert'
          ? 0xdac495
          : 0xb6c8c4,
    );
    this.skyNight
      .setHex(colors.sky)
      .multiplyScalar(0.45)
      .lerp(new T.Color(0x0c1424), 0.4);
    const sun = new T.DirectionalLight(0xffe3ab, 3.5);
    sun.position.set(-16, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(
      window.innerWidth < 700 ? 1024 : 2048,
      window.innerWidth < 700 ? 1024 : 2048,
    );
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
    this.scene.add(this.root, this.effects, this.gemGroup, this.smokeGroup);
    this.buildGround(world);
    this.buildPlaza();
    this.map = map;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }
  mat(color: number) {
    let m = this.materials.get(color);
    if (!m) {
      m = this.art.material(color);
      this.materials.set(color, m);
    }
    return m;
  }
  box(w: number, h: number, d: number, c: number) {
    const m = new T.Mesh(softenBox(w, h, d), this.mat(c));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  resize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.renderer.setSize(this.width, this.height);
    const aspect = this.width / Math.max(1, this.height);
    const span = aspect < 0.8 ? 36 : 42;
    this.camera.left = (-span * aspect) / 2;
    this.camera.right = (span * aspect) / 2;
    this.camera.top = span / 2;
    this.camera.bottom = -span / 2;
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
      plain = new T.Color(
        world.map === 'forest'
          ? ART.grass
          : world.map === 'desert'
            ? 0xc9aa66
            : 0xb6c8c4,
      ),
      hill = new T.Color(
        world.map === 'desert'
          ? 0x8f7a58
          : world.map === 'snow'
            ? 0x8ea3a6
            : 0x8d9750,
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
      new T.MeshToonMaterial({
        vertexColors: true,
        gradientMap: this.art.gradient,
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
    // Grass tufts and pebbles on plains: one instanced mesh, deterministic per seed.
    const tuft = new T.InstancedMesh(
      new T.ConeGeometry(0.16, 0.5, 4),
      new T.MeshStandardMaterial({
        color:
          world.map === 'snow'
            ? 0xb9cdc9
            : world.map === 'desert'
              ? 0xb9a26a
              : 0xb3bd5d,
        roughness: 1,
        flatShading: true,
      }),
      900,
    );
    const m4 = new T.Matrix4(),
      q = new T.Quaternion(),
      sc = new T.Vector3(),
      pv = new T.Vector3();
    let placed = 0;
    let seed = 0;
    for (const ch of world.seed) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 4000 && placed < 900; i++) {
      const x = (rnd() - 0.5) * (SIZE - 6),
        z = (rnd() - 0.5) * (SIZE - 6);
      if (t.cell(x, z) !== 'plain' || Math.hypot(x, z) < 3) continue;
      const h = 0.6 + rnd() * 0.8;
      pv.set(x, t.y(x, z) + 0.2 * h, z);
      q.setFromEuler(new T.Euler(0, rnd() * 6.28, (rnd() - 0.5) * 0.3));
      sc.set(0.8 + rnd() * 0.6, h, 0.8 + rnd() * 0.6);
      m4.compose(pv, q, sc);
      tuft.setMatrixAt(placed++, m4);
    }
    tuft.count = placed;
    tuft.instanceMatrix.needsUpdate = true;
    tuft.castShadow = false;
    tuft.receiveShadow = true;
    this.root.add(tuft);
    const rim = this.box(SIZE + 6, 3, SIZE + 6, colors.dark);
    rim.position.y = -2.2;
    this.root.add(rim);
  }
  buildPlaza() {
    const patch = (w: number, d: number, x: number, z: number, c: number) => {
      const m = this.box(w, 0.035, d, c);
      m.position.set(x, this.y(x, z) + 0.025, z);
      m.castShadow = false;
      this.root.add(m);
    };
    patch(12, 12, 0, 0, ART.asphalt);
    patch(7.2, 7.2, 0, 0, ART.plaster);
    for (let i = -4; i <= 4; i += 2) {
      patch(0.12, 1, 4.5, i, ART.ochre);
      patch(0.12, 1, -4.5, i, ART.ochre);
      patch(1, 0.12, i, 4.5, ART.ochre);
      patch(1, 0.12, i, -4.5, ART.ochre);
    }
    for (let i = 0; i < 18; i++) {
      const x = Math.sin(i * 7.3) * 5.5,
        z = Math.cos(i * 4.1) * 5.5;
      if (Math.hypot(x, z) < 2.8) continue;
      patch(0.4 + (i % 3) * 0.2, 0.28, x, z, i % 2 ? 0x9a8f7a : 0xb3a38a);
    }
  }
  refuge(level: number) {
    const g = new T.Group();
    const put = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      c: number,
    ) => {
      const m = this.box(w, h, d, c);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    put(3.9, 0.24, 3.7, 0, 0.12, 0, 0xc6b59b);
    put(3.3, 2.3, 2.9, 0, 1.37, 0, 0xe7ba59);
    put(3.7, 0.18, 3.3, 0, 2.59, 0, 0xb7aba1);
    put(3.6, 0.32, 0.13, 0, 2.8, -1.55, 0xc7bfb0);
    put(0.13, 0.32, 3.1, 1.72, 2.8, 0, 0xc7bfb0);
    put(0.13, 0.32, 3.1, -1.72, 2.8, 0, 0xc7bfb0);
    put(3.5, 0.16, 0.65, 0, 2.24, 1.64, ART.ochre).rotation.x = 0.12;
    for (const x of [-1.48, 1.48]) put(0.1, 2.05, 0.1, x, 1.17, 1.92, 0x5d6761);
    for (const x of [-0.95, 0.96]) {
      put(0.92, 1.37, 0.075, x, 1.18, 1.48, 0x344b50);
      put(0.79, 1.22, 0.045, x, 1.19, 1.53, 0x73999a);
      const board = put(1.03, 0.16, 0.06, x, 0.96, 1.58, 0xb28757);
      board.rotation.z = x > 0 ? -0.36 : 0.25;
    }
    put(0.58, 1.72, 0.085, 0, 1.03, 1.5, 0x684d3b);
    put(0.04, 0.04, 0.07, 0.18, 1, 1.57, 0xf3d88c);
    for (let i = 0; i < 5; i++)
      put(0.08, 1.1, 0.035, -0.95 + i * 0.17, 1.17, 1.56, 0x53676a);
    for (const z of [-0.65, 0.65]) {
      put(0.04, 1, 0.7, 1.67, 1.28, z, 0x567d7d);
      put(0.055, 0.09, 0.82, 1.69, 1.27, z, 0x32474a);
    }
    // Roof sign, air-conditioning box, antenna and a flame beacon.
    put(2.7, 1.45, 0.22, -0.12, 3.56, 0.05, 0xc78038);
    const sign = this.art.sign('EMBER', 2.6, 1.1);
    sign.position.set(-0.12, 3.63, 0.173);
    g.add(sign);
    put(2.76, 0.1, 0.29, -0.12, 4.32, 0.05, ART.rust);
    put(0.65, 0.4, 0.62, 0.9, 2.92, -0.72, 0x8c9c9a);
    const fan = new T.Mesh(
      new T.CylinderGeometry(0.24, 0.24, 0.05, 12),
      this.mat(0x405552),
    );
    fan.position.set(0.9, 3.15, -0.72);
    g.add(fan);
    for (let i = 0; i < 4; i++) {
      const fin = put(0.7, 0.04, 0.03, 0.9, 3.18, -0.72, 0x272f2b);
      fin.rotation.y = (i * Math.PI) / 4;
    }
    put(0.06, 1.3, 0.06, -1.2, 3.3, -1, 0x545a50);
    put(0.7, 0.035, 0.035, -1.2, 3.8, -1, 0x545a50);
    const chimney = put(0.32, 0.62, 0.32, 1.12, 2.99, 0.79, 0x796b57);
    chimney.name = 'chimney';
    const flame = new T.Mesh(new T.IcosahedronGeometry(0.32, 1), this.glowMat);
    flame.position.set(1.12, 3.54, 0.79);
    flame.name = 'flame';
    g.add(flame);
    const light = new T.PointLight(0xffbf53, 12, 12);
    light.position.copy(flame.position);
    light.name = 'flame-light';
    g.add(light);
    for (let i = 0; i < 2 + level; i++) {
      const box = put(0.38, 0.37, 0.4, -1.6 + i * 0.42, 0.43, -1.4, 0x997a50);
      box.rotation.y = i * 0.13;
    }
    g.add(this.flag(-1.55, 2.8, -1.3, ART.ochre, 0.8));
    return g;
  }
  shelter(level: number) {
    const g = new T.Group();
    const width = 1.6 + level * 0.15,
      height = 1.15 + level * 0.15;
    const body = this.box(width, height, 1.6, level > 1 ? 0x799c9b : 0xb46e43);
    body.position.y = height / 2;
    g.add(body);
    const roof = this.box(width + 0.25, 0.15, 1.9, 0x65949c);
    roof.position.y = height + 0.08;
    roof.rotation.z = 0.035;
    g.add(roof);
    for (let i = 0; i < 6; i++) {
      const seam = this.box(0.045, 0.035, 1.88, 0x426775);
      seam.position.set(-width / 2 + (i * width) / 5, height + 0.19, 0);
      g.add(seam);
    }
    for (const x of [-width / 2 + 0.09, width / 2 - 0.09]) {
      const post = this.box(0.085, height, 0.06, 0x5a5147);
      post.position.set(x, height / 2, 0.83);
      g.add(post);
    }
    const door = this.box(0.47, 0.95, 0.06, 0x3c5153);
    door.position.set(-0.25, 0.48, 0.84);
    g.add(door);
    const pane = this.window(0.4, 0.4);
    pane.position.set(0.46, 0.78, 0.85);
    g.add(pane);
    const plank = this.box(0.55, 0.1, 0.06, 0xbca47d);
    plank.position.set(0.46, 0.77, 0.91);
    plank.rotation.z = -0.3;
    g.add(plank);
    const hood = this.box(width + 0.12, 0.1, 0.55, 0xd2ad5d);
    hood.position.set(0, height - 0.25, 1);
    hood.rotation.x = 0.12;
    g.add(hood);
    const chimney = this.box(0.15, 0.5, 0.15, 0x595c51);
    chimney.position.set(0.6, height + 0.2, -0.45);
    chimney.name = 'chimney';
    g.add(chimney);
    const step = this.box(0.8, 0.12, 0.4, 0xbdb09c);
    step.position.set(-0.2, 0.06, 1);
    g.add(step);
    return g;
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
          new T.IcosahedronGeometry(o.r * (1.08 - j * 0.09), 1),
          this.mat(
            map === 'snow'
              ? j === 2
                ? 0xdbe5dd
                : 0x72998e
              : j === 2
                ? 0xb6c87a
                : 0x8da85d,
          ),
        );
        m.position.set(
          Math.sin(j * 3.7) * 0.25,
          1.6 + j * 0.6,
          Math.cos(j * 3.7) * 0.18,
        );
        m.scale.y = 1.08;
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
        this.art.outline(g);
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
  window(w: number, h: number) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, 0.06), this.windowMat);
    return m;
  }
  torch(x: number, y: number, z: number) {
    const g = new T.Group();
    const pole = this.box(0.08, 0.5, 0.08, 0x3f3226);
    pole.position.y = -0.2;
    g.add(pole);
    const fire = new T.Mesh(new T.OctahedronGeometry(0.14), this.glowMat);
    fire.name = 'torch';
    g.add(fire);
    g.position.set(x, y, z);
    return g;
  }
  flag(x: number, y: number, z: number, color: number, tall = 1.6) {
    const g = new T.Group();
    const pole = this.box(0.07, tall, 0.07, 0x3f3226);
    pole.position.y = tall / 2;
    g.add(pole);
    const cloth = this.box(0.55, 0.32, 0.03, color);
    cloth.position.set(0.3, tall - 0.2, 0);
    cloth.name = 'flag';
    g.add(cloth);
    g.position.set(x, y, z);
    return g;
  }
  building(kind: string, branch = '', level = 1) {
    const g = new T.Group();
    if (kind === 'keep') {
      return this.refuge(level);
    } else if (kind === 'wall') {
      const h = 1.5 + (level - 1) * 0.3;
      const b = this.box(1.25, h, 1.25, level >= 2 ? 0x8d9294 : 0xa2aa98);
      b.position.y = h / 2;
      g.add(b);
      if (level >= 2)
        for (const x of [-0.42, 0, 0.42]) {
          const c = this.box(0.32, 0.3, 1.25, 0xb3b7b5);
          c.position.set(x, h + 0.15, 0);
          g.add(c);
        }
      else
        for (const x of [-0.43, 0.43]) {
          const c = this.box(0.35, 0.35, 1.25, 0xc0c3ac);
          c.position.set(x, h + 0.15, 0);
          g.add(c);
        }
      if (level >= 3)
        for (const x of [-0.4, 0, 0.4]) {
          const spike = new T.Mesh(
            new T.ConeGeometry(0.08, 0.35, 4),
            this.mat(0x4a4a48),
          );
          spike.position.set(x, h + 0.45, 0.5);
          g.add(spike);
        }
      for (const x of [-0.3, 0.25]) {
        const stone = this.box(
          0.35,
          0.2,
          0.05,
          level >= 2 ? 0x7c8283 : 0x939b8c,
        );
        stone.position.set(x, h * 0.4 + (x > 0 ? 0.3 : 0), 0.64);
        g.add(stone);
      }
    } else if (kind === 'farm') {
      const soil = this.box(2.2, 0.12, 1.9, 0x5c4432);
      soil.position.y = 0.06;
      g.add(soil);
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 5; c++) {
          const crop = new T.Mesh(
            new T.ConeGeometry(0.08, 0.28 + level * 0.06, 4),
            this.mat(level >= 2 ? 0xd9c46a : 0x8fb05a),
          );
          crop.position.set(-0.8 + c * 0.4, 0.26, -0.6 + r * 0.6);
          crop.name = 'crop';
          g.add(crop);
        }
      const b = this.box(1.0, 1.0, 0.9, 0xd3b77f);
      b.position.set(-0.9, 0.5, 1.2);
      g.add(b);
      const r = new T.Mesh(new T.ConeGeometry(0.9, 0.8, 4), this.mat(0xa45c3d));
      r.rotation.y = Math.PI / 4;
      r.position.set(-0.9, 1.35, 1.2);
      g.add(r);
      const fan = new T.Group();
      fan.name = 'fan';
      for (let j = 0; j < 4; j++) {
        const blade = this.box(0.16, 1.1, 0.06, 0xf3dfaf);
        blade.position.y = 0.5;
        const pivot = new T.Group();
        pivot.rotation.z = (j * Math.PI) / 2;
        pivot.add(blade);
        fan.add(pivot);
      }
      fan.position.set(-0.9, 1.5, 1.7);
      g.add(fan);
    } else if (kind === 'house') {
      return this.shelter(level);
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
      for (let i = 0; i < 3; i++) {
        const log = new T.Mesh(
          new T.CylinderGeometry(0.15, 0.15, 1.3, 6),
          this.mat(0x7a5a3c),
        );
        log.rotation.x = Math.PI / 2;
        log.position.set(
          -0.55 + (i % 2) * 0.32,
          0.15 + Math.floor(i / 2) * 0.28,
          1.0,
        );
        g.add(log);
      }
      const chimney = this.box(0.2, 0.5, 0.2, 0x5a4a3a);
      chimney.position.set(-0.6, 1.2, -0.4);
      chimney.name = 'chimney';
      g.add(chimney);
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
      const rail1 = this.box(0.04, 0.04, 1.6, 0x4a4a48),
        rail2 = this.box(0.04, 0.04, 1.6, 0x4a4a48);
      rail1.position.set(0.72, 0.02, 1.4);
      rail2.position.set(1.08, 0.02, 1.4);
      g.add(rail1, rail2);
      const cart = new T.Group();
      const body = this.box(0.5, 0.3, 0.4, 0x4a3524);
      body.position.y = 0.2;
      cart.add(body);
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
      ore.position.y = 0.42;
      cart.add(ore);
      cart.position.set(0.9, 0, 0.9);
      cart.name = 'cart';
      g.add(cart);
      const lamp = new T.Mesh(new T.OctahedronGeometry(0.1), this.glowMat);
      lamp.position.set(0.5, 1.1, 1.0);
      g.add(lamp);
      for (let i = 1; i < level; i++) {
        const extra = new T.Mesh(new T.OctahedronGeometry(0.1), this.glowMat);
        extra.position.set(-0.7 + i * 0.5, 1.15, 0.9);
        g.add(extra);
      }
    } else if (kind === 'bridge') {
      for (let i = 0; i < 6; i++) {
        const plank = this.box(2.4, 0.12, 0.34, i % 2 ? 0x8a6a48 : 0x7d5f40);
        plank.position.set(0, 0.32, -1.05 + i * 0.42);
        g.add(plank);
      }
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
      const win = this.window(0.22, 0.22);
      win.position.set(0.25, 0.6, 0.51);
      g.add(win);
      const dock = this.box(0.6, 0.08, 1.6, 0x7d5f40);
      dock.position.set(0.9, 0.12, 0.6);
      g.add(dock);
      const rod = this.box(0.05, 1.6, 0.05, 0x3f3226);
      rod.position.set(1.1, 0.8, 1.2);
      rod.rotation.z = -0.5;
      g.add(rod);
      const net = this.box(0.7, 0.4, 0.03, 0x6b6b5a);
      net.position.set(-0.4, 0.4, 0.52);
      g.add(net);
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
      const door = this.box(0.5, 0.6, 0.06, 0x3f3226);
      door.position.set(0, 0.3, 0.76);
      g.add(door);
      g.add(
        this.flag(
          0.9,
          0.9,
          -0.6,
          branch === 'grow' && level > 1 ? 0xf2c36d : 0xa45c3d,
          1.8,
        ),
      );
      if (kind === 'barracks') {
        const dummy = this.box(0.18, 0.7, 0.18, 0x7a5a3c);
        dummy.position.set(-1.3, 0.35, 0.6);
        g.add(dummy);
        const head = new T.Mesh(
          new T.IcosahedronGeometry(0.15, 0),
          this.mat(0xc9b28a),
        );
        head.position.set(-1.3, 0.85, 0.6);
        g.add(head);
        const arms = this.box(0.6, 0.08, 0.08, 0x7a5a3c);
        arms.position.set(-1.3, 0.6, 0.6);
        g.add(arms);
      }
      if (kind === 'archery') {
        const stand = this.box(0.08, 0.7, 0.08, 0x5d4733);
        stand.position.set(-1.3, 0.35, 0.6);
        g.add(stand);
        const targetRing = new T.Mesh(
          new T.RingGeometry(0.06, 0.34, 12),
          new T.MeshBasicMaterial({ color: 0xe8d8b0, side: T.DoubleSide }),
        );
        targetRing.position.set(-1.3, 0.75, 0.66);
        g.add(targetRing);
        const bull = new T.Mesh(
          new T.CircleGeometry(0.1, 10),
          new T.MeshBasicMaterial({ color: 0xc44b3d }),
        );
        bull.position.set(-1.3, 0.75, 0.67);
        g.add(bull);
      }
      if (kind === 'stable') {
        for (const z of [0.95, 1.35]) {
          const fence = this.box(1.8, 0.06, 0.06, 0x5d4733);
          fence.position.set(0, 0.25 + (z - 0.95), z);
          g.add(fence);
        }
        for (const x of [-0.85, 0, 0.85]) {
          const post = this.box(0.08, 0.5, 0.08, 0x5d4733);
          post.position.set(x, 0.25, 1.15);
          g.add(post);
        }
        const hay = this.box(0.5, 0.35, 0.5, 0xd9c46a);
        hay.position.set(1.25, 0.18, 0.4);
        g.add(hay);
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
      const turret = new T.Group();
      turret.name = 'turret';
      const arm = this.box(2.2, 0.18, 0.18, 0x67452c);
      arm.position.y = 0.5;
      turret.add(arm);
      const rail = this.box(0.2, 0.2, 1.9, 0x403b32);
      rail.position.set(0, 0.5, 0.2);
      turret.add(rail);
      const bolt = this.box(
        0.1,
        0.1,
        1.2,
        branch === 'rapid' ? 0xe9bf6e : 0xd8d2c0,
      );
      bolt.position.set(0, 0.65, 0.3);
      bolt.name = 'bolt';
      turret.add(bolt);
      const string = new T.Line(
        new T.BufferGeometry().setFromPoints([
          new T.Vector3(-1.1, 0.5, 0),
          new T.Vector3(0, 0.5, -0.6),
          new T.Vector3(1.1, 0.5, 0),
        ]),
        new T.LineBasicMaterial({ color: 0xe8e2d0 }),
      );
      turret.add(string);
      turret.position.y = 1.35;
      g.add(turret);
    } else if (kind === 'shrine') {
      const b = this.box(1.6, 0.4, 1.6, 0xb5b5a4);
      b.position.y = 0.2;
      g.add(b);
      for (const [x, z] of [
        [-0.6, -0.6],
        [0.6, -0.6],
        [-0.6, 0.6],
        [0.6, 0.6],
      ]) {
        const pillar = this.box(0.16, 1.1, 0.16, 0xc9c9b6);
        pillar.position.set(x, 0.95, z);
        g.add(pillar);
      }
      const stone = new T.Mesh(
        new T.OctahedronGeometry(0.55),
        new T.MeshStandardMaterial({
          color: 0x8cddad,
          emissive: 0x2f8a5a,
          emissiveIntensity: 0.8,
          roughness: 0.3,
        }),
      );
      stone.position.y = 1.4;
      stone.name = 'crystal';
      g.add(stone);
      const runes = new T.Mesh(
        new T.RingGeometry(0.9, 1.05, 24),
        new T.MeshBasicMaterial({
          color: 0x8ee3b7,
          side: T.DoubleSide,
          transparent: true,
          opacity: 0.6,
        }),
      );
      runes.rotation.x = -Math.PI / 2;
      runes.position.y = 0.42;
      runes.name = 'runes';
      g.add(runes);
      const light = new T.PointLight(0x8ee3b7, 4, 6);
      light.position.y = 1.5;
      g.add(light);
    } else {
      const b = this.box(1.25, 1.8, 1.25, 0xaab39c);
      b.position.y = 0.9;
      g.add(b);
      const win = this.window(0.16, 0.38);
      win.position.set(0, 1.0, 0.64);
      g.add(win);
      const top = this.box(
        1.7,
        0.35,
        1.7,
        branch === 'heavy' ? 0xc8a569 : 0xd3c8a5,
      );
      top.position.y = 1.95;
      g.add(top);
      for (const [x, z] of [
        [-0.7, -0.7],
        [0.7, -0.7],
        [-0.7, 0.7],
        [0.7, 0.7],
      ]) {
        const merlon = this.box(0.3, 0.3, 0.3, 0xb8b09a);
        merlon.position.set(x, 2.25, z);
        g.add(merlon);
      }
      if (level >= 2)
        g.add(
          this.flag(
            -0.6,
            2.1,
            -0.6,
            branch === 'rapid' ? 0xe9bf6e : 0xa45c3d,
            1.1,
          ),
        );
      if (kind === 'frost') {
        const crystal = new T.Mesh(
          new T.OctahedronGeometry(0.55),
          new T.MeshStandardMaterial({
            color: 0x81d6e3,
            emissive: 0x2a7f9a,
            emissiveIntensity: 0.9,
            roughness: 0.2,
          }),
        );
        crystal.position.y = 2.7;
        crystal.name = 'crystal';
        g.add(crystal);
        const light = new T.PointLight(0x81d6e3, 4, 7);
        light.position.y = 2.7;
        g.add(light);
      } else {
        const turret = new T.Group();
        turret.name = 'turret';
        const bow = this.box(
          1.6,
          0.16,
          0.16,
          branch === 'rapid' ? 0xe9bf6e : 0x67452c,
        );
        bow.position.y = 0.45;
        turret.add(bow);
        const arrow = this.box(0.1, 0.1, 1.4, 0x403b32);
        arrow.position.set(0, 0.5, 0.2);
        arrow.name = 'bolt';
        turret.add(arrow);
        const guard = this.box(0.5, 0.5, 0.5, 0x8a6a48);
        guard.position.set(0, 0.2, -0.3);
        turret.add(guard);
        turret.position.y = 2.0;
        g.add(turret);
      }
    }
    return g;
  }
  character(color: number, enemy = false, kind = 'bow') {
    const g = new T.Group();
    const bodyW = enemy ? (kind === 'runner' ? 0.5 : 0.72) : 0.52;
    const body = this.box(bodyW, enemy ? 0.65 : 0.75, 0.42, color);
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
    for (const x of [-0.09, 0.09]) {
      const eye = new T.Mesh(
        new T.BoxGeometry(0.06, 0.06, 0.04),
        enemy ? this.eyeMat : this.mat(0x1f1a16),
      );
      eye.position.set(x, 0.02, enemy ? 0.28 : 0.24);
      head.add(eye);
    }
    for (const [i, x] of [-0.18, 0.18].entries()) {
      const leg = this.box(
        0.18,
        enemy && kind === 'runner' ? 0.55 : 0.45,
        0.23,
        enemy ? 0x402b3a : 0x233b39,
      );
      leg.position.set(x, 0.25, 0);
      leg.name = i === 0 ? 'legL' : 'legR';
      g.add(leg);
    }
    if (!enemy) {
      const belt = this.box(0.56, 0.1, 0.46, 0x5a3f2a);
      belt.position.y = 0.45;
      g.add(belt);
      for (const x of [-0.34, 0.34]) {
        const pad = this.box(0.2, 0.14, 0.34, 0xd2b673);
        pad.position.set(x, 1.12, 0);
        g.add(pad);
      }
      const cape = this.box(0.56, 0.75, 0.07, color);
      cape.position.set(0, 0.85, -0.25);
      cape.rotation.x = -0.2;
      cape.name = 'cape';
      g.add(cape);
      const helmet = this.box(0.56, 0.18, 0.48, 0xd2b673);
      helmet.position.y = 1.58;
      g.add(helmet);
      const plume = this.box(0.08, 0.3, 0.3, color);
      plume.position.set(0, 1.78, -0.05);
      plume.rotation.x = 0.3;
      g.add(plume);
      const armL = this.box(0.16, 0.5, 0.16, 0xe8c39c);
      armL.position.set(-0.36, 0.85, 0.05);
      armL.name = 'armL';
      g.add(armL);
      const armR = new T.Group();
      armR.position.set(0.36, 1.05, 0.05);
      armR.name = 'armR';
      const upper = this.box(0.16, 0.5, 0.16, 0xe8c39c);
      upper.position.y = -0.2;
      armR.add(upper);
      const weapon = new T.Group();
      weapon.name = 'weapon';
      weapon.position.set(0.05, -0.35, 0.15);
      if (kind === 'sword') {
        const blade = this.box(0.08, 0.9, 0.03, 0xe6e2d8);
        blade.position.y = 0.5;
        weapon.add(blade);
        const guard = this.box(0.32, 0.06, 0.08, 0xd2b673);
        weapon.add(guard);
        const hilt = this.box(0.07, 0.28, 0.07, 0x4a3524);
        hilt.position.y = -0.16;
        weapon.add(hilt);
      } else if (kind === 'bow') {
        for (const sgn of [-1, 1]) {
          const limb = this.box(0.06, 0.55, 0.06, 0x8a6a48);
          limb.position.set(0, sgn * 0.26, sgn * 0.12);
          limb.rotation.x = -sgn * 0.45;
          weapon.add(limb);
        }
        const string = new T.Line(
          new T.BufferGeometry().setFromPoints([
            new T.Vector3(0, 0.5, -0.1),
            new T.Vector3(0, 0, -0.22),
            new T.Vector3(0, -0.5, -0.1),
          ]),
          new T.LineBasicMaterial({ color: 0xe8e2d0 }),
        );
        weapon.add(string);
      } else {
        const pole = this.box(0.07, 1.2, 0.07, 0x5a3f2a);
        pole.position.y = 0.2;
        weapon.add(pole);
        const crystal = new T.Mesh(
          new T.OctahedronGeometry(0.16),
          new T.MeshStandardMaterial({
            color: 0x89d8d1,
            emissive: 0x2a9a8f,
            emissiveIntensity: 1.2,
          }),
        );
        crystal.position.y = 0.9;
        crystal.name = 'crystal';
        weapon.add(crystal);
      }
      weapon.rotation.z = -0.25;
      armR.add(weapon);
      g.add(armR);
    } else {
      for (const x of [-0.45, 0.45]) {
        const arm = this.box(0.16, 0.55, 0.16, color);
        arm.position.set(x, 0.8, 0.05);
        arm.name = x < 0 ? 'armL' : 'armR';
        g.add(arm);
        for (let i = 0; i < 2; i++) {
          const claw = new T.Mesh(
            new T.ConeGeometry(0.04, 0.16, 4),
            this.mat(0xe8e2d0),
          );
          claw.position.set(x + (i ? 0.05 : -0.05), 0.5, 0.12);
          claw.rotation.x = Math.PI / 2;
          g.add(claw);
        }
      }
      if (kind === 'brute' || kind === 'boss') {
        for (const x of [-0.3, 0, 0.3]) {
          const spike = new T.Mesh(
            new T.ConeGeometry(0.08, 0.3, 4),
            this.mat(0xe0d8c8),
          );
          spike.position.set(x, 1.15, -0.15);
          spike.rotation.x = -0.5;
          g.add(spike);
        }
        const club = this.box(0.16, 0.9, 0.16, 0x4a3524);
        club.position.set(0.55, 0.9, 0.25);
        club.rotation.z = -0.4;
        club.name = 'weapon';
        g.add(club);
        const clubHead = this.box(0.32, 0.3, 0.32, 0x6b6b6b);
        clubHead.position.set(0, 0.5, 0);
        club.add(clubHead);
      }
      if (kind === 'boss') {
        for (const x of [-0.16, 0.16]) {
          const horn = new T.Mesh(
            new T.ConeGeometry(0.08, 0.45, 5),
            this.mat(0xe0d8c8),
          );
          horn.position.set(x, 0.25, 0);
          horn.rotation.z = x < 0 ? 0.5 : -0.5;
          head.add(horn);
        }
        const core = new T.Mesh(new T.OctahedronGeometry(0.16), this.eyeMat);
        core.position.set(0, 0, 0.23);
        core.name = 'core';
        body.add(core);
        const light = new T.PointLight(0xff5a5a, 3, 6);
        light.position.y = 1;
        g.add(light);
      }
      if (kind === 'runner') {
        const tail = this.box(0.1, 0.1, 0.6, color);
        tail.position.set(0, 0.55, -0.45);
        tail.rotation.x = 0.4;
        tail.name = 'tail';
        g.add(tail);
        body.rotation.x = 0.35;
      }
      if (kind === 'crawler') body.rotation.x = 0.2;
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
    const rider = new T.Group();
    rider.name = 'rider';
    const body = this.box(
      0.42,
      0.6,
      0.34,
      kind === 'knight' ? 0xb7bcc4 : kind === 'archer' ? 0x6f8a63 : 0x7d8f7a,
    );
    body.material = body.material.clone();
    body.position.y = 0.62;
    body.name = 'body';
    rider.add(body);
    const head = new T.Mesh(
      new T.IcosahedronGeometry(0.2, 0),
      this.mat(0xe8c39c),
    );
    head.position.y = 1.12;
    head.name = 'head';
    rider.add(head);
    const helm = this.box(
      0.44,
      0.14,
      0.4,
      kind === 'knight' ? 0xd2b673 : 0x5a6b66,
    );
    helm.position.y = 1.26;
    rider.add(helm);
    if (kind === 'knight') {
      const visor = this.box(0.44, 0.14, 0.1, 0x8d9294);
      visor.position.set(0, 1.1, 0.18);
      rider.add(visor);
    }
    if (kind !== 'knight')
      for (const [i, x] of [-0.14, 0.14].entries()) {
        const leg = this.box(0.15, 0.36, 0.2, 0x3b4a45);
        leg.position.set(x, 0.2, 0);
        leg.name = i === 0 ? 'legL' : 'legR';
        rider.add(leg);
      }
    const tab = this.box(0.5, 0.08, 0.08, color);
    tab.position.set(0, 0.95, -0.2);
    tab.name = 'tab';
    rider.add(tab);
    const armL = this.box(0.13, 0.42, 0.13, 0xe8c39c);
    armL.position.set(-0.3, 0.72, 0.05);
    armL.name = 'armL';
    rider.add(armL);
    if (kind === 'archer') {
      const quiver = this.box(0.12, 0.45, 0.12, 0x5a3f2a);
      quiver.position.set(-0.15, 0.85, -0.25);
      quiver.rotation.z = 0.3;
      rider.add(quiver);
    }
    const armR = new T.Group();
    armR.position.set(0.3, 0.9, 0.05);
    armR.name = 'armR';
    const upper = this.box(0.13, 0.42, 0.13, 0xe8c39c);
    upper.position.y = -0.18;
    armR.add(upper);
    const weapon = new T.Group();
    weapon.name = 'weapon';
    weapon.position.set(0.04, -0.3, 0.12);
    if (kind === 'archer') {
      for (const sgn of [-1, 1]) {
        const limb = this.box(0.05, 0.45, 0.05, 0x8a6a48);
        limb.position.set(0, sgn * 0.22, sgn * 0.1);
        limb.rotation.x = -sgn * 0.45;
        weapon.add(limb);
      }
    } else if (kind === 'knight') {
      const lance = this.box(0.06, 1.5, 0.06, 0xd8d2c0);
      lance.position.y = 0.4;
      weapon.add(lance);
      const tip = new T.Mesh(
        new T.ConeGeometry(0.06, 0.2, 4),
        this.mat(0xe6e2d8),
      );
      tip.position.y = 1.2;
      weapon.add(tip);
    } else {
      const spear = this.box(0.06, 1.1, 0.06, 0x8a6a48);
      spear.position.y = 0.3;
      weapon.add(spear);
      const tip = new T.Mesh(
        new T.ConeGeometry(0.06, 0.2, 4),
        this.mat(0xe6e2d8),
      );
      tip.position.y = 0.95;
      weapon.add(tip);
      const shield = this.box(0.06, 0.45, 0.36, 0xa45c3d);
      shield.position.set(-0.38, 0.7, 0.05);
      rider.add(shield);
    }
    weapon.rotation.z = -0.3;
    armR.add(weapon);
    rider.add(armR);
    if (kind === 'knight') {
      const horse = new T.Group();
      horse.name = 'horse';
      const hb = this.box(0.5, 0.5, 1.2, 0x6b4a33);
      hb.position.y = 0.7;
      horse.add(hb);
      const neck = this.box(0.26, 0.55, 0.3, 0x6b4a33);
      neck.position.set(0, 1.05, 0.55);
      neck.rotation.x = -0.6;
      horse.add(neck);
      const hh = this.box(0.24, 0.26, 0.45, 0x5a3d2a);
      hh.position.set(0, 1.28, 0.85);
      horse.add(hh);
      const mane = this.box(0.08, 0.3, 0.5, 0x2f2118);
      mane.position.set(0, 1.25, 0.45);
      horse.add(mane);
      const htail = this.box(0.08, 0.5, 0.08, 0x2f2118);
      htail.position.set(0, 0.6, -0.65);
      htail.rotation.x = 0.4;
      htail.name = 'tail';
      horse.add(htail);
      const saddle = this.box(0.56, 0.1, 0.5, 0xa45c3d);
      saddle.position.y = 0.97;
      horse.add(saddle);
      const names = ['hlegFL', 'hlegFR', 'hlegBL', 'hlegBR'];
      let i = 0;
      for (const z of [0.4, -0.4])
        for (const x of [-0.18, 0.18]) {
          const leg = this.box(0.14, 0.5, 0.14, 0x5a3d2a);
          leg.position.set(x, 0.25, z);
          leg.name = names[i++];
          horse.add(leg);
        }
      g.add(horse);
      rider.position.y = 0.9;
      rider.scale.setScalar(0.85);
      const shield = this.box(0.06, 0.45, 0.36, 0xa45c3d);
      shield.position.set(-0.36, 0.7, 0.05);
      rider.add(shield);
    }
    g.add(rider);
    const base = kind === 'knight' ? 1.1 : 1;
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
    bar.rotation.y = ISO_ANGLE - g.rotation.y;
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
    const at0 = (now - (d.attackAt ?? -9999)) / 200;
    const swingHit = at0 < 1 ? Math.sin(at0 * Math.PI) : 0;
    if (armL) armL.rotation.x = -swing * 0.8 + swingHit * 0.4;
    if (armR) armR.rotation.x = swing * 0.8 - swingHit * 1.6;
    const horse = g.getObjectByName('horse');
    if (horse) {
      const gallop = Math.sin(d.phase * 1.6) * 0.8 * d.walk;
      for (const [i, n] of ['hlegFL', 'hlegFR', 'hlegBL', 'hlegBR'].entries()) {
        const leg = horse.getObjectByName(n);
        if (leg)
          leg.rotation.x = (i < 2 ? gallop : -gallop) * (i % 2 ? 1 : 0.85);
      }
      horse.position.y = Math.abs(Math.sin(d.phase * 1.6)) * 0.12 * d.walk;
      const rider = g.getObjectByName('rider');
      if (rider) rider.position.y = 0.9 + horse.position.y;
      const tail = horse.getObjectByName('tail');
      if (tail) tail.rotation.x = 0.4 + Math.sin(now * 0.006) * 0.25;
    }
    const tail = g.getObjectByName('tail');
    if (tail && !horse)
      tail.rotation.y = Math.sin(d.phase * 2) * 0.5 * (0.3 + d.walk);
    const core = g.getObjectByName('core');
    if (core) core.scale.setScalar(1 + Math.sin(now * 0.008) * 0.25);
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
      weapon.rotation.z = rest - lunge * (armR ? 0.5 : 1.1);
      weapon.rotation.x = -lunge * 0.6;
      const crystal = weapon.getObjectByName('crystal');
      if (crystal) {
        crystal.rotation.y = now * 0.004;
        crystal.scale.setScalar(1 + lunge * 0.8 + Math.sin(now * 0.006) * 0.1);
      }
    }
    const born = Math.min(1, (now - d.born) / 260);
    const pop = born < 1 ? 1 + Math.sin(born * Math.PI) * 0.18 : 1;
    const hitScale = (now - (d.hitAt ?? -9999)) / 200;
    const flinch = hitScale < 1 ? 1 + Math.sin(hitScale * Math.PI) * 0.1 : 1;
    const base = d.baseScale ?? 1;
    g.scale.setScalar(base * (0.2 + 0.8 * born) * pop * flinch);
  }
  puff(x: number, y: number, z: number, now: number) {
    if (this.smokes.length > 60) return;
    const m = new T.Mesh(this.smokeGeo, this.smokeMat.clone());
    m.position.set(x, y, z);
    m.scale.setScalar(0.5);
    this.smokeGroup.add(m);
    this.smokes.push({
      m,
      born: now,
      life: 2200,
      vx: (Math.random() - 0.5) * 0.2,
      vz: (Math.random() - 0.5) * 0.2,
    });
  }
  animateSmoke(now: number, dt: number) {
    for (const sm of this.smokes.slice()) {
      const t = (now - sm.born) / sm.life;
      if (t >= 1) {
        this.smokeGroup.remove(sm.m);
        (sm.m.material as T.Material).dispose();
        this.smokes.splice(this.smokes.indexOf(sm), 1);
        continue;
      }
      sm.m.position.y += dt * 0.9;
      sm.m.position.x += (sm.vx + 0.15) * dt;
      sm.m.position.z += sm.vz * dt;
      sm.m.scale.setScalar(0.5 + t * 1.6);
      (sm.m.material as T.MeshStandardMaterial).opacity = 0.45 * (1 - t);
    }
  }
  burst(x: number, z: number, now: number, color: number) {
    const g = new T.Group();
    g.position.set(x, this.y(x, z) + 0.2, z);
    const ring = new T.Mesh(
      new T.RingGeometry(0.4, 0.6, 28),
      new T.MeshBasicMaterial({ color, side: T.DoubleSide, transparent: true }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.name = 'ring';
    g.add(ring);
    for (let i = 0; i < 10; i++) {
      const spark = new T.Mesh(
        new T.OctahedronGeometry(0.09),
        new T.MeshBasicMaterial({ color: 0xfff1b8, transparent: true }),
      );
      spark.userData.a = (i / 10) * Math.PI * 2;
      spark.userData.r = 0.6 + (i % 3) * 0.25;
      g.add(spark);
    }
    this.scene.add(g);
    this.bursts.push({ g, born: now });
  }
  animateBursts(now: number) {
    for (const b of this.bursts.slice()) {
      const t = (now - b.born) / 900;
      if (t >= 1) {
        this.scene.remove(b.g);
        this.disposeGeometry(b.g, true);
        this.bursts.splice(this.bursts.indexOf(b), 1);
        continue;
      }
      for (const o of b.g.children) {
        if (o.name === 'ring') {
          const k = 1 + t * 4;
          o.scale.set(k, k, 1);
          ((o as T.Mesh).material as T.MeshBasicMaterial).opacity = 1 - t;
        } else {
          const a = o.userData.a as number,
            r = (o.userData.r as number) * (0.3 + t * 2);
          o.position.set(
            Math.cos(a) * r,
            Math.sin(t * Math.PI) * 1.6 + t * 0.4,
            Math.sin(a) * r,
          );
          o.rotation.y = now * 0.01;
          ((o as T.Mesh).material as T.MeshBasicMaterial).opacity = 1 - t * t;
        }
      }
    }
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
    placement: { kind: BuildKind; x: number; z: number; angle?: number } | null,
  ) {
    this.localId = localId;
    const now = performance.now(),
      dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    // Day / night: battles darken the sky and let the keep's flame carry the light.
    const target = w.phase === 'battle' ? 1 : 0;
    this.night += (target - this.night) * Math.min(1, dt * 1.4);
    this.sun.intensity = 2.3 - 1.1 * this.night;
    this.hemi.intensity = 2.0 - 0.7 * this.night;
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
    this.windowMat.emissiveIntensity = 0.15 + this.night * 1.6;
    this.glowMat.emissiveIntensity =
      1.2 + this.night * 1.2 + Math.sin(now * 0.02) * 0.2;
    const keep = w.buildings[0];
    if (keep && keep.hp < this.lastKeepHp - 0.01) this.shakeAt = now;
    this.lastKeepHp = keep ? keep.hp : Infinity;
    const shakeT = (now - this.shakeAt) / 320;
    const shake = !this.reducedMotion && shakeT < 1 ? (1 - shakeT) * 0.35 : 0;
    const sx = Math.sin(now * 0.09) * shake,
      sz = Math.cos(now * 0.11) * shake;
    const py = p ? this.y(p.x, p.z) : 0;
    this.camera.position.set(
      this.follow.x + 28 + sx,
      py + 34,
      this.follow.z + 28 + sz,
    );
    this.camera.lookAt(this.follow.x + sx, py, this.follow.z + sz);
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
        this.art.outline(g);
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
      if (b.cool > (d.lastCool ?? 0) + 0.05) d.fireAt = now;
      d.lastCool = b.cool;
      const fan = g.getObjectByName('fan');
      if (fan) fan.rotation.z += dt;
      const flag = g.getObjectByName('flag');
      if (flag) flag.rotation.y = Math.sin(now * 0.004 + b.x) * 0.35;
      const cart = g.getObjectByName('cart');
      if (cart) cart.position.z = 0.9 + Math.sin(now * 0.0015 + b.z) * 0.55;
      const turret = g.getObjectByName('turret');
      if (turret) {
        const e = w.enemies.length
          ? w.enemies.reduce((best, en) =>
              dist(b, en) < dist(b, best) ? en : best,
            )
          : null;
        if (e && dist(b, e) < 14) {
          const want = Math.atan2(e.x - b.x, e.z - b.z);
          turret.rotation.y +=
            Math.atan2(
              Math.sin(want - turret.rotation.y),
              Math.cos(want - turret.rotation.y),
            ) * Math.min(1, dt * 8);
        }
        const ft = (now - (d.fireAt ?? -9999)) / 260;
        const recoil = ft < 1 ? Math.sin(ft * Math.PI) : 0;
        turret.position.z = -recoil * 0.25;
        const bolt = turret.getObjectByName('bolt');
        if (bolt) bolt.visible = ft > 0.55 || ft >= 1;
      }
      const crystal = g.getObjectByName('crystal');
      if (crystal) {
        crystal.rotation.y = now * 0.0015;
        crystal.position.y =
          (d.crystalY ?? (d.crystalY = crystal.position.y)) +
          Math.sin(now * 0.003 + b.x) * 0.12;
      }
      const runes = g.getObjectByName('runes');
      if (runes) {
        runes.rotation.z = now * 0.0008;
        const near = w.players.some((p) => p.dead <= 0 && dist(p, b) < 5);
        const k = near ? 1 + Math.sin(now * 0.008) * 0.12 : 1;
        runes.scale.set(k, k, 1);
      }
      const torchAt = now * 0.02 + b.x * 3;
      g.traverse((o) => {
        if (o.name === 'torch')
          o.scale.setScalar(0.85 + Math.sin(torchAt + o.position.x * 7) * 0.2);
      });
      const chimney = g.getObjectByName('chimney');
      if (
        chimney &&
        w.phase !== 'over' &&
        now - (d.smokeAt ?? 0) > 900 + (b.x % 3) * 200
      ) {
        d.smokeAt = now;
        const wp = chimney.getWorldPosition(new T.Vector3());
        this.puff(wp.x, wp.y + 0.3, wp.z, now);
      }
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
      g.rotation.y = b.angle || 0;
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
        this.art.outline(g);
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
      g.rotation.y +=
        Math.atan2(
          Math.sin(u.angle - g.rotation.y),
          Math.cos(u.angle - g.rotation.y),
        ) *
        (1 - Math.exp(-dt * 14));
      g.visible = !isPlayer || u.dead <= 0;
      this.animateUnit(g, u, now, dt);
      if (isPlayer) {
        const prev = this.lastLevel.get(u.id);
        if (prev !== undefined && u.level > prev)
          this.burst(u.x, u.z, now, u.color);
        this.lastLevel.set(u.id, u.level);
      }
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
        this.art.outline(g);
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
      g.rotation.y +=
        Math.atan2(
          Math.sin(u.angle - g.rotation.y),
          Math.cos(u.angle - g.rotation.y),
        ) *
        (1 - Math.exp(-dt * 14));
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
    this.animateSmoke(now, dt);
    this.animateBursts(now);
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
      const wantY = placement.angle || 0;
      this.ghost.rotation.y +=
        Math.atan2(
          Math.sin(wantY - this.ghost.rotation.y),
          Math.cos(wantY - this.ghost.rotation.y),
        ) * Math.min(1, dt * 14);
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
        if (
          o instanceof T.Mesh &&
          (o.material instanceof T.MeshStandardMaterial ||
            o.material instanceof T.MeshToonMaterial)
        )
          o.material.emissive.setHex(valid ? 0x143320 : 0x661a22);
      });
    } else if (this.ghost) {
      this.scene.remove(this.ghost);
      this.disposeGeometry(this.ghost, true);
      this.ghost = null;
    }
    this.renderer.render(this.scene, this.camera);
  }
  direction(x: number, z: number) {
    return screenDirection(x, z);
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
    this.art.dispose();
    this.gemGeometry.dispose();
    this.gemMeshes.clear();
    this.terrainMeshes.clear();
    this.dying = [];
    this.smokes = [];
    this.bursts = [];
    this.smokeGeo.dispose();
    this.windowMat.dispose();
    this.glowMat.dispose();
    this.eyeMat.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
