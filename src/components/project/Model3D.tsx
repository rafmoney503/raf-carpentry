'use client';
import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Photo } from '@/lib/projects';
import type { Model3DScene } from '@/lib/model3d-scene';

/* The job's SketchUp model in 3D, on its job page (plan.model3d or model3d in the job's JSON) and in the
   SketchUp page gallery. A still of the model shows straight away; three.js and the model (about 200 KB
   together) only load when the box is close, then the 3D fades in over the still.
   - Drag to turn it (sideways on a phone, so the page still scrolls; any way in full screen).
   - Zoom: the + and - buttons, two fingers on a phone (pinch, and move them to slide the view), a trackpad
     pinch or Ctrl + scroll on a computer (plain scroll too in full screen). Shift-drag or right-drag slides.
   - Tap a part: it lights up blue and its name shows (the part names from the SketchUp model).
   - Open it (lids, doors, drawers: whatever moves in that model; the button words come from the model),
     take it apart (every piece pulled out from the middle, like an exploded drawing), show the sizes
     (only models drawn to real sizes have them), full screen.
   The opening view and how far it turns also come from the model. 'tall' gives tall pieces (wardrobes) a
   squarer frame. It swings slowly until someone touches it, and nothing runs while it is off screen. */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const FRAME = {
  wide: 'aspect-[4/3] sm:aspect-[16/9] lg:aspect-[2/1]',
  tall: 'aspect-[1/1] sm:aspect-[4/3]',
  gallery: 'aspect-[4/3] lg:aspect-[16/10]', // the SketchUp page: one shape for every job, so switching doesn't jump
};

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 place-items-center rounded-[2px] border border-line-strong bg-mount/95 text-ink shadow-sm transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
    >
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

export default function Model3D({ src, poster, label, shape = 'wide' }: { src: string; poster: Photo; label: string; shape?: keyof typeof FRAME }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const pickRef = useRef<HTMLSpanElement>(null);
  const ctl = useRef({
    lids: 0, apart: 0, dims: false, full: false,
    poke: () => {}, zoom: (_f: number) => {}, reset: () => {},
  });
  const [ready, setReady] = useState(false);
  const [actions, setActions] = useState<{ open: string; close: string } | null>(null);
  const [canApart, setCanApart] = useState(false);
  const [dimLabels, setDimLabels] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isApart, setIsApart] = useState(false);
  const [dimsOn, setDimsOn] = useState(false);
  const [full, setFull] = useState(false);
  const [moved, setMoved] = useState(false); // turned or zoomed by hand: offer "back to the start"
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const stage = stageRef.current, canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let scene: Model3DScene | null = null;
    let disposed = false, loading = false, visible = false, raf = 0, last = 0;
    let openT = 0, apartT = 0, easing = false, touched = false, swingT = 0;
    let lim = { yaw: -0.22, pitch: 0.52, yawMin: -1.3, yawMax: 0.9, pitchMin: 0.08, pitchMax: 1.25 }, secs = 1.3;
    const st = { yaw: lim.yaw, pitch: lim.pitch, vy: 0, vp: 0, dragging: false, px: 0, py: 0 };

    function layout() {
      const W = stage!.clientWidth, H = stage!.clientHeight;
      if (W && H) scene?.resize(W, H);
    }

    function placeLabels() {
      const box = labelsRef.current;
      if (!scene) return;
      if (box) {
        scene.dimPositions().forEach((p, i) => {
          const el = box.children[i] as HTMLElement | undefined;
          if (!el) return;
          el.style.visibility = p ? 'visible' : 'hidden';
          if (p) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        });
      }
      const tag = pickRef.current, p = scene.pickPosition();
      if (tag) {
        tag.style.visibility = p ? 'visible' : 'hidden';
        if (p) tag.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, calc(-100% - 12px))`;
      }
    }

    function tick(now: number) {
      raf = 0;
      if (disposed || !visible || !scene) return;
      const dt = clamp((now - last) / 1000, 0, 0.1);
      last = now;
      if (!touched && !reduced) {
        swingT += dt;
        st.yaw = lim.yaw + 0.32 * Math.sin((swingT * Math.PI * 2) / 16);
      } else if (!st.dragging) {
        const f = Math.pow(0.9, dt * 60);
        st.yaw = clamp(st.yaw + st.vy * dt * 60, lim.yawMin, lim.yawMax);
        st.pitch = clamp(st.pitch + st.vp * dt * 60, lim.pitchMin, lim.pitchMax);
        st.vy *= f; st.vp *= f;
      }
      const c = ctl.current;
      const step = reduced ? 1 : dt / secs;
      openT = c.lids > openT ? Math.min(c.lids, openT + step) : Math.max(c.lids, openT - step);
      const astep = reduced ? 1 : dt / 1.1;
      apartT = c.apart > apartT ? Math.min(c.apart, apartT + astep) : Math.max(c.apart, apartT - astep);
      scene.setOpen(openT);
      scene.setApart(apartT);
      scene.setDims(c.dims && apartT === 0); // the sizes are for the job put together
      scene.view(st.yaw, st.pitch);
      easing = scene.render();
      placeLabels();
      const moving = (!touched && !reduced) || st.dragging || Math.abs(st.vy) + Math.abs(st.vp) > 1e-4 || openT !== c.lids || apartT !== c.apart || easing;
      if (moving) raf = requestAnimationFrame(tick);
    }
    const wake = () => { if (!raf && visible && !disposed && scene) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    const handled = () => { touched = true; setMoved(true); };
    ctl.current.poke = wake;
    ctl.current.zoom = (f) => {
      if (!scene) return;
      handled();
      scene.zoom(f);
      wake();
    };
    ctl.current.reset = () => {
      if (!scene) return;
      scene.resetZoom();
      st.yaw = lim.yaw; st.pitch = lim.pitch; st.vy = st.vp = 0;
      setMoved(false);
      wake();
    };

    function load() {
      if (loading) return;
      loading = true;
      import('@/lib/model3d-scene')
        .then(({ createModel3D }) => createModel3D(canvas!, src))
        .then((s) => {
          if (disposed) { s?.dispose(); return; }
          if (!s) return; // no WebGL: the still stays
          scene = s;
          lim = s.limits; secs = s.secs;
          st.yaw = lim.yaw; st.pitch = lim.pitch;
          setActions(s.hasMoves ? s.actions : null);
          setCanApart(s.canApart);
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

    // ---- pointers: one drags to turn (or slides with Shift / the right button), two pinch to zoom and slide,
    // a short tap with no movement picks a part
    const pts = new Map<number, { x: number; y: number }>();
    let tap: { x: number; y: number; t: number; moved: boolean } | null = null;
    let pinch: { d: number; mx: number; my: number } | null = null;
    let sliding = false;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pair = () => {
      const [a, b] = [...pts.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };

    const down = (e: PointerEvent) => {
      if (!scene) return;
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      touched = true;
      const p = local(e);
      pts.set(e.pointerId, p);
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      if (pts.size === 1) {
        st.dragging = true; st.px = p.x; st.py = p.y; st.vy = st.vp = 0;
        sliding = e.button === 2 || e.shiftKey;
        tap = { x: p.x, y: p.y, t: e.timeStamp, moved: false };
      } else if (pts.size === 2) {
        pinch = pair();
        st.dragging = false; st.vy = st.vp = 0;
        tap = null;
      }
      wake();
    };
    const move = (e: PointerEvent) => {
      if (!scene || !pts.has(e.pointerId)) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pinch && pts.size >= 2) {
        const now = pair();
        if (now.d > 8 && pinch.d > 8) scene.zoom(pinch.d / now.d, { x: now.mx, y: now.my });
        scene.pan(now.mx - pinch.mx, now.my - pinch.my);
        pinch = now;
        handled();
        wake();
        return;
      }
      if (!st.dragging) return;
      const dx = p.x - st.px, dy = p.y - st.py;
      st.px = p.x; st.py = p.y;
      if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 6) tap.moved = true;
      if (!tap || tap.moved) handled();
      if (sliding) { scene.pan(dx, dy); wake(); return; }
      st.vy = -dx * 0.008;
      st.vp = e.pointerType === 'mouse' || ctl.current.full ? dy * 0.006 : 0;
      st.yaw = clamp(st.yaw + st.vy, lim.yawMin, lim.yawMax);
      st.pitch = clamp(st.pitch + st.vp, lim.pitchMin, lim.pitchMax);
    };
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pinch) {
        if (pts.size < 2) pinch = null;
        if (pts.size === 1) {
          const [r] = [...pts.values()];
          st.px = r.x; st.py = r.y; st.dragging = true; sliding = false;
        }
      }
      if (pts.size === 0) {
        const t = tap;
        st.dragging = false; sliding = false; tap = null;
        if (scene && t && !t.moved && e.type === 'pointerup' && e.timeStamp - t.t < 600) setPicked(scene.pick(t.x, t.y));
      }
      wake();
    };
    const wheel = (e: WheelEvent) => {
      // trackpad pinch and Ctrl + scroll zoom; plain scrolling only zooms in full screen, so the page still scrolls
      if (!scene || !(ctl.current.full || e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      scene.zoom(Math.exp(clamp(dy, -120, 120) * (e.ctrlKey ? 0.01 : 0.0018)), local(e));
      handled();
      wake();
    };
    const noMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('contextmenu', noMenu);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      near.disconnect(); seen.disconnect(); ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('contextmenu', noMenu);
      scene?.dispose();
      scene = null;
    };
  }, [src]);

  // full screen: the viewer covers the page (and the screen too where the browser allows it); Esc closes it
  useEffect(() => {
    if (!full) return;
    const html = document.documentElement, prev = html.style.overflow;
    html.style.overflow = 'hidden';
    ctl.current.full = true;
    ctl.current.poke();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    const onFs = () => { if (!document.fullscreenElement) setFull(false); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      html.style.overflow = prev;
      ctl.current.full = false;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [full]);

  const toggleFull = () => {
    if (!full) wrapRef.current?.requestFullscreen?.().catch(() => {});
    setFull(!full);
  };
  const toggleOpen = () => { const v = !isOpen; setIsOpen(v); ctl.current.lids = v ? 1 : 0; ctl.current.poke(); };
  const toggleApart = () => { const v = !isApart; setIsApart(v); ctl.current.apart = v ? 1 : 0; ctl.current.poke(); };
  const toggleDims = () => { const v = !dimsOn; setDimsOn(v); ctl.current.dims = v; ctl.current.poke(); };
  const hint = !ready ? 'Loading the 3D model' : picked ? 'Tap an empty spot to clear' : full ? 'Drag to turn it. Pinch or scroll to zoom. Tap a part to see what it is.' : 'Drag to turn it. Tap a part to see what it is.';

  return (
    <div ref={wrapRef} className={full ? 'fixed inset-0 z-[100] flex flex-col bg-paper p-3 sm:p-5' : ''}>
      <div className={full ? 'mount flex min-h-0 flex-1 flex-col' : 'mount'}>
        <div ref={stageRef} className={`relative overflow-hidden bg-white ${full ? 'min-h-0 flex-1' : FRAME[shape]}`} role="img" aria-label={label}>
          <Image src={poster.src} alt="" fill sizes="(max-width: 768px) 100vw, 1200px" className={`object-contain transition-opacity duration-500 ${ready ? 'opacity-0' : 'opacity-100'}`} />
          <canvas ref={canvasRef} aria-hidden="true" className={`absolute inset-0 block h-full w-full cursor-grab transition-opacity duration-500 active:cursor-grabbing ${full ? 'touch-none' : 'touch-pan-y'} ${ready ? 'opacity-100' : 'opacity-0'}`} />
          <div ref={labelsRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 ${dimsOn && !isApart ? '' : 'hidden'}`}>
            {dimLabels.map((t, i) => (
              <span key={i} className="absolute left-0 top-0 whitespace-nowrap rounded-sm bg-white/90 px-1.5 py-0.5 font-mono text-[12px] leading-none text-accent" style={{ visibility: 'hidden' }}>{t}</span>
            ))}
          </div>
          <span
            ref={pickRef}
            aria-live="polite"
            className={`pointer-events-none absolute left-0 top-0 max-w-[70%] rounded-[2px] bg-ink px-2.5 py-1.5 text-[13.5px] font-[560] leading-tight text-paper shadow-md ${picked ? '' : 'hidden'}`}
            style={{ visibility: 'hidden' }}
          >
            {picked}
          </span>
          {ready ? (
            <div className="m3d-tools absolute right-2 top-2 flex flex-col gap-1.5">
              <IconButton label="Zoom in" onClick={() => ctl.current.zoom(0.72)}><path d="M10 4.5v11M4.5 10h11" /></IconButton>
              <IconButton label="Zoom out" onClick={() => ctl.current.zoom(1 / 0.72)}><path d="M4.5 10h11" /></IconButton>
              {moved ? (
                <IconButton label="Back to the start view" onClick={() => ctl.current.reset()}><path d="M4.5 9.5a5.5 5.5 0 1 0 1.7-4" /><path d="M4.2 3.2v3.3h3.3" /></IconButton>
              ) : null}
              <IconButton label={full ? 'Close full screen' : 'Full screen'} onClick={toggleFull}>
                {full ? <path d="M8 3.5V8H3.5M12 3.5V8h4.5M8 16.5V12H3.5M12 16.5V12h4.5" /> : <path d="M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4" />}
              </IconButton>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {actions ? (
          <button type="button" onClick={toggleOpen} aria-pressed={isOpen} className="btn btn-ghost btn-sm">{isOpen ? actions.close : actions.open}</button>
        ) : null}
        {canApart ? (
          <button type="button" onClick={toggleApart} aria-pressed={isApart} className="btn btn-ghost btn-sm">{isApart ? 'Put it back together' : 'Take it apart'}</button>
        ) : null}
        {dimLabels.length ? (
          <button type="button" onClick={toggleDims} aria-pressed={dimsOn} disabled={isApart} className="btn btn-ghost btn-sm disabled:opacity-45">{dimsOn ? 'Hide the sizes' : 'Show the sizes'}</button>
        ) : null}
        <p className="font-mono text-[13px] text-faint">{hint}</p>
      </div>
    </div>
  );
}
