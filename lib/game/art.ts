import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const ART = {
  ink: 0x342e2b,
  grass: 0xa9b449,
  olive: 0x777e49,
  ochre: 0xf0b94c,
  teal: 0x659899,
  plaster: 0xdacbb1,
  rust: 0xa5593e,
  asphalt: 0x706760,
};
export const ISO_ANGLE = Math.PI / 4;
export function screenDirection(x: number, z: number) {
  return { x: (x + z) * Math.SQRT1_2, z: (z - x) * Math.SQRT1_2 };
}
export function softenBox(w: number, h: number, d: number) {
  const edge = Math.min(w, h, d);
  return edge >= 0.16 && Math.max(w, h, d) < 12
    ? new RoundedBoxGeometry(w, h, d, 1, Math.min(0.065, edge * 0.14))
    : new T.BoxGeometry(w, h, d);
}

/** Shared paint and two-tone shading. Outlines reuse geometry and one material. */
export class ComicArt {
  gradient: T.DataTexture;
  paint: T.Texture;
  ink = new T.ShaderMaterial({
    side: T.BackSide,
    vertexShader:
      'void main(){vec3 p=position+normal*0.018;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
    fragmentShader: 'void main(){gl_FragColor=vec4(0.16,0.14,0.13,1.0);}',
    toneMapped: false,
  });
  owned: T.Material[] = [];
  labels: T.Texture[] = [];
  constructor() {
    this.gradient = new T.DataTexture(
      new Uint8Array([
        110, 110, 110, 255, 178, 178, 178, 255, 255, 255, 255, 255,
      ]),
      3,
      1,
      T.RGBAFormat,
    );
    this.gradient.minFilter = this.gradient.magFilter = T.NearestFilter;
    this.gradient.needsUpdate = true;
    this.paint = new T.TextureLoader().load('/art/weathered-plaster.png');
    this.paint.colorSpace = T.SRGBColorSpace;
    this.paint.wrapS = this.paint.wrapT = T.RepeatWrapping;
    this.paint.anisotropy = 2;
  }
  material(color: number) {
    return new T.MeshToonMaterial({
      color,
      gradientMap: this.gradient,
      map: this.paint,
    });
  }
  outline(group: T.Object3D) {
    const meshes: T.Mesh[] = [];
    group.traverse((o) => {
      if (
        o instanceof T.Mesh &&
        !o.userData.ink &&
        !o.userData.outlined &&
        !o.userData.skipInk
      )
        meshes.push(o);
    });
    for (const m of meshes) {
      m.userData.outlined = true;
      const hull = new T.Mesh(m.geometry, this.ink);
      hull.userData.ink = true;
      hull.castShadow = false;
      hull.receiveShadow = false;
      hull.frustumCulled = m.frustumCulled;
      m.add(hull);
    }
  }
  sign(text: string, w: number, h: number, bg = '#e8b64d', fg = '#fff3c9') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = '#44372e';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 502, 182);
    ctx.font = '900 93px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#584031';
    ctx.lineWidth = 8;
    ctx.strokeText(text, 256, 104, 470);
    ctx.fillStyle = fg;
    ctx.fillText(text, 256, 104, 470);
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    this.labels.push(tex);
    const mat = new T.MeshBasicMaterial({ map: tex });
    this.owned.push(mat);
    const mesh = new T.Mesh(new T.PlaneGeometry(w, h), mat);
    mesh.userData.skipInk = true;
    return mesh;
  }
  dispose() {
    this.gradient.dispose();
    this.paint.dispose();
    this.ink.dispose();
    this.owned.forEach((m) => m.dispose());
    this.labels.forEach((t) => t.dispose());
  }
}
