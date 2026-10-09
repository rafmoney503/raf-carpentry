'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { Photo } from '@/lib/projects';
import type { Model3DScene } from '@/lib/model3d-scene';

/* The job's SketchUp model in 3D, on its job page (plan.model3d in the job's JSON).
   A still of the model shows straight away; three.js and the model (about 200 KB together)
   only load when the box is close, then the 3D fades in over the still.
   Drag to turn it (sideways on a phone, so the page still scrolls), lift the lids, show the sizes.
   It swings slowly until someone touches it, and nothing runs while it is off screen. */

const YAW0 = -0.22, PITCH0 = 0.52;
const YAW_MIN = -1.3, YAW_MAX = 0.9, PITCH_MIN = 0.08, PITCH_MAX = 1.25;
const LID_SECS = 1.3;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function Model3D({ src, poster, label }: { src: string; poster: Photo; label: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const ctl = useRef({ lids: 0, dims: false, poke: () => {} });
  const [ready, setReady] = useState(false);
  const [hasLids, setHasLids] = useState(false);
  const [dimLabels, setDimLabels] = useState<string[]>([]);
  const [lidsUp, setLidsUp] = useState(false);
  const [dimsOn, setDimsOn] = useState(false);

  useEffect(() => {
    const stage = stageRef.current, canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let scene: Model3DScene | null = null;
    let disposed = false, loading = false, visible = false, raf = 0, last = 0;
    let lidT = 0, easing = false, touched = false, swingT = 0;
    const st = { yaw: YAW0, pitch: PITCH0, vy: 0, vp: 0, dragging: false, px: 0, py: 0 };

    function layout() {
      const W = stage!.clientWidth, H = stage!.clientHeight;
      if (W && H) scene?.resize(W, H);
    }

    function placeLabels() {
      const box = labelsRef.current;
      if (!box || !scene) return;
      const pos = scene.dimPositions();
      pos.forEach((p, i) => {
        const el = box.children[i] as HTMLElement | undefined;
        if (!el) return;
        el.style.visibility = p ? 'visible' : 'hidden';
        if (p) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      });
    }

    function tick(now: number) {
      raf = 0;
      if (disposed || !visible || !scene) return;
      const dt = clamp((now - last) / 1000, 0, 0.1);
      last = now;
      if (!touched && !reduced) {
        swingT += dt;
        st.yaw = YAW0 + 0.32 * Math.sin((swingT * Math.PI * 2) / 16);
      } else if (!st.dragging) {
        const f = Math.pow(0.9, dt * 60);
        st.yaw = clamp(st.yaw + st.vy * dt * 60, YAW_MIN, YAW_MAX);
        st.pitch = clamp(st.pitch + st.vp * dt * 60, PITCH_MIN, PITCH_MAX);
        st.vy *= f; st.vp *= f;
      }
      const want = ctl.current.lids;
      const step = reduced ? 1 : dt / LID_SECS;
      lidT = want > lidT ? Math.min(want, lidT + step) : Math.max(want, lidT - step);
      scene.setLids(lidT);
      scene.setDims(ctl.current.dims);
      scene.view(st.yaw, st.pitch);
      easing = scene.render();
      placeLabels();
      const moving = (!touched && !reduced) || st.dragging || Math.abs(st.vy) + Math.abs(st.vp) > 1e-4 || lidT !== want || easing;
      if (moving) raf = requestAnimationFrame(tick);
    }
    const wake = () => { if (!raf && visible && !disposed && scene) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    ctl.current.poke = wake;

    function load() {
      if (loading) return;
      loading = true;
      import('@/lib/model3d-scene')
        .then(({ createModel3D }) => createModel3D(canvas!, src))
        .then((s) => {
          if (disposed) { s?.dispose(); return; }
          if (!s) return; // no WebGL: the still stays
          scene = s;
          setHasLids(s.hasLids);
          setDimLabels(s.dimLabels);
          layout();
          scene.view(st.yaw, st.pitch);
          scene.render();
          setReady(true);
          wake();
        })
        .catch(() => {});
    }

    const near = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { load(); near.disconnect(); } }, { rootMargin: '500px 0px' });
    const seen = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) wake(); });
    near.observe(stage);
    seen.observe(stage);
    const ro = new ResizeObserver(() => { layout(); wake(); });
    ro.observe(stage);

    const down = (e: PointerEvent) => {
      if (!scene) return;
      touched = true;
      st.dragging = true; st.px = e.clientX; st.py = e.clientY; st.vy = st.vp = 0;
      canvas.setPointerCapture(e.pointerId);
      wake();
    };
    const move = (e: PointerEvent) => {
      if (!st.dragging) return;
      const dx = e.clientX - st.px, dy = e.clientY - st.py;
      st.px = e.clientX; st.py = e.clientY;
      st.vy = -dx * 0.008; st.vp = e.pointerType === 'mouse' ? dy * 0.006 : 0;
      st.yaw = clamp(st.yaw + st.vy, YAW_MIN, YAW_MAX);
      st.pitch = clamp(st.pitch + st.vp, PITCH_MIN, PITCH_MAX);
    };
    const up = () => { if (st.dragging) { st.dragging = false; wake(); } };
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
  }, [src]);

  const toggleLids = () => { const v = !lidsUp; setLidsUp(v); ctl.current.lids = v ? 1 : 0; ctl.current.poke(); };
  const toggleDims = () => { const v = !dimsOn; setDimsOn(v); ctl.current.dims = v; ctl.current.poke(); };

  return (
    <div>
      <div className="mount">
        <div ref={stageRef} className="relative aspect-[4/3] overflow-hidden bg-white sm:aspect-[16/9] lg:aspect-[2/1]" role="img" aria-label={label}>
          <Image src={poster.src} alt="" fill sizes="(max-width: 768px) 100vw, 1200px" className={`object-contain transition-opacity duration-500 ${ready ? 'opacity-0' : 'opacity-100'}`} />
          <canvas ref={canvasRef} aria-hidden="true" className={`absolute inset-0 block h-full w-full cursor-grab touch-pan-y transition-opacity duration-500 active:cursor-grabbing ${ready ? 'opacity-100' : 'opacity-0'}`} />
          <div ref={labelsRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 ${dimsOn ? '' : 'hidden'}`}>
            {dimLabels.map((t, i) => (
              <span key={i} className="absolute left-0 top-0 whitespace-nowrap rounded-sm bg-white/90 px-1.5 py-0.5 font-mono text-[12px] leading-none text-accent" style={{ visibility: 'hidden' }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {hasLids ? (
          <button type="button" onClick={toggleLids} aria-pressed={lidsUp} className="btn btn-ghost btn-sm">{lidsUp ? 'Close the lids' : 'Lift the lids'}</button>
        ) : null}
        {dimLabels.length ? (
          <button type="button" onClick={toggleDims} aria-pressed={dimsOn} className="btn btn-ghost btn-sm">{dimsOn ? 'Hide the sizes' : 'Show the sizes'}</button>
        ) : null}
        <p className="font-mono text-[13px] text-faint">{ready ? 'Drag to turn it' : 'Loading the 3D model'}</p>
      </div>
    </div>
  );
}
