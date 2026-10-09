import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

/* A job's SketchUp model, turned in 3D on its page (Model3D.tsx loads this file on demand).
   The .glb comes from the model built in Trimble SketchUp and read back face by face
   (scripts/su-to-glb.mjs): MDF faces, SketchUp's own edge lines, lids that know their hinge line
   (node extras `hinge: { origin, axis }`) and dimension lines (root extras `dims`).
   Units: metres, Y up, the room side facing +Z. */

export type Model3DScene = {
  /** Stage size in CSS px. */
  resize(w: number, h: number): void;
  /** Orbit: yaw 0 = straight at the front, pitch 0 = level with the floor (radians). */
  view(yaw: number, pitch: number): void;
  /** 0 = lids shut, 1 = lids up. */
  setLids(t: number): void;
  readonly hasLids: boolean;
  /** Dimension labels: text and where each sits on the stage (CSS px), or null when hidden. */
  readonly dimLabels: string[];
  setDims(on: boolean): void;
  dimPositions(): ({ x: number; y: number } | null)[];
  /** Draws a frame; true while the camera is still easing to fit (keep drawing). */
  render(): boolean;
  dispose(): void;
};

type Hinge = { origin: [number, number, number]; axis: [number, number, number]; open?: number };
type Dim = { a: [number, number, number]; b: [number, number, number]; off: [number, number, number]; label: string };

const INK = 0x16191c, ACCENT = 0x2547d0;
const LID_OPEN = (80 * Math.PI) / 180;

export async function createModel3D(canvas: HTMLCanvasElement, url: string): Promise<Model3DScene | null> {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  const gltf = await new GLTFLoader().loadAsync(url).catch(() => null);
  if (!gltf) { renderer.dispose(); return null; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.84; // so raw MDF reads as MDF, not orange
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0xffffff, 0);

  // a soft white studio for the light on the faces, made once
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.5, 0.5), side: THREE.BackSide }));
  room.position.y = 5; envScene.add(room);
  for (const [w, h, x, y, z, k] of [[10, 6, -8, 8, 9, 4], [14, 2, 0, 11, 2, 3], [4, 9, 11, 3, 0, 1.8]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m);
  }
  const envRT = pm.fromScene(envScene, 0.04);
  pm.dispose();
  envScene.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });

  const scene = new THREE.Scene();
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.5;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d2c4, 0.55 * Math.PI));
  const key = new THREE.DirectionalLight(0xfff5e8, 1.15 * Math.PI);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xeef2ff, 0.3 * Math.PI);
  scene.add(fill);

  // ---- the model: MDF faces pushed back a hair so SketchUp's edge lines sit on top
  const root = gltf.scene;
  const mdf = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(200 / 255, 172 / 255, 142 / 255, THREE.SRGBColorSpace), roughness: 0.86, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const edgeMat = new LineMaterial({ color: INK, linewidth: 1.1, transparent: true, opacity: 0.72 });
  const owned: { dispose(): void }[] = [mdf, edgeMat];
  const swaps: [THREE.Object3D, THREE.Object3D][] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      (o.material as THREE.Material).dispose();
      o.material = mdf;
      o.castShadow = true;
      o.receiveShadow = true;
      owned.push(o.geometry);
    } else if (o instanceof THREE.LineSegments) {
      const g = new LineSegmentsGeometry().setPositions(o.geometry.attributes.position.array as Float32Array);
      const l = new LineSegments2(g, edgeMat);
      l.name = o.name;
      swaps.push([o, l]);
      owned.push(g);
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  for (const [a, b] of swaps) {
    const parent = a.parent;
    if (parent) { parent.add(b); parent.remove(a); }
  }

  // ---- lids: each one hangs from a pivot on its hinge line
  const lids: { pivot: THREE.Object3D; axis: THREE.Vector3; open: number }[] = [];
  const hinged: THREE.Object3D[] = [];
  root.traverse((o) => { if (o.userData.hinge) hinged.push(o); });
  for (const o of hinged) {
    const h = o.userData.hinge as Hinge;
    const pivot = new THREE.Object3D();
    pivot.position.fromArray(h.origin);
    o.parent!.add(pivot);
    pivot.add(o);
    o.position.set(-h.origin[0], -h.origin[1], -h.origin[2]);
    lids.push({ pivot, axis: new THREE.Vector3().fromArray(h.axis).normalize(), open: h.open ?? LID_OPEN });
  }
  scene.add(root);

  // ---- centre of the job on the floor, and how big it is shut
  const box = new THREE.Box3().setFromObject(root);
  const target = box.getCenter(new THREE.Vector3());
  target.y = (box.max.y - box.min.y) * 0.42 + box.min.y;
  const span = box.getSize(new THREE.Vector3()).length();

  key.position.set(target.x - span * 0.55, target.y + span * 1.3, target.z + span * 0.9);
  key.target.position.copy(target);
  Object.assign(key.shadow.camera, { left: -span * 0.7, right: span * 0.7, top: span * 0.7, bottom: -span * 0.7, near: 0.1, far: span * 4 });
  key.shadow.camera.updateProjectionMatrix();
  fill.position.set(target.x + span, target.y + span * 0.4, target.z + span * 0.6);

  const floorGeo = new THREE.PlaneGeometry(span * 6, span * 6);
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.12 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(target.x, box.min.y - 0.001, target.z);
  floor.receiveShadow = true;
  scene.add(floor);
  owned.push(floorGeo, floorMat, envRT);

  // ---- dimension lines, as on Raf's drawings: line, extension lines and 45 degree ticks
  const dims = ((root.userData.dims ?? root.children[0]?.userData.dims ?? []) as Dim[]);
  const dimGroup = new THREE.Group();
  const dimMat = new LineMaterial({ color: ACCENT, linewidth: 1.25, depthTest: false, transparent: true });
  const labelAt: THREE.Vector3[] = [];
  if (dims.length) {
    const pts: number[] = [];
    const v = (a: number[]) => new THREE.Vector3().fromArray(a);
    for (const d of dims) {
      const a = v(d.a), b = v(d.b), off = v(d.off);
      const a2 = a.clone().add(off), b2 = b.clone().add(off);
      const out = off.clone().normalize();
      const gap = out.clone().multiplyScalar(0.03), over = out.clone().multiplyScalar(0.04);
      pts.push(...a.clone().add(gap).toArray(), ...a2.clone().add(over).toArray());
      pts.push(...b.clone().add(gap).toArray(), ...b2.clone().add(over).toArray());
      pts.push(...a2.toArray(), ...b2.toArray());
      const along = b.clone().sub(a).normalize();
      const tick = along.clone().add(out).normalize().multiplyScalar(0.035);
      for (const p of [a2, b2]) pts.push(...p.clone().sub(tick).toArray(), ...p.clone().add(tick).toArray());
      labelAt.push(a2.clone().add(b2).multiplyScalar(0.5).add(out.clone().multiplyScalar(0.07)));
    }
    const g = new LineSegmentsGeometry().setPositions(pts);
    const l = new LineSegments2(g, dimMat);
    l.renderOrder = 10;
    dimGroup.add(l);
    owned.push(g, dimMat);
  }
  dimGroup.visible = false;
  scene.add(dimGroup);

  // ---- camera: orbit the job, pulled back just enough to fit what is showing (lids up or down)
  let W = 1, H = 1, yaw = 0, pitch = 0.5, dist = 0;
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  const fitBox = new THREE.Box3();
  const q = new THREE.Vector3();
  function place() {
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const fwd = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd);
    fitBox.setFromObject(root);
    if (dimGroup.visible) for (const p of labelAt) fitBox.expandByPoint(p);
    const { min, max } = fitBox;
    let k = 0;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners[k++].set(x, y, z);
    const tv = Math.tan((camera.fov * Math.PI) / 360), th = tv * camera.aspect;
    const m = 0.86; // keep a margin round the edge of the stage
    let need = 0;
    for (const c of corners) {
      q.copy(c).sub(target);
      const x = q.dot(right), y = q.dot(up), z = q.dot(dir);
      need = Math.max(need, z + Math.abs(x) / (th * m), z + Math.abs(y) / (tv * m));
    }
    dist = dist ? dist + (need - dist) * 0.18 : need; // ease, so opening the lids doesn't jolt the view
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.near = Math.max(0.05, dist - span); camera.far = dist + span * 2;
    camera.updateProjectionMatrix();
    return Math.abs(need - dist) > 0.002;
  }

  return {
    hasLids: lids.length > 0,
    dimLabels: dims.map((d) => d.label),
    resize(w, h) {
      W = w; H = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      edgeMat.resolution.set(w, h);
      dimMat.resolution.set(w, h);
      dist = 0;
      place();
    },
    view(y, p) { yaw = y; pitch = p; },
    setLids(t) {
      lids.forEach((l, i) => {
        // one after another, left to right
        const s = Math.min(1, Math.max(0, (t * (1 + 0.24 * (lids.length - 1)) - 0.24 * i)));
        const e = s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
        l.pivot.quaternion.setFromAxisAngle(l.axis, l.open * e);
      });
    },
    setDims(on) { dimGroup.visible = on && labelAt.length > 0; },
    dimPositions() {
      if (!dimGroup.visible) return labelAt.map(() => null);
      return labelAt.map((p) => {
        const s = p.clone().project(camera);
        return s.z > 1 ? null : { x: ((s.x + 1) / 2) * W, y: ((1 - s.y) / 2) * H };
      });
    },
    render() {
      const easing = place();
      renderer.render(scene, camera);
      return easing;
    },
    dispose() {
      owned.forEach((o) => o.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
