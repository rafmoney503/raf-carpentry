import * as THREE from 'three';
import { R_MARK } from './r-logo';

/* The 3D R: both pieces of the logo cut from 18 mm birch ply (13 plies on the edge), lit softly,
   with a faint shadow on the floor. Loaded only when the About page's logo comes into view
   (Logo3D.tsx imports this file on demand), so three.js never slows the rest of the site.
   Sizes: the R is 10 units tall and 1 unit thick. */

const MW = R_MARK.w, MH = R_MARK.h, U = 0.01;
const DEPTH = 1, BEVEL_T = 0.035, BEVEL_S = 0.03;
const TAU = Math.PI * 2;

export type Logo3DScene = {
  /** Stage size in CSS px; the R is `hpx` tall with its centre `cy` px from the top. */
  resize(w: number, h: number, hpx: number, cy: number): void;
  /** depth 0..1 (how far the board has been "cut" out), yaw and pitch in radians. */
  pose(depth: number, yaw: number, pitch: number): void;
  render(): void;
  dispose(): void;
};

function shapeFromPath(d: string) {
  const toks = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const P = (x: number, y: number): [number, number] => [(x - MW / 2) * U, (MH / 2 - y) * U];
  const s = new THREE.Shape();
  let i = 0, cmd = '';
  const n = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    if (/[MLCZ]/.test(toks[i])) cmd = toks[i++];
    if (cmd === 'M') s.moveTo(...P(n(), n()));
    else if (cmd === 'L') s.lineTo(...P(n(), n()));
    else if (cmd === 'C') {
      const [ax, ay] = P(n(), n()), [bx, by] = P(n(), n()), [x, y] = P(n(), n());
      s.bezierCurveTo(ax, ay, bx, by, x, y);
    } else if (cmd === 'Z') s.closePath();
  }
  return s;
}

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Birch face: long grain that wanders a little. Tiles both ways. */
function birchFace(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = rng(3);
  const a = document.createElement('canvas'); a.width = w; a.height = h;
  const x = a.getContext('2d')!;
  x.fillStyle = '#dcc194'; x.fillRect(0, 0, w, h);
  const dark = '170,124,66', light = '246,230,196';
  for (let i = 0; i < 38; i++) {
    const cx = r() * w, bw = 12 + r() * 70, col = r() < 0.55 ? dark : light, al = 0.08 + r() * 0.2;
    for (const off of [-w, 0, w]) {
      const gr = x.createLinearGradient(cx + off - bw, 0, cx + off + bw, 0);
      gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.5, `rgba(${col},${al})`); gr.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = gr; x.fillRect(cx + off - bw, 0, bw * 2, h);
    }
  }
  for (let i = 0; i < 480; i++) {
    const lx = r() * w, lw = 0.5 + r() * 1.6;
    x.fillStyle = `rgba(${r() < 0.7 ? dark : light},${0.04 + r() * 0.14})`;
    x.fillRect(lx, 0, lw, h);
    if (lx + lw > w) x.fillRect(lx - w, 0, lw, h);
  }
  for (let i = 0; i < 7; i++) {
    x.fillStyle = `rgba(${dark},${0.15 + r() * 0.25})`;
    x.beginPath(); x.ellipse(r() * w, r() * h, 0.8 + r() * 1.5, 3 + r() * 9, 0, 0, TAU); x.fill();
  }
  const p1 = r() * TAU, p2 = r() * TAU;
  for (let y = 0; y < h; y++) {
    const s = 16 * (Math.sin((y / h) * TAU * 2 + p1) * 0.7 + Math.sin((y / h) * TAU * 5 + p2) * 0.3);
    for (const off of [0, -w, w]) g.drawImage(a, 0, y, w, 1, s + off, y, w, 1);
  }
}

/* The edge of 18 mm birch ply: 13 layers, grain turning 90 degrees each time, glue lines between. */
function plyEdge(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = rng(11), n = 13, lh = h / n;
  for (let i = 0; i < n; i++) {
    const y0 = i * lh, along = i % 2 === 0;
    g.fillStyle = along ? (i === 0 || i === n - 1 ? '#e2c89b' : '#dcc192') : '#c39f68';
    g.fillRect(0, y0, w, lh);
    if (along) {
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(150,112,64,${0.05 + r() * 0.1})`; g.fillRect(0, y0 + r() * lh, w, 0.6 + r()); }
    } else {
      for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(140,100,55,${0.1 + r() * 0.25})`; g.fillRect(r() * w, y0 + 1 + r() * (lh - 2), 0.8 + r() * 1.2, 0.8 + r() * 2.2); }
    }
    if (i > 0) { g.fillStyle = 'rgba(92,66,34,0.75)'; g.fillRect(0, y0 - 0.9, w, 1.8); }
  }
}

export function createLogo3D(canvas: HTMLCanvasElement): Logo3DScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);

  const tex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d')!, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  };

  // soft studio light for the reflections, made once
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 14, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 0.43, 0.44), side: THREE.BackSide }));
  room.position.y = 4; envScene.add(room);
  const envFloor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.19, 0.18) }));
  envFloor.rotation.x = -Math.PI / 2; envFloor.position.y = -2.9; envScene.add(envFloor);
  for (const [w, h, x, y, z, k] of [[7, 5, -7, 6, 7, 5], [12, 1.2, 0, 9, 1, 3.5], [2.5, 8, 9, 2, -1, 2.2], [6, 3, 3, 3, -10, 1.6]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 0.97), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m);
  }
  const envRT = pm.fromScene(envScene, 0.035);
  pm.dispose();
  envScene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });

  const scene = new THREE.Scene();
  scene.environment = envRT.texture;
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 200);

  // light levels are the ones tuned for the logo page, times pi for three's physical light units
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc8bb, 0.5 * Math.PI));
  const key = new THREE.DirectionalLight(0xfff6ea, 1.25 * Math.PI);
  key.position.set(-4.5, 10, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  key.shadow.bias = -0.0004;
  key.shadow.radius = 5;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe8eeff, 0.35 * Math.PI); fill.position.set(8, 2, 6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7 * Math.PI); rim.position.set(-3, 6, -9); scene.add(rim);

  const geo = new THREE.ExtrudeGeometry([shapeFromPath(R_MARK.stem), shapeFromPath(R_MARK.bowl)], {
    depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL_T, bevelSize: BEVEL_S, bevelSegments: 3, curveSegments: 16,
  });
  geo.translate(0, 0, -DEPTH / 2);

  const face = tex(1024, 1024, birchFace);
  face.repeat.set(0.1, 0.1); face.offset.set(0.5, 0.5);
  const T = DEPTH + 2 * BEVEL_T;
  const edge = tex(1024, 256, plyEdge);
  // side walls get v = 1 - z, so one tile of 13 plies spans the full thickness
  edge.repeat.set(0.25, 1 / T); edge.offset.set(0, -(1 + BEVEL_T) / T);
  const mats = [
    new THREE.MeshPhysicalMaterial({ map: face, roughness: 0.58, clearcoat: 0.22, clearcoatRoughness: 0.4, envMapIntensity: 0.55 }),
    new THREE.MeshPhysicalMaterial({ map: edge, roughness: 0.78, envMapIntensity: 0.4 }),
  ];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  const pivot = new THREE.Group();
  pivot.add(mesh);
  scene.add(pivot);

  const floorGeo = new THREE.PlaneGeometry(80, 80);
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.13 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -5 - BEVEL_S - 0.03;
  floor.receiveShadow = true;
  scene.add(floor);

  return {
    resize(w, h, hpx, cy) {
      renderer.setSize(w, h, false);
      const upp = 10 / hpx; // 3D units per CSS pixel at the R
      const dist = (h * upp) / (2 * Math.tan((camera.fov * Math.PI) / 360));
      const camY = (cy - h / 2) * upp;
      camera.aspect = w / h;
      camera.position.set(0, camY, dist);
      camera.lookAt(0, camY, 0);
      camera.near = dist * 0.3; camera.far = dist * 3;
      camera.updateProjectionMatrix();
    },
    pose(depth, yaw, pitch) {
      mesh.scale.z = Math.max(0.02, depth);
      pivot.rotation.set(pitch, yaw, 0);
    },
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      geo.dispose(); face.dispose(); edge.dispose(); mats.forEach((m) => m.dispose());
      floorGeo.dispose(); floorMat.dispose(); envRT.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
