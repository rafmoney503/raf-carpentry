'use client';

import { useEffect, useRef, useState } from 'react';
import { makeClimb } from './climb';

/* The home page hero: the steps logo in 3D. Three satin planks and the yellow ball over a field of wood grain that
   drifts slowly, bends round the pointer like a knot and warms up where the ball is. The ball climbs the way the logo
   in the top bar does (climb.ts). three.js is fetched only on this page, after the words are on screen; the planks
   rising in and the ball dropping onto them cover that wait. Drawing stops when the hero is off screen or the tab is
   hidden. People who ask for less motion get one still picture. If 3D is not available the flat logo shows. */

export default function HeroSteps() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    const hero = canvas?.parentElement;
    if (!canvas || !hero) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      try {
        const [THREE, { RoundedBoxGeometry }, { RoomEnvironment }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
          import('three/examples/jsm/environments/RoomEnvironment.js'),
        ]);
        if (disposed) return;
        cleanup = start(THREE, RoundedBoxGeometry, RoomEnvironment, canvas, hero);
      } catch (err) {
        console.warn('3D steps off:', err);
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <>
      <canvas ref={ref} className="nh-canvas" aria-hidden="true" style={failed ? { display: 'none' } : undefined} />
      {failed ? (
        <svg className="nh-flat" viewBox="0 0 100 100" aria-hidden="true">
          <rect x="10" y="72" width="80" height="14" rx="2" fill="var(--ink)" />
          <rect x="34" y="54" width="56" height="14" rx="2" fill="var(--ink)" />
          <rect x="58" y="36" width="32" height="14" rx="2" fill="var(--ink)" />
          <circle cx="74" cy="25" r="9.5" fill="var(--hl)" stroke="var(--paper)" strokeWidth="3" />
        </svg>
      ) : null}
    </>
  );
}

type T3 = typeof import('three');
type RBG = typeof import('three/examples/jsm/geometries/RoundedBoxGeometry.js').RoundedBoxGeometry;
type RE = typeof import('three/examples/jsm/environments/RoomEnvironment.js').RoomEnvironment;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const U = 0.1; // logo units to scene units
const R = 0.95; // ball radius
const RAD = 0.18; // plank corner radius

const GRAIN = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime, uAspect, uKnot;
  uniform vec2 uMouse, uBall;
  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return v; }
  void main(){
    vec2 p = vec2(vUv.x*uAspect, vUv.y);
    vec2 m = vec2(uMouse.x*uAspect, uMouse.y);
    vec2 b = vec2(uBall.x*uAspect, uBall.y);
    float t = uTime*0.03;
    float f = p.y*16.0 + fbm(vec2(p.x*0.8 - t, p.y*2.4))*5.0 + fbm(vec2(p.x*0.3 + t*0.6, p.y*0.8 + 3.0))*8.0;
    vec2 d = (p - m)*vec2(1.0, 1.9);
    f += uKnot*3.4*exp(-dot(d,d)*15.0);
    float w = fwidth(f);
    float q = abs(fract(f + 0.5) - 0.5);
    float line = 1.0 - smoothstep(w*0.45, w*1.5, q);
    float vig = smoothstep(1.35, 0.15, length((vUv - vec2(0.62,0.5))*vec2(uAspect*0.75,1.0)));
    float db = length(p - b);
    float glow = exp(-db*db*4.5);
    vec3 col = vec3(0.031,0.035,0.039);
    vec3 lc = mix(vec3(0.62,0.58,0.48), vec3(1.0,0.89,0.36), glow);
    col += line*lc*(0.06 + 0.26*glow)*vig;
    col += vec3(1.0,0.84,0.28)*glow*0.05;
    gl_FragColor = vec4(col, 1.0);
  }`;

function start(THREE: T3, RoundedBoxGeometry: RBG, RoomEnvironment: RE, canvas: HTMLCanvasElement, hero: HTMLElement) {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 900 ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 2.4, 16);
  camera.lookAt(0, 0, 0);
  scene.add(camera);

  const bgMat = new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uMouse: { value: new THREE.Vector2(0.72, 0.55) },
      uBall: { value: new THREE.Vector2(0.7, 0.5) },
      uKnot: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: GRAIN,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
  bg.position.z = -34;
  bg.renderOrder = -1;
  camera.add(bg);

  const group = new THREE.Group();
  scene.add(group);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-5, 9, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 0.9);
  rim.position.set(6, 3, -7);
  scene.add(rim);

  // planks: rounded boxes whose width changes without stretching the corners (the two ends move, the middle grows)
  const planks = Array.from({ length: 5 }, () => {
    const g = new RoundedBoxGeometry(1, 1.4, 3.0, 5, RAD);
    const base = (g.attributes.position.array as Float32Array).slice();
    const m = new THREE.MeshPhysicalMaterial({
      color: 0xdfe2dc,
      roughness: 0.42,
      clearcoat: 0.55,
      clearcoatRoughness: 0.28,
      sheen: 0.35,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xfff3cf),
      envMapIntensity: 0.62,
      transparent: true,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    group.add(mesh);
    return { mesh, g, m, base, w: 1 };
  });
  const setWidth = (p: (typeof planks)[number], W: number) => {
    if (Math.abs(p.w - W) < 1e-4) return;
    p.w = W;
    const a = p.g.attributes.position.array as Float32Array;
    const h0 = 0.5 - RAD, h1 = W / 2 - RAD;
    for (let i = 0; i < a.length; i += 3) {
      const x = p.base[i];
      a[i] = W < 2 * RAD ? x * W : Math.sign(x) * (Math.abs(x) - h0 + h1);
    }
    p.g.attributes.position.needsUpdate = true;
  };

  const ballMat = new THREE.MeshPhysicalMaterial({ color: 0xffe45c, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0xffcf2e, emissiveIntensity: 0.16, envMapIntensity: 0.55, toneMapped: false });
  const ballGeo = new THREE.SphereGeometry(R, 64, 40);
  const ball = new THREE.Mesh(ballGeo, ballMat);
  ball.frustumCulled = false;
  group.add(ball);
  const ballLight = new THREE.PointLight(0xffd84a, 22, 9, 1.5); // inside the ball: it lights the steps, not itself
  group.add(ballLight);

  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const sx = sc.getContext('2d')!;
  const gr = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  sx.fillStyle = gr;
  sx.fillRect(0, 0, 128, 128);
  const shTex = new THREE.CanvasTexture(sc);
  const plane = new THREE.PlaneGeometry(1, 1);
  const shMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(plane, shMat);
  shadow.rotation.x = -Math.PI / 2;
  group.add(shadow);
  const floorMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.75 });
  const floor = new THREE.Mesh(plane, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0.3, (50 - 86) * U - 0.01, 0.4);
  floor.scale.set(11, 6, 1);
  group.add(floor);

  const climb = makeClimb(760, 0.64);
  let stacked = false; // phones and iPads in portrait: the steps sit above the words
  let base = { ry: -0.5, rx: 0.04 };
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, ux: 0.72, uy: 0.55, knot: 0, tk: 0 };
  const v = new THREE.Vector3();

  const layout = () => {
    const w = hero.clientWidth, h = hero.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const tan = Math.tan(THREE.MathUtils.degToRad(15));
    const visH = 2 * tan * 34;
    bg.scale.set(visH * camera.aspect * 1.04, visH * 1.04, 1);
    bgMat.uniforms.uAspect.value = camera.aspect;
    stacked = w < 900;
    const vh0 = 2 * tan * camera.position.length(), vw0 = vh0 * camera.aspect;
    if (stacked) {
      // the steps fill the space above the words: as big as fits, centred in it
      const inner = hero.querySelector('.nh-inner');
      const room = inner ? Math.max(120, inner.getBoundingClientRect().top - hero.getBoundingClientRect().top - 12) : h * 0.45;
      const roomW = (room / h) * vh0;
      const s = Math.min(0.36, (vw0 * 0.78) / 10.5, (roomW * 0.82) / 9.3);
      group.scale.setScalar(s);
      group.position.set(-0.45 * s, vh0 / 2 - roomW * 0.56 + 0.15 * s, 0);
      base = { ry: -0.5, rx: 0.02 };
    } else {
      const s = Math.min(1, (vw0 * 0.46) / 10.5);
      group.scale.setScalar(s);
      group.position.set(vw0 * 0.5 - 6.2 * s - vw0 * 0.03, -0.1, 0);
      base = { ry: -0.5, rx: 0.04 };
    }
  };
  const ro = new ResizeObserver(() => {
    layout();
    if (still) draw();
  });
  ro.observe(hero);
  const inner = hero.querySelector('.nh-inner');
  if (inner) ro.observe(inner);
  layout();

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = hero.getBoundingClientRect();
    mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    mouse.ux = (e.clientX - r.left) / r.width;
    mouse.uy = 1 - (e.clientY - r.top) / r.height;
    mouse.tk = 1;
  };
  const onLeave = () => {
    mouse.tx = 0;
    mouse.ty = 0;
    mouse.tk = 0;
  };
  hero.addEventListener('pointermove', onMove);
  hero.addEventListener('pointerleave', onLeave);

  function draw() {
    const P = climb.planks;
    planks.forEach((pk, i) => {
      const p = P[i];
      if (!p || p.w < 0.4 || p.op < 0.01) {
        pk.mesh.visible = false;
        return;
      }
      pk.mesh.visible = true;
      setWidth(pk, p.w * U);
      pk.mesh.position.set((p.x + p.w / 2 - 50) * U, (50 - (p.y + p.dy + 7)) * U, 0);
      pk.m.opacity = p.op;
    });
    const b = climb.ball;
    const sq = clamp(b.sq, -0.2, 0.35);
    ball.visible = b.show;
    ball.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    ball.position.set((b.x - 50) * U, (50 - b.y) * U + R * (1 - sq), b.z);
    ballLight.position.copy(ball.position);
    // the shadow sits on whatever is under the ball: a step, or the floor
    let surf = 86;
    if (Math.abs(b.z) < 1.8) for (const p of P) if (p.op > 0.5 && b.x >= p.x && b.x <= p.x + p.w && p.y >= b.y - 0.5 && p.y < surf) surf = p.y;
    const hgt = Math.max(0, surf - b.y);
    shadow.visible = b.show;
    shadow.position.set(ball.position.x, (50 - surf) * U + 0.015, b.z);
    const ss = 2.1 * R * (1 + hgt * 0.02);
    shadow.scale.set(ss, ss * 0.7, 1);
    shMat.opacity = 0.55 * Math.exp(-hgt * 0.035);
    ball.getWorldPosition(v);
    v.project(camera);
    bgMat.uniforms.uBall.value.set((v.x + 1) / 2, (v.y + 1) / 2);
    group.rotation.y = base.ry + mouse.x * 0.2;
    group.rotation.x = base.rx + mouse.y * 0.06;
    renderer.render(scene, camera);
  }

  let time = 0;
  function step(dt: number) {
    time += dt;
    climb.advance(dt);
    if (mouse.tk === 0) {
      mouse.tx = Math.sin(time * 0.35) * 0.35;
      mouse.ty = Math.sin(time * 0.23) * 0.15;
    }
    const k = 1 - Math.exp(-dt * 3.2);
    mouse.x += (mouse.tx - mouse.x) * k;
    mouse.y += (mouse.ty - mouse.y) * k;
    mouse.knot += (mouse.tk - mouse.knot) * (1 - Math.exp(-dt * 2.5));
    const um = bgMat.uniforms.uMouse.value;
    um.x += (mouse.ux - um.x) * (1 - Math.exp(-dt * 4));
    um.y += (mouse.uy - um.y) * (1 - Math.exp(-dt * 4));
    bgMat.uniforms.uKnot.value = mouse.knot;
    bgMat.uniforms.uTime.value = time;
    // as the hero leaves the screen the steps drift up and away
    const r = hero.getBoundingClientRect();
    const out = clamp(-r.top / Math.max(1, r.height));
    camera.position.y = 2.4 - out * 2.2;
    camera.lookAt(0, -out * 1.2, 0);
    draw();
  }

  let frame = 0;
  let last = 0;
  let onScreen = false;
  let started = false;
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    frame = requestAnimationFrame(tick);
  };
  const run = () => {
    if (still || frame || !onScreen || document.hidden) return;
    if (!started) {
      started = true;
      void climb.play(() => (stacked ? 0 : -12));
    }
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const halt = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen) run();
    else halt();
  });
  io.observe(hero);
  const onVis = () => (document.hidden ? halt() : run());
  document.addEventListener('visibilitychange', onVis);
  if (still) draw();

  return () => {
    halt();
    climb.stop();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    hero.removeEventListener('pointermove', onMove);
    hero.removeEventListener('pointerleave', onLeave);
    planks.forEach((p) => {
      p.g.dispose();
      p.m.dispose();
    });
    ballGeo.dispose();
    ballMat.dispose();
    plane.dispose();
    shMat.dispose();
    floorMat.dispose();
    shTex.dispose();
    bgMat.dispose();
    bg.geometry.dispose();
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
  };
}
