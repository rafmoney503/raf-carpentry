import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

/* A job's SketchUp model, turned in 3D on its page (Model3D.tsx loads this file on demand).
   The .glb comes from the model built in Trimble SketchUp and read back face by face
   (scripts/su-to-glb.mjs): faces with their SketchUp material, SketchUp's own edge lines, parts that
   move (node extras `move`: a lid or door on its hinge line, or a basket or drawer that slides out, each
   with its own slot `at` in the open animation; knobs ride along as children) and, on the root node,
   dimension lines (`dims`), the opening view and its limits (`view`), button words (`actions`) and the
   animation length (`secs`). Each part node carries its name (extras `part`) for tap-to-name.
   On top of turning: take it apart (every piece pulled away from the middle, as in an exploded
   drawing; the bottom stays on the floor, walls stay put), zoom (towards a point) and slide the view
   while zoomed in. Units: metres, Y up, the room side facing +Z. */

export type Model3DScene = {
  /** Stage size in CSS px. */
  resize(w: number, h: number): void;
  /** Orbit: yaw 0 = straight at the front, pitch 0 = level with the floor (radians). */
  view(yaw: number, pitch: number): void;
  /** 0 = shut, 1 = everything open (lids up, doors open, baskets out). */
  setOpen(t: number): void;
  readonly hasMoves: boolean;
  readonly actions: { open: string; close: string };
  readonly secs: number;
  readonly limits: ViewLimits;
  /** Dimension labels: text and where each sits on the stage (CSS px), or null when hidden. */
  readonly dimLabels: string[];
  setDims(on: boolean): void;
  dimPositions(): ({ x: number; y: number } | null)[];
  /** 0 = built, 1 = taken apart. */
  setApart(t: number): void;
  readonly canApart: boolean;
  /** Zoom by a factor (below 1 = closer), towards a point on the stage (CSS px) when given. */
  zoom(f: number, at?: { x: number; y: number }): void;
  /** Slide the view by CSS px (only while zoomed in). */
  pan(dx: number, dy: number): void;
  /** Back to the opening framing: zoom 1, centred. */
  resetZoom(): void;
  readonly zoomed: boolean;
  /** The part under a point on the stage (CSS px): highlights it and returns its name; null clears. */
  pick(x: number, y: number): string | null;
  /** Where the picked part's name sits on the stage (CSS px), or null. */
  pickPosition(): { x: number; y: number } | null;
  /** Draws a frame; true while the camera is still easing to fit (keep drawing). */
  render(): boolean;
  dispose(): void;
};

type V3 = [number, number, number];
type Move = { kind: 'hinge'; origin: V3; axis: V3; angle: number; at: [number, number] } | { kind: 'slide'; offset: V3; at: [number, number] };
export type ViewLimits = { yaw: number; pitch: number; yawMin: number; yawMax: number; pitchMin: number; pitchMax: number };
type Dim = { a: [number, number, number]; b: [number, number, number]; off: [number, number, number]; label: string };

const INK = 0x16191c, ACCENT = 0x2547d0;
const APART = 0.55; // how far the pieces spread when taken apart (share of their distance from the middle)
const ZMIN = 0.3, ZMAX = 1.6;
const ease = (s: number) => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
/** "Shelf A 1900" -> "Shelf A": heights used to tell shelves apart in the model are not sizes to show. */
const partName = (n: string) => n.replace(/\s+\d{3,4}$/, '');
const DEFAULT_VIEW: ViewLimits = { yaw: -0.22, pitch: 0.52, yawMin: -1.3, yawMax: 0.9, pitchMin: 0.08, pitchMax: 1.25 };

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

  // ---- the model: each SketchUp material once, faces pushed back a hair so the edge lines sit on top
  const root = gltf.scene;
  const info = (root.children[0]?.userData ?? {}) as { dims?: Dim[]; view?: ViewLimits; actions?: { open: string; close: string }; secs?: number; apart?: string[] };
  // room context (walls, a chimney breast, a fireplace): materials called "Wall" or starting "Room"
  const isRoomMat = (m: THREE.Material) => m.name === 'Wall' || m.name.startsWith('Room');
  const edgeMat = new LineMaterial({ color: INK, linewidth: 1.1, transparent: true, opacity: 0.72 });
  const roomEdgeMat = new LineMaterial({ color: INK, linewidth: 1.1, transparent: true, opacity: 0.72 }); // fades with the room
  const owned: { dispose(): void }[] = [edgeMat, roomEdgeMat];
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const matFor = (m: THREE.MeshStandardMaterial) => {
    let out = mats.get(m.name);
    if (!out) {
      out = new THREE.MeshStandardMaterial({ name: m.name, color: m.color.clone(), roughness: m.roughness, metalness: m.metalness, emissive: m.emissive.clone(), emissiveIntensity: m.emissiveIntensity, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      mats.set(m.name, out);
      owned.push(out);
    }
    return out;
  };
  const swaps: [THREE.Object3D, THREE.Object3D][] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const old = o.material as THREE.MeshStandardMaterial;
      o.material = matFor(old);
      old.dispose();
      o.castShadow = true;
      o.receiveShadow = true;
      owned.push(o.geometry);
    } else if (o instanceof THREE.LineSegments) {
      const g = new LineSegmentsGeometry().setPositions(o.geometry.attributes.position.array as Float32Array);
      const sib = o.parent?.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh | undefined;
      const l = new LineSegments2(g, sib && isRoomMat(sib.material as THREE.Material) ? roomEdgeMat : edgeMat);
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

  // ---- moving parts: lids and doors hang from a pivot on their hinge line, baskets and drawers slide
  type Mover = { obj: THREE.Object3D; move: Move; axis?: THREE.Vector3; offset?: THREE.Vector3 };
  const movers: Mover[] = [];
  const moving: THREE.Object3D[] = [];
  root.traverse((o) => { if (o.userData.move) moving.push(o); });
  for (const o of moving) {
    const move = o.userData.move as Move;
    if (move.kind === 'hinge') {
      const pivot = new THREE.Object3D();
      pivot.position.fromArray(move.origin);
      o.parent!.add(pivot);
      pivot.add(o);
      o.position.set(-move.origin[0], -move.origin[1], -move.origin[2]);
      movers.push({ obj: pivot, move, axis: new THREE.Vector3().fromArray(move.axis).normalize() });
    } else {
      movers.push({ obj: o, move, offset: new THREE.Vector3().fromArray(move.offset) });
    }
  }
  scene.add(root);

  // ---- taking it apart: each top-level piece (with whatever rides on it) sits in its own group, which slides
  // out from the middle of its job, up from the floor rather than from the middle so nothing sinks below it.
  // A model of two jobs in one room names them in `apart` (e.g. "Window seat", "Alcove cabinet"): parts called
  // "<that>: ..." come apart round the middle of their own job. The room fades away while the job is apart.
  const isWall = (o: THREE.Object3D) => {
    let wall = false;
    o.traverse((m) => { if (m instanceof THREE.Mesh && isRoomMat(m.material as THREE.Material)) wall = true; });
    return wall;
  };
  const nameOf = (o: THREE.Object3D) => {
    let n = '';
    o.traverse((c) => { if (!n && c.userData.part) n = c.userData.part as string; });
    return n;
  };
  const pieces: { g: THREE.Object3D; off: THREE.Vector3 }[] = [];
  const roomPieces: THREE.Object3D[] = [];
  const roomMeshes = new Set<THREE.Object3D>();
  const modelNode = root.children[0];
  if (modelNode) {
    root.updateMatrixWorld(true);
    const kids = [...modelNode.children];
    const boxes = kids.map((k) => new THREE.Box3().setFromObject(k));
    const jobOf = (k: THREE.Object3D) => (info.apart ?? []).find((a) => nameOf(k).startsWith(a + ': ')) ?? '';
    const jobs = new Map<string, THREE.Box3>();
    kids.forEach((k, i) => {
      if (isWall(k)) return;
      const j = jobOf(k);
      jobs.set(j, (jobs.get(j) ?? new THREE.Box3()).union(boxes[i]));
    });
    kids.forEach((k, i) => {
      const g = new THREE.Group();
      modelNode.add(g);
      g.add(k);
      if (isWall(k)) {
        roomPieces.push(g);
        k.traverse((m) => { if (m instanceof THREE.Mesh) roomMeshes.add(m); });
        return;
      }
      const job = jobs.get(jobOf(k))!, mid = job.getCenter(new THREE.Vector3());
      const c = boxes[i].getCenter(new THREE.Vector3());
      pieces.push({ g, off: new THREE.Vector3(c.x - mid.x, c.y - job.min.y, c.z - mid.z).multiplyScalar(APART) });
    });
  }
  const roomMats = [...mats.values()].filter(isRoomMat);
  let roomGone = false;

  // ---- tap a part to see its name (walls are only there for context)
  const pickables: THREE.Mesh[] = [];
  root.traverse((o) => { if (o instanceof THREE.Mesh && !isRoomMat(o.material as THREE.Material)) pickables.push(o); });
  const hlMats = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  let picked: { mesh: THREE.Mesh; base: THREE.Material; at: THREE.Vector3 } | null = null;
  const ray = new THREE.Raycaster();
  function unpick() {
    if (picked) picked.mesh.material = picked.base;
    picked = null;
  }

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
  const dims = info.dims ?? [];
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
  const limits = { ...DEFAULT_VIEW, ...info.view };
  let W = 1, H = 1, yaw = limits.yaw, pitch = limits.pitch, dist = 0, need = 0, zoomK = 1;
  const panWant = new THREE.Vector3(), panNow = new THREE.Vector3();
  const centreNow = new THREE.Vector3(), centreWant = new THREE.Vector3(), base = new THREE.Vector3();
  const right = new THREE.Vector3(), up = new THREE.Vector3();
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  // slide only while zoomed in, and less the further out: at zoom 1 the job is centred again
  function clampPan() {
    const k = Math.max(0, (1 - zoomK) / (1 - ZMIN));
    panWant.set(
      THREE.MathUtils.clamp(panWant.x, -half.x * k, half.x * k),
      THREE.MathUtils.clamp(panWant.y, -half.y * k * 1.2, half.y * k * 1.2),
      THREE.MathUtils.clamp(panWant.z, -half.z * k, half.z * k),
    );
  }
  // framing uses the corners of every part (where it is now: open, apart), not one box round the lot,
  // so an empty corner of that box (in front of a hearth, say) doesn't push the job off centre
  const fitMeshes: THREE.Mesh[] = [];
  root.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.computeBoundingBox(); fitMeshes.push(o); } });
  const pts = Array.from({ length: fitMeshes.length * 8 + labelAt.length }, () => new THREE.Vector3());
  const partBox = new THREE.Box3();
  let corners: THREE.Vector3[] = [];
  const q = new THREE.Vector3();
  function place() {
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const fwd = dir.clone().negate();
    right.crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    up.crossVectors(right, fwd);
    root.updateMatrixWorld(true);
    let k = 0;
    for (const mesh of fitMeshes) {
      if (roomGone && roomMeshes.has(mesh)) continue;
      const { min, max } = partBox.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) pts[k++].set(x, y, z);
    }
    if (dimGroup.visible) for (const p of labelAt) pts[k++].copy(p);
    corners = pts.slice(0, k);
    const tv = Math.tan((camera.fov * Math.PI) / 360), th = tv * camera.aspect;
    const m = 0.86; // keep a margin round the edge of the stage
    const fit = () => {
      base.copy(target).add(centreNow);
      need = 0;
      for (const c of corners) {
        q.copy(c).sub(base);
        const x = q.dot(right), y = q.dot(up), z = q.dot(dir);
        need = Math.max(need, z + Math.abs(x) / (th * m), z + Math.abs(y) / (tv * m));
      }
      // centre the job on the stage: aim at the middle of where its corners land, not the middle of its box
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) {
        q.copy(c).sub(base);
        const zc = Math.max(1e-3, need - q.dot(dir)), sx = q.dot(right) / zc, sy = q.dot(up) / zc;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      centreWant.copy(centreNow).addScaledVector(right, ((x0 + x1) / 2) * need).addScaledVector(up, ((y0 + y1) / 2) * need);
    };
    if (!dist) {
      // first frame (or after a resize): settle the framing at once, so the job doesn't drift into place
      for (let i = 0; i < 8; i++) { fit(); centreNow.copy(centreWant); }
      fit();
    } else {
      fit();
      centreNow.lerp(centreWant, 0.18);
    }
    const want = need * zoomK;
    dist = dist ? dist + (want - dist) * 0.18 : want; // ease, so opening the lids or zooming doesn't jolt the view
    panNow.lerp(panWant, 0.3);
    const aim = q.copy(target).add(centreNow).add(panNow);
    camera.position.copy(aim).addScaledVector(dir, dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(aim);
    camera.near = Math.max(0.02, dist - span * 1.5); camera.far = dist + span * 3;
    camera.updateProjectionMatrix();
    return Math.abs(want - dist) > 0.002 || panNow.distanceToSquared(panWant) > 1e-8 || centreNow.distanceToSquared(centreWant) > 1e-8;
  }
  const toNdc = (x: number, y: number) => new THREE.Vector2((x / W) * 2 - 1, 1 - (y / H) * 2);

  return {
    hasMoves: movers.length > 0,
    actions: info.actions ?? { open: 'Lift the lids', close: 'Close the lids' },
    secs: info.secs ?? 1.3,
    limits,
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
    setOpen(t) {
      for (const m of movers) {
        // each part has its own slot in the animation, so doors open before the baskets come out
        const [a, b] = m.move.at;
        const s = Math.min(1, Math.max(0, (t - a) / Math.max(1e-6, b - a)));
        const e = ease(s);
        if (m.axis && m.move.kind === 'hinge') m.obj.quaternion.setFromAxisAngle(m.axis, m.move.angle * e);
        else if (m.offset) m.obj.position.copy(m.offset).multiplyScalar(e);
      }
    },
    setDims(on) { dimGroup.visible = on && labelAt.length > 0; },
    canApart: pieces.length > 1,
    setApart(t) {
      const e = ease(Math.min(1, Math.max(0, t)));
      for (const p of pieces) p.g.position.copy(p.off).multiplyScalar(e);
      // the room fades out as the job comes apart, and back in as it goes together
      const a = Math.max(0, 1 - e * 1.6);
      for (const m of roomMats) { m.transparent = a < 1; m.opacity = a; m.depthWrite = a > 0.6; }
      roomEdgeMat.opacity = 0.72 * a;
      roomGone = a <= 0.001;
      for (const g of roomPieces) g.visible = !roomGone;
    },
    zoom(f, at) {
      const nz = THREE.MathUtils.clamp(zoomK * f, ZMIN, ZMAX);
      if (at && need) {
        // keep the point under the finger or cursor where it is
        const n = toNdc(at.x, at.y);
        const tv = Math.tan((camera.fov * Math.PI) / 360), d = need * (zoomK - nz);
        panWant.addScaledVector(right, n.x * tv * camera.aspect * d).addScaledVector(up, n.y * tv * d);
      }
      zoomK = nz;
      clampPan();
    },
    pan(dx, dy) {
      const k = (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / H;
      panWant.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
      clampPan();
    },
    resetZoom() { zoomK = 1; panWant.set(0, 0, 0); },
    get zoomed() { return Math.abs(zoomK - 1) > 0.001 || panWant.lengthSq() > 1e-8; },
    pick(x, y) {
      unpick();
      ray.setFromCamera(toNdc(x, y), camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      if (!hit) return null;
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.part) o = o.parent;
      if (!o) return null;
      const mesh = hit.object as THREE.Mesh, base = mesh.material as THREE.MeshStandardMaterial;
      let hl = hlMats.get(base);
      if (!hl) {
        hl = base.clone(); // the part turns a light blueprint blue, keeping its light and shade
        hl.color.set(ACCENT).lerp(new THREE.Color(0xffffff), 0.42);
        hl.metalness = 0;
        hl.emissive.set(ACCENT);
        hl.emissiveIntensity = 0.08;
        hlMats.set(base, hl);
        owned.push(hl);
      }
      mesh.material = hl;
      picked = { mesh, base, at: mesh.worldToLocal(hit.point.clone()) };
      return partName(o.userData.part as string);
    },
    pickPosition() {
      if (!picked) return null;
      const s = picked.mesh.localToWorld(picked.at.clone()).project(camera);
      return s.z > 1 ? null : { x: ((s.x + 1) / 2) * W, y: ((1 - s.y) / 2) * H };
    },
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
