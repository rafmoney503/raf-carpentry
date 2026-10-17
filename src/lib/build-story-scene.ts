import * as THREE from 'three';

/* The home page's "Nothing gets cut until you've seen it" section as one wardrobe going through the four steps while
   the page scrolls (BuildStory.tsx drives it and loads this file only when the section is close, so three.js never
   slows the rest of the page). Story progress p runs 0..1:
     Survey 0 to 0.25: a yellow tape runs across the empty alcove, then up the wall, 2400 both ways;
     Draw 0.27 to 0.48: the wardrobe draws itself in blue lines, the sizes come in, then it's stamped Signed off;
     Build 0.5 to 0.74: the panels come in from the plinth up (18 mm board, backs included);
     Fit 0.75 to 1: six doors close one by one, the scribe fillers and the top infill go in, Room left clean.
   Sizes are in metres: a 2400 x 2400 alcove, 600 deep, three 780 units between 30 mm scribe fillers. */

export type BuildStoryScene = {
  /** Stage size in CSS px. */
  resize(w: number, h: number): void;
  /** p = story progress 0..1; mx, my = pointer over the stage, -1..1 (0 when touch or away). */
  frame(p: number, mx: number, my: number): void;
  dispose(): void;
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const INK = 0x16191c;
const BLUE = 0x2547d0;
const W = 2.4, H = 2.4, D = 0.6, T = 0.018;
const FILL = 0.03, PL = 0.08, TOP = 2.28; // scribe fillers, plinth height, carcass top
const UW = (W - 2 * FILL) / 3; // 0.78
const X0 = -W / 2 + FILL;
const DZ = D + 0.12; // where the dimension lines sit, in front of the doors

type Part = { m: THREE.Mesh; e: THREE.LineSegments | null; g: THREE.BufferGeometry; home: THREE.Vector3 };
type Door = { pivot: THREE.Group; m: THREE.Mesh; e: THREE.LineSegments; hm: THREE.Mesh; side: 0 | 1; g: THREE.BufferGeometry };
type V3 = [number, number, number];

// camera path: [progress, position, look-at]
const CAMS: [number, V3, V3][] = [
  [0.0, [2.7, 1.55, 6.9], [0.1, 1.2, 0.3]],
  [0.25, [1.7, 1.7, 7.0], [0, 1.25, 0.3]],
  [0.5, [-1.1, 1.85, 6.9], [0, 1.25, 0.35]],
  [0.75, [1.9, 1.45, 6.2], [0, 1.2, 0.35]],
  [1.0, [-1.7, 1.5, 6.7], [0, 1.2, 0.4]],
];

export function createBuildStory(canvas: HTMLCanvasElement, stage: HTMLElement, stamp: HTMLElement | null): BuildStoryScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d2c2, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-2.4, 4.2, 3.6);
  scene.add(sun);
  const fillLight = new THREE.DirectionalLight(0xfff1dc, 0.55);
  fillLight.position.set(3, 1.6, 2.4);
  scene.add(fillLight);

  const mat = (color: number, o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, transparent: true, ...o });
  const edgeMat = (opacity = 0.55) => new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity });

  function addBox(group: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, edges = true, edgeOpacity = 0.55) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, material);
    m.position.set(x, y, z);
    group.add(m);
    let e: THREE.LineSegments | null = null;
    if (edges) {
      e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat(edgeOpacity));
      m.add(e);
    }
    return { m, e, g };
  }

  /* the room: an alcove between two wall masses, oak floor with board lines, the ceiling cut away like a section */
  const room = new THREE.Group();
  scene.add(room);
  const roomMat = mat(0xefece6, { transparent: false });
  addBox(room, 4.6, H, 0.1, 0, H / 2, -0.05, roomMat, true, 0.25);
  addBox(room, 0.7, H, 0.75, -(W / 2 + 0.35), H / 2, 0.375, roomMat, true, 0.3);
  addBox(room, 0.7, H, 0.75, W / 2 + 0.35, H / 2, 0.375, roomMat, true, 0.3);
  addBox(room, 6.4, 0.02, 3.6, 0, -0.01, 1.8, mat(0xd9c6a3, { transparent: false, roughness: 0.7 }), false);
  addBox(room, 4.6, 0.05, 1.1, 0, H + 0.025, 0.5, mat(0xf6f4ef, { transparent: false }), true, 0.35);
  const boardPts: THREE.Vector3[] = [];
  for (let i = -16; i <= 16; i++) boardPts.push(new THREE.Vector3(i * 0.2, 0.001, 0), new THREE.Vector3(i * 0.2, 0.001, 3.6));
  room.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(boardPts), new THREE.LineBasicMaterial({ color: 0xb79f78, transparent: true, opacity: 0.45 })));
  const skirting = addBox(room, W, 0.1, 0.018, 0, 0.05, 0.009, mat(0xf6f4ef, { transparent: false }), true, 0.35);

  /* the wardrobe, part by part */
  const builds: Part[] = [];
  const wardrobe = new THREE.Group();
  scene.add(wardrobe);
  const carcassMat = () => mat(0xf3f1eb);
  const doorMat = () => mat(0xa8b8a0, { roughness: 0.6 });
  const part = (list: Part[] | null, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material): Part => {
    const p = addBox(wardrobe, w, h, d, x, y, z, material);
    const q = { ...p, home: p.m.position.clone() };
    list?.push(q);
    return q;
  };
  part(builds, W - 2 * FILL, PL, 0.018, 0, PL / 2, D - 0.06, mat(0x8e9b87)); // plinth
  for (let u = 0; u < 3; u++) {
    const L = X0 + u * UW, R = L + UW, cx = (L + R) / 2;
    const yb = PL, yt = TOP, h = yt - yb;
    part(builds, UW, T, D, cx, yb + T / 2, D / 2, carcassMat()); // bottom
    part(builds, T, h, D, L + T / 2, yb + h / 2, D / 2, carcassMat()); // left side
    part(builds, T, h, D, R - T / 2, yb + h / 2, D / 2, carcassMat()); // right side
    part(builds, UW - 2 * T, h - 2 * T, T, cx, yb + h / 2, T / 2, carcassMat()); // back, 18 mm
    part(builds, UW, T, D, cx, yt - T / 2, D / 2, carcassMat()); // top
    const iw = UW - 2 * T, id = D - T - 0.02;
    const shelf = (y: number) => part(builds, iw - 0.004, T, id, cx, y, T + id / 2, carcassMat());
    const rail = (y: number) => {
      const g = new THREE.CylinderGeometry(0.012, 0.012, iw - 0.01, 16);
      const m = new THREE.Mesh(g, mat(0xb9bdc1, { metalness: 0.75, roughness: 0.3 }));
      m.rotation.z = Math.PI / 2;
      m.position.set(cx, y, D / 2);
      wardrobe.add(m);
      builds.push({ m, e: null, g, home: m.position.clone() });
    };
    if (u === 0) { shelf(2.0); rail(1.93); shelf(0.42); }
    if (u === 1) {
      shelf(2.0); shelf(1.62); shelf(1.24);
      for (let k = 0; k < 3; k++) part(builds, iw - 0.01, 0.2, 0.018, cx, yb + 0.14 + k * 0.24, D - 0.04, carcassMat()); // drawer fronts behind the doors
      shelf(yb + 0.75);
    }
    if (u === 2) { shelf(2.0); rail(1.93); rail(1.0); }
  }
  // doors: a pair per unit, hinged at the unit's sides, a slim bar handle near the meeting edge
  const doors: Door[] = [];
  for (let u = 0; u < 3; u++) {
    const L = X0 + u * UW, R = L + UW;
    const dw = (UW - 0.003 * 3) / 2, dh = TOP - PL - 0.006, y = PL + 0.003 + dh / 2, z = D + 0.009;
    for (const side of [0, 1] as const) {
      const pivot = new THREE.Group();
      pivot.position.set(side === 0 ? L + 0.003 : R - 0.003, y, z);
      wardrobe.add(pivot);
      const g = new THREE.BoxGeometry(dw, dh, 0.018);
      const m = new THREE.Mesh(g, doorMat());
      m.position.set(side === 0 ? dw / 2 : -dw / 2, 0, 0);
      pivot.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat());
      m.add(e);
      const hm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 0.02), mat(0x2a2d30, { metalness: 0.5, roughness: 0.4 }));
      hm.position.set(side === 0 ? dw - 0.035 : -dw + 0.035, 0.1, 0.02);
      m.add(hm);
      doors.push({ pivot, m, e, hm, side, g });
    }
  }
  // scribe fillers and the top infill
  const fillL = part(null, FILL, TOP - 0.003, 0.018, -W / 2 + FILL / 2, (TOP - 0.003) / 2, D + 0.009, doorMat());
  const fillR = part(null, FILL, TOP - 0.003, 0.018, W / 2 - FILL / 2, (TOP - 0.003) / 2, D + 0.009, doorMat());
  const infill = part(null, W, H - TOP, 0.018, 0, TOP + (H - TOP) / 2, D + 0.009, doorMat());

  /* the drawing: every edge of the finished wardrobe as one blue line drawing that draws itself */
  wardrobe.updateMatrixWorld(true);
  const drawPts: number[] = [];
  const v = new THREE.Vector3();
  const collect = (mesh: THREE.Object3D, geo: THREE.BufferGeometry) => {
    const eg = new THREE.EdgesGeometry(geo);
    const a = eg.attributes.position;
    for (let i = 0; i < a.count; i++) {
      v.fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld);
      drawPts.push(v.x, v.y, v.z);
    }
    eg.dispose();
  };
  [...builds, fillL, fillR, infill].forEach((p) => p.e && collect(p.m, p.g));
  doors.forEach((d) => collect(d.m, d.g));
  const drawGeo = new THREE.BufferGeometry();
  drawGeo.setAttribute('position', new THREE.Float32BufferAttribute(drawPts, 3));
  const drawing = new THREE.LineSegments(drawGeo, new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.9 }));
  scene.add(drawing);
  const drawCount = drawPts.length / 3;

  /* dimension lines */
  const dimMat = new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0 });
  const dimLine = (a: THREE.Vector3, b: THREE.Vector3, tick: THREE.Vector3) => {
    const g = new THREE.BufferGeometry().setFromPoints([a, b, a.clone().add(tick), a.clone().sub(tick), b.clone().add(tick), b.clone().sub(tick)]);
    scene.add(new THREE.LineSegments(g, dimMat));
  };
  dimLine(new THREE.Vector3(-W / 2, H + 0.28, DZ), new THREE.Vector3(W / 2, H + 0.28, DZ), new THREE.Vector3(0, 0.04, 0));
  dimLine(new THREE.Vector3(W / 2 + 0.1, 0, DZ), new THREE.Vector3(W / 2 + 0.1, H, DZ), new THREE.Vector3(0.04, 0, 0));
  for (let u = 0; u < 3; u++) {
    const L = X0 + u * UW;
    dimLine(new THREE.Vector3(L, H + 0.12, DZ), new THREE.Vector3(L + UW, H + 0.12, DZ), new THREE.Vector3(0, 0.025, 0));
  }

  /* the tape measure for the survey */
  const tapeMat = mat(0xf2c230, { roughness: 0.5 });
  const tapeH = new THREE.Mesh(new THREE.BoxGeometry(1, 0.025, 0.003).translate(0.5, 0, 0), tapeMat);
  tapeH.position.set(-W / 2 + 0.005, 1.05, 0.03);
  scene.add(tapeH);
  const tapeVMat = tapeMat.clone();
  const tapeV = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1, 0.003).translate(0, 0.5, 0), tapeVMat);
  tapeV.position.set(-W / 2 + 0.05, 0.005, 0.03);
  scene.add(tapeV);
  const caseMat = mat(0xe0ab1a, { roughness: 0.45 });
  const tapeCase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.045), caseMat);
  scene.add(tapeCase);

  /* labels in the page, placed over the 3D */
  const made: HTMLElement[] = [];
  const mk = (cls: string, html: string) => {
    const d = document.createElement('div');
    d.className = 'bs-lbl ' + cls;
    d.innerHTML = html;
    stage.appendChild(d);
    made.push(d);
    return d;
  };
  const L = {
    tapeW: mk('ink', '2400'),
    tapeH: mk('ink', '2400'),
    dimW: mk('', '2400'),
    dimH: mk('', '2400'),
    units: [mk('', '780'), mk('', '780'), mk('', '780')],
    board: mk('tag', '<b>18 mm</b> board, backs included'),
    scribeL: mk('tag', '<b>Scribed</b> to the wall'),
    scribeT: mk('tag', '<b>Scribed</b> to the ceiling'),
    clean: mk('tag', 'Fitted. <b>Room left clean.</b>'),
  };
  let sw = 1, sh = 1, aspect = 1;
  const place = (el: HTMLElement, x: number, y: number, z: number, op: number) => {
    el.style.opacity = op.toFixed(3);
    if (op <= 0.001) return;
    v.set(x, y, z).project(camera);
    const hw = el.offsetWidth / 2 + 8, hh = el.offsetHeight / 2 + 8;
    const px = clamp(((v.x + 1) / 2) * sw, hw, Math.max(hw, sw - hw));
    const py = clamp(((1 - v.y) / 2) * sh, hh, Math.max(hh, sh - hh));
    el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -50%)`;
  };

  const look = new THREE.Vector3();
  const pos = new THREE.Vector3();

  function frame(p: number, mx: number, my: number) {
    // camera along its path, pulled back on a narrow stage so the whole wardrobe fits, a little parallax from the pointer
    let a = CAMS[0], b = CAMS[CAMS.length - 1];
    for (let i = 0; i < CAMS.length - 1; i++) if (p >= CAMS[i][0] && p <= CAMS[i + 1][0]) { a = CAMS[i]; b = CAMS[i + 1]; break; }
    const k = ease(seg(p, a[0], b[0]));
    look.set(lerp(a[2][0], b[2][0], k), lerp(a[2][1], b[2][1], k), lerp(a[2][2], b[2][2], k));
    pos.set(lerp(a[1][0], b[1][0], k), lerp(a[1][1], b[1][1], k), lerp(a[1][2], b[1][2], k));
    const back = Math.max(1, 0.95 / aspect);
    if (back > 1) pos.sub(look).multiplyScalar(back).add(look);
    camera.position.set(pos.x + mx * 0.25, pos.y - my * 0.12, pos.z);
    camera.lookAt(look);

    // 01 Survey: the tape runs across the back wall, then up
    const sW = easeOut(seg(p, 0.02, 0.12)), sH = easeOut(seg(p, 0.12, 0.21));
    const tapeOn = 1 - seg(p, 0.3, 0.38);
    tapeH.scale.x = Math.max(0.001, sW * (W - 0.01));
    tapeV.scale.y = Math.max(0.001, sH * H);
    tapeMat.opacity = tapeVMat.opacity = caseMat.opacity = tapeOn;
    tapeH.visible = tapeV.visible = tapeOn > 0.01;
    tapeCase.visible = tapeOn > 0.01 && p < 0.3;
    if (sH <= 0) tapeCase.position.set(-W / 2 + sW * (W - 0.01) + 0.04, 1.05, 0.05);
    else tapeCase.position.set(-W / 2 + 0.05, sH * H + 0.04, 0.05);
    place(L.tapeW, 0, 1.12, 0.05, seg(p, 0.1, 0.13) * tapeOn);
    place(L.tapeH, -W / 2 + 0.2, 1.7, 0.05, seg(p, 0.19, 0.22) * tapeOn);

    // 02 Draw: the wardrobe draws itself in blue, the sizes come in, then it's signed off
    const dK = seg(p, 0.27, 0.45);
    drawGeo.setDrawRange(0, Math.floor((drawCount * dK) / 2) * 2);
    const dm = drawing.material as THREE.LineBasicMaterial;
    dm.opacity = 0.9 * (1 - seg(p, 0.58, 0.72));
    drawing.visible = dK > 0 && dm.opacity > 0.01;
    const dimOp = seg(p, 0.4, 0.46) * (1 - seg(p, 0.62, 0.7));
    dimMat.opacity = dimOp;
    place(L.dimW, 0, H + 0.28, DZ, dimOp);
    place(L.dimH, W / 2 + 0.1, H / 2, DZ, dimOp);
    // the three unit widths only when there's room for them beside the overall size
    L.units.forEach((el, u) => place(el, X0 + u * UW + UW / 2, H + 0.12, DZ, sh < 300 ? 0 : dimOp * 0.9));
    if (stamp) {
      const st = seg(p, 0.45, 0.48) * (1 - seg(p, 0.6, 0.64));
      stamp.style.opacity = st.toFixed(3);
      stamp.style.transform = `rotate(-6deg) scale(${(1.25 - 0.35 * easeOut(seg(p, 0.45, 0.48))).toFixed(3)})`;
    }

    // 03 Build: the panels come in, one after another, from the plinth up
    const bS = 0.5, bE = 0.74, n = builds.length;
    builds.forEach((q, i) => {
      const t0 = bS + (i / n) * (bE - bS) * 0.85;
      const e = easeOut(seg(p, t0, t0 + 0.04));
      q.m.visible = e > 0.001;
      (q.m.material as THREE.MeshStandardMaterial).opacity = e;
      if (q.e) (q.e.material as THREE.LineBasicMaterial).opacity = 0.55 * e;
      q.m.position.set(q.home.x, q.home.y + (1 - e) * 0.45, q.home.z + (1 - e) * 0.25);
    });
    place(L.board, -0.42, 1.55, 0.35, seg(p, 0.56, 0.6) * (1 - seg(p, 0.72, 0.76)));
    skirting.m.visible = p < 0.52;

    // 04 Fit: the doors close one by one, the fillers and the top infill go in
    const show = seg(p, 0.75, 0.77);
    doors.forEach((d, i) => {
      const t0 = 0.75 + i * 0.022;
      const e = ease(seg(p, t0, t0 + 0.06));
      d.m.visible = show > 0.001;
      (d.m.material as THREE.MeshStandardMaterial).opacity = show;
      (d.e.material as THREE.LineBasicMaterial).opacity = 0.55 * show;
      (d.hm.material as THREE.MeshStandardMaterial).opacity = show;
      const open = (1 - e) * 1.75;
      d.pivot.rotation.y = d.side === 0 ? -open : open;
    });
    [fillL, fillR].forEach((q, i) => {
      const e = easeOut(seg(p, 0.88 + i * 0.015, 0.93 + i * 0.015));
      q.m.visible = e > 0.001;
      (q.m.material as THREE.MeshStandardMaterial).opacity = e;
      (q.e!.material as THREE.LineBasicMaterial).opacity = 0.55 * e;
      q.m.position.set(q.home.x, q.home.y, q.home.z + (1 - e) * 0.5);
    });
    const ei = easeOut(seg(p, 0.91, 0.96));
    infill.m.visible = ei > 0.001;
    (infill.m.material as THREE.MeshStandardMaterial).opacity = ei;
    (infill.e!.material as THREE.LineBasicMaterial).opacity = 0.55 * ei;
    infill.m.position.set(infill.home.x, infill.home.y + (1 - ei) * 0.4, infill.home.z);
    place(L.scribeL, -W / 2 + 0.02, 0.9, D + 0.03, seg(p, 0.92, 0.94) * (1 - seg(p, 0.975, 0.995)));
    place(L.scribeT, 0.55, H - 0.06, D + 0.03, seg(p, 0.95, 0.97) * (1 - seg(p, 0.975, 0.995)));
    place(L.clean, 0, 0.35, D + 0.25, seg(p, 0.985, 1.0));

    renderer.render(scene, camera);
  }

  return {
    resize(w, h) {
      sw = Math.max(1, w);
      sh = Math.max(1, h);
      aspect = sw / sh;
      renderer.setSize(sw, sh, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    frame,
    dispose() {
      made.forEach((el) => el.remove());
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm?.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
