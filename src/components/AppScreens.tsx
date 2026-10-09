'use client';
import Image from 'next/image';
import { useCallback, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import Lightbox from '@/components/project/Lightbox';

/* CabinetOS page: the app's pages (Build, Cutlist, 2D, 3D, Optimise) from one demo job, as screenshots taken
   on a computer, a tablet and a phone. Tabs pick the page. On a big screen all three sizes stand side by side,
   the same height; below that one size shows at a time (the visitor's own to start with) with a switch for the
   others. Any screen opens full size. Only the pages seen so far (and the next) are on the page; hidden sizes
   never load. Nothing moves by itself. */

export type AppScreen = {
  label: string;
  caption?: string;
  alt?: string;
  computer?: string;
  tablet?: string;
  phone?: string;
};

type Device = 'computer' | 'tablet' | 'phone';

/* Every screenshot of one size is taken at the same size, so the frame keeps its height when the page changes. */
const DEVICES: { key: Device; name: string; w: number; h: number; row: string; one: string; icon: ReactNode }[] = [
  {
    key: 'computer',
    name: 'Computer',
    w: 2400,
    h: 1500,
    row: '(min-width: 1280px) 640px, 50vw',
    one: '(min-width: 1024px) 50vw, 100vw',
    icon: <path d="M3 4.5h14v9H3zM7 16.5h6M10 13.5v3" />,
  },
  {
    key: 'tablet',
    name: 'Tablet',
    w: 1230,
    h: 1770,
    row: '(min-width: 1280px) 280px, 22vw',
    one: '(min-width: 640px) 560px, 100vw',
    icon: <path d="M5 2.5h10v15H5zM9 15h2" />,
  },
  {
    key: 'phone',
    name: 'Phone',
    w: 780,
    h: 1688,
    row: '(min-width: 1280px) 190px, 15vw',
    one: '300px',
    icon: <path d="M6.5 2.5h7v15h-7zM9.25 15h1.5" />,
  },
];

const ONE_WIDTH: Record<Device, string> = { computer: 'w-full', tablet: 'max-w-[560px]', phone: 'max-w-[300px]' };

const WIDE = '(min-width: 640px)';
function subscribeWide(onChange: () => void) {
  const m = window.matchMedia(WIDE);
  m.addEventListener('change', onChange);
  return () => m.removeEventListener('change', onChange);
}
const isWide = () => window.matchMedia(WIDE).matches;

function DeviceIcon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function AppScreens({ screens, title = 'CabinetOS' }: { screens: AppScreen[]; title?: string }) {
  const [page, setPage] = useState(0);
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(() => new Set([0, 1]));
  /* The size someone picked; until then the phone size on a phone and the tablet size on anything wider.
     null while the page is first drawn on the server, when the CSS makes the same choice by screen width. */
  const [picked, setDevice] = useState<Device | null>(null);
  const wide = useSyncExternalStore(subscribeWide, isWide, () => null);
  const device: Device | null = picked ?? (wide === null ? null : wide ? 'tablet' : 'phone');
  const [zoom, setZoom] = useState<{ device: Device; index: number } | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const show = useCallback(
    (i: number) => {
      const n = screens.length;
      const next = (i + n) % n;
      setPage(next);
      setLoaded((prev) => (prev.has(next) && prev.has((next + 1) % n) ? prev : new Set([...prev, next, (next + 1) % n])));
    },
    [screens.length],
  );

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = screens.length;
    const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (to === null) return;
    e.preventDefault();
    show(to);
    tabRefs.current[to]?.focus();
  };

  const altFor = (s: AppScreen, d: (typeof DEVICES)[number]) => `CabinetOS on a ${d.name.toLowerCase()}, ${s.label} page${s.alt ? `: ${s.alt}` : ''}`;

  /* One size's frame: the pages loaded so far stacked up, the current one faded in. */
  const frame = (d: (typeof DEVICES)[number], sizes: string) => (
    <button
      type="button"
      onClick={() => setZoom({ device: d.key, index: page })}
      className="mount group block w-full cursor-zoom-in text-left hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <span className="relative block overflow-hidden bg-raised" style={{ aspectRatio: `${d.w} / ${d.h}` }}>
        {screens.map((s, i) => {
          const src = s[d.key];
          if (!src || !loaded.has(i)) return null;
          const on = i === page;
          return (
            <Image
              key={src}
              src={src}
              alt={on ? altFor(s, d) : ''}
              aria-hidden={on ? undefined : true}
              fill
              sizes={sizes}
              className={`object-cover object-top transition-opacity duration-300 ease-out motion-reduce:transition-none ${on ? 'opacity-100' : 'opacity-0'}`}
            />
          );
        })}
      </span>
      <span className="sr-only"> (open full size)</span>
    </button>
  );

  const zoomDevice = zoom ? DEVICES.find((d) => d.key === zoom.device)! : null;
  const zoomPhotos = zoomDevice
    ? screens.filter((s) => s[zoomDevice.key]).map((s) => ({ src: s[zoomDevice.key]!, w: zoomDevice.w, h: zoomDevice.h, alt: altFor(s, zoomDevice) }))
    : [];
  const current = screens[page];

  return (
    <div className="mt-9 md:mt-11">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="App pages" className="flex border border-line-strong sm:inline-grid sm:auto-cols-fr sm:grid-flow-col">
          {screens.map((s, i) => (
            <button
              key={s.label}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`app-tab-${i}`}
              aria-selected={i === page}
              aria-controls="app-panel"
              tabIndex={i === page ? 0 : -1}
              onClick={() => show(i)}
              onKeyDown={(e) => onTabKey(e, i)}
              className="h-11 flex-auto border-l border-line-strong px-2 text-[14.5px] font-semibold text-ink transition-colors first:border-l-0 hover:bg-raised aria-selected:bg-accent aria-selected:text-on-accent sm:px-5"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center lg:hidden" role="group" aria-label="Screen size">
          {DEVICES.map((d) => (
            <button
              key={d.key}
              type="button"
              aria-pressed={device === d.key}
              onClick={() => setDevice(d.key)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-line px-2 text-[14px] font-medium text-muted transition-colors hover:border-ink hover:text-ink aria-pressed:border-ink aria-pressed:text-ink sm:px-3"
            >
              <DeviceIcon className="max-[379px]:hidden">{d.icon}</DeviceIcon>
              {d.name}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id="app-panel" aria-labelledby={`app-tab-${page}`}>
        {current?.caption ? <p className="mt-5 max-w-[62ch] text-pretty text-muted md:text-[17px]">{current.caption}</p> : null}

        {/* Big screens: all three sizes in a row, the same height (each grows by its width-to-height ratio). */}
        <div className="mt-7 hidden items-start gap-6 lg:flex">
          {DEVICES.map((d) => (
            <figure key={d.key} className="m-0 min-w-0" style={{ flex: `${d.w / d.h} 1 22px` }}>
              {frame(d, d.row)}
              <figcaption className="mt-3 flex items-center gap-2 font-mono text-[13px] text-faint">
                <DeviceIcon>{d.icon}</DeviceIcon>
                {d.name}
              </figcaption>
            </figure>
          ))}
        </div>

        {/* Phones and tablets: one size at a time. */}
        <div className="mt-6 lg:hidden">
          {DEVICES.map((d) => {
            const shown =
              device === null
                ? d.key === 'phone'
                  ? 'block sm:hidden'
                  : d.key === 'tablet'
                    ? 'hidden sm:block'
                    : 'hidden'
                : device === d.key
                  ? 'block'
                  : 'hidden';
            return (
              <div key={d.key} className={`mx-auto ${ONE_WIDTH[d.key]} ${shown}`}>
                {frame(d, d.one)}
              </div>
            );
          })}
        </div>

        <p className="mt-4 font-mono text-[13px] text-faint">Tap or click any screen to see it full size.</p>
      </div>

      {zoom && zoomDevice ? (
        <Lightbox
          photos={zoomPhotos}
          index={zoom.index}
          title={`${title} on a ${zoomDevice.name.toLowerCase()}`}
          onIndex={(i) => {
            setZoom({ device: zoom.device, index: i });
            show(i);
          }}
          onClose={() => setZoom(null)}
        />
      ) : null}
    </div>
  );
}
