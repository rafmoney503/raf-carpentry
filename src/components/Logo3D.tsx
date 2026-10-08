'use client';
import { useEffect, useRef } from 'react';
import { R_MARK } from '@/lib/r-logo';
import type { Logo3DScene } from '@/lib/logo3d-scene';
import './logo3d.css';

/* Raf's R, sketched in pencil on graph paper, then made in 18 mm birch ply and turned in 3D.
   The pencil part is plain SVG and starts as soon as the box is properly on screen; three.js
   (about 150 KB) only loads when the box is close, in its own file (src/lib/logo3d-scene.ts).
   Drag to turn it; left alone it settles back into a slow swing. Nothing runs while it is off screen.
   Same look and timing as the 3D logo page made for Raf (October 2026). */

const MW = R_MARK.w, MH = R_MARK.h;
const COMPASS = { cx: 400, cy: 420, r: 415 }; // the top arc of the R, as a compass would draw it
const arcPt = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(COMPASS.cx + COMPASS.r * Math.cos(a)).toFixed(1)} ${(COMPASS.cy + COMPASS.r * Math.sin(a)).toFixed(1)}`;
};
const ARC_D = `M${arcPt(-168)} A${COMPASS.r} ${COMPASS.r} 0 0 1 ${arcPt(-12)}`;
const CROSS_D = `M${COMPASS.cx - 26} ${COMPASS.cy}H${COMPASS.cx + 26}M${COMPASS.cx} ${COMPASS.cy - 26}V${COMPASS.cy + 26}`;
const BASE = { x1: -170, x2: MW + 170, y: MH };
const CENTRE = { x: MW / 2, y1: -150, y2: MH + 150 };

const HOLD = 1.95; // the pencil drawing is finished here; waits here if the 3D is still loading
const SETTLE = 3.9; // the R has finished turning; the swing carries on from the same pose
const YAW0 = -0.55, PITCH0 = 0.12;
const TAU = Math.PI * 2;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out3 = (t: number) => 1 - Math.pow(1 - t, 3);
const swing = (s: number) => ({ yaw: YAW0 * Math.cos((TAU * s) / 10), pitch: PITCH0 - 0.05 * (1 - Math.cos((TAU * s) / 7)) });

function pose(t: number) {
  const ex = inOut(seg(t, 2.45, SETTLE));
  return {
    base: out3(seg(t, 0, 0.5)), centre: out3(seg(t, 0.12, 0.62)), arc: inOut(seg(t, 0.22, 0.95)), cross: seg(t, 0.2, 0.3),
    stem: inOut(seg(t, 0.45, 1.25)), bowl: inOut(seg(t, 1.05, 2.15)),
    pencil: 1 - seg(t, 2.55, 3.25), construct: 1 - seg(t, 2.9, 3.7),
    solid: out3(seg(t, 2.0, 2.6)), depth: 0.02 + 0.98 * ex, yaw: YAW0 * ex, pitch: PITCH0 * ex,
  };
}

export default function Logo3D({ caption = 'My R, drawn in pencil, then made in 18 mm birch ply. Drag to turn it.' }: { caption?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const stage = stageRef.current, canvas = canvasRef.current, svg = svgRef.current;
    if (!stage || !canvas || !svg) return;
    const q = <T extends Element>(sel: string) => svg.querySelector(sel) as T;
    const el = {
      base: q<SVGLineElement>('[data-l="base"]'), centre: q<SVGLineElement>('[data-l="centre"]'),
      arc: q<SVGPathElement>('[data-l="arc"]'), cross: q<SVGPathElement>('[data-l="cross"]'),
      stem: q<SVGPathElement>('[data-l="stem"]'), bowl: q<SVGPathElement>('[data-l="bowl"]'),
      construct: q<SVGGElement>('[data-l="construct"]'), pencil: q<SVGGElement>('[data-l="pencil"]'),
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let scene: Logo3DScene | null = null;
    let failed = false, disposed = false, loading = false;
    let visible = false, playing = false, raf = 0, last = 0;
    let clock = 0; // intro time in seconds; only moves while on screen
    let idle = false, swingT = 0;
    const st = { yaw: YAW0, pitch: PITCH0, vy: 0, vp: 0, dragging: false, sinceTouch: 99, px: 0, py: 0 };

    function layout() {
      const W = stage!.clientWidth, H = stage!.clientHeight;
      if (!W || !H) return;
      const hpx = Math.min(H * 0.74, W * 0.74 * (MH / MW));
      const cy = H * 0.47, a = hpx / MH;
      Object.assign(svg!.style, { left: `${W / 2 - (MW / 2) * a}px`, top: `${cy - (MH / 2) * a}px`, width: `${MW * a}px`, height: `${MH * a}px`, visibility: 'visible' });
      scene?.resize(W, H, hpx, cy);
    }

    function apply(p: ReturnType<typeof pose>) {
      el.base.setAttribute('x2', String(BASE.x1 + (BASE.x2 - BASE.x1) * p.base));
      el.base.style.opacity = p.base > 0 ? '1' : '0'; // a line of no length would still show as a dot
      el.centre.style.opacity = p.centre > 0 ? '1' : '0';
      el.centre.setAttribute('y2', String(CENTRE.y1 + (CENTRE.y2 - CENTRE.y1) * p.centre));
      el.arc.style.strokeDashoffset = String(1 - p.arc);
      el.cross.style.opacity = String(p.cross);
      el.stem.style.strokeDashoffset = String(1 - p.stem);
      el.bowl.style.strokeDashoffset = String(1 - p.bowl);
      const show3D = !!scene;
      el.pencil.style.opacity = String(show3D ? p.pencil : 1);
      el.construct.style.opacity = String(show3D ? p.construct : 1);
      canvas!.style.opacity = String(show3D ? p.solid : 0);
      svg!.style.visibility = show3D && p.pencil === 0 && p.construct === 0 ? 'hidden' : 'visible';
      scene?.pose(p.depth, p.yaw, p.pitch);
    }

    function tick(now: number) {
      raf = 0;
      if (disposed || !visible) return;
      const dt = clamp((now - last) / 1000, 0, 0.1); // real time down to 10 frames a second
      last = now;
      if (playing && !idle) {
        if (reduced) clock = scene ? SETTLE : HOLD;
        else clock = clock + dt > HOLD && !scene ? HOLD : clock + dt;
        if (clock >= SETTLE) { idle = true; swingT = 0; st.yaw = YAW0; st.pitch = PITCH0; }
        apply(pose(Math.min(clock, SETTLE)));
      }
      if (idle && scene) {
        st.sinceTouch += dt;
        if (!st.dragging) {
          if (st.sinceTouch < 2.2) {
            const f = Math.pow(0.9, dt * 60);
            st.yaw += st.vy * dt * 60; st.pitch = clamp(st.pitch + st.vp * dt * 60, -0.45, 0.6);
            st.vy *= f; st.vp *= f;
            // carry on the swing from where it was left, so it eases back without a jump
            swingT = (Math.acos(clamp(Math.atan2(Math.sin(st.yaw), Math.cos(st.yaw)) / YAW0, -1, 1)) / TAU) * 10;
          } else if (!reduced) {
            swingT += dt;
            const s = swing(swingT), k = 1 - Math.pow(0.95, dt * 60);
            st.yaw += (s.yaw - st.yaw) * k; st.pitch += (s.pitch - st.pitch) * k;
          }
        }
        scene.pose(1, st.yaw, st.pitch);
      }
      scene?.render();
      const settling = !reduced || st.dragging || st.sinceTouch < 2.2;
      const busy = (playing && !idle && !(failed && clock >= HOLD)) || (idle && !!scene && settling);
      if (busy) raf = requestAnimationFrame(tick);
    }
    const wake = () => { if (!raf && visible && !disposed) { last = performance.now(); raf = requestAnimationFrame(tick); } };

    function load() {
      if (loading) return;
      loading = true;
      import('@/lib/logo3d-scene').then(({ createLogo3D }) => {
        if (disposed) return;
        scene = createLogo3D(canvas!);
        if (!scene) { failed = true; return; }
        layout();
        apply(pose(Math.min(clock, SETTLE)));
        scene.render(); // compiles the shaders now, while the canvas is still see-through
        wake();
      }).catch(() => { failed = true; });
    }

    // load three.js a little before the box arrives; start drawing once a good part of it is on screen
    const near = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { load(); near.disconnect(); } }, { rootMargin: '400px 0px' });
    const seen = new IntersectionObserver((es) => {
      for (const e of es) {
        visible = e.isIntersecting;
        if (e.intersectionRatio >= 0.35) playing = true;
      }
      if (visible) wake();
    }, { threshold: [0, 0.35] });
    near.observe(stage);
    seen.observe(stage);
    const ro = new ResizeObserver(() => { layout(); if (scene && !raf) scene.render(); });
    ro.observe(stage);
    layout();

    const down = (e: PointerEvent) => {
      if (!scene) return;
      if (!idle) { playing = true; clock = SETTLE; idle = true; swingT = 0; apply(pose(SETTLE)); st.yaw = YAW0; st.pitch = PITCH0; }
      st.dragging = true; st.px = e.clientX; st.py = e.clientY; st.vy = st.vp = 0;
      canvas.setPointerCapture(e.pointerId);
      wake();
    };
    const move = (e: PointerEvent) => {
      if (!st.dragging) return;
      const dx = e.clientX - st.px, dy = e.clientY - st.py;
      st.px = e.clientX; st.py = e.clientY;
      st.vy = dx * 0.009; st.vp = e.pointerType === 'mouse' ? dy * 0.005 : 0;
      st.yaw += st.vy; st.pitch = clamp(st.pitch + st.vp, -0.45, 0.6);
    };
    const up = () => {
      if (!st.dragging) return;
      st.dragging = false; st.sinceTouch = 0;
      st.yaw = Math.atan2(Math.sin(st.yaw), Math.cos(st.yaw));
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      near.disconnect(); seen.disconnect(); ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      scene?.dispose();
      scene = null;
    };
  }, []);

  return (
    <figure className="logo3d">
      <div className="mount">
        <div ref={stageRef} className="logo3d-stage" role="img" aria-label="Raf Carpentry's R logo as a birch ply cut-out">
          <canvas ref={canvasRef} className="logo3d-gl" aria-hidden="true" />
          <svg ref={svgRef} className="logo3d-draw" viewBox={`0 0 ${MW} ${MH}`} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <g data-l="construct" className="logo3d-construct" strokeWidth={3.5}>
              <line data-l="base" x1={BASE.x1} y1={BASE.y} x2={BASE.x1} y2={BASE.y} style={{ opacity: 0 }} />
              <line data-l="centre" x1={CENTRE.x} y1={CENTRE.y1} x2={CENTRE.x} y2={CENTRE.y1} strokeDasharray="60 16 10 16" style={{ opacity: 0 }} />
              <path data-l="arc" d={ARC_D} pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 1 }} />
              <path data-l="cross" d={CROSS_D} style={{ opacity: 0 }} />
            </g>
            <g data-l="pencil" className="logo3d-pencil" strokeWidth={7}>
              <path data-l="stem" d={R_MARK.stem} pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 1 }} />
              <path data-l="bowl" d={R_MARK.bowl} pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 1 }} />
            </g>
          </svg>
        </div>
      </div>
      <figcaption className="mt-3 font-mono text-[13px] text-faint">{caption}</figcaption>
    </figure>
  );
}
