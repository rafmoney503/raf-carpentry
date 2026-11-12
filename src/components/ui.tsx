import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { Insight, SiteStats, Viz } from '@/lib/types';

/* The Rafal Solutions steps: three planks rising, the yellow ball on top. */
export function Mark({ size = 34, ink = '#121417', plank }: { size?: number; ink?: string; plank?: string }) {
  const p = plank ?? ink;
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <rect x="2" y="23" width="15" height="6" rx="1.5" fill={p} />
      <rect x="9" y="15.5" width="15" height="6" rx="1.5" fill={p} />
      <rect x="16" y="8" width="15" height="6" rx="1.5" fill={p} />
      <circle cx="26.5" cy="4.6" r="3.6" fill="#ffe45c" stroke={ink} strokeWidth="1.2" />
    </svg>
  );
}

export function appStyle(s: Pick<SiteStats, 'color' | 'light' | 'ink'>): CSSProperties {
  return { ['--a1' as string]: s.color, ['--a2' as string]: s.light, ['--a1i' as string]: s.ink } as CSSProperties;
}

const ICONS: Record<string, ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  apps: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  leads: <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  alerts: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  messages: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  open: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </>
  ),
};

export function Icon({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/* A line of values as an SVG path, w × h. */
export function sparkPaths(values: number[], w: number, h: number) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * step, h - 4 - (v / max) * (h - 10)]);
  const line = 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');
  const last = pts[pts.length - 1] ?? [0, h];
  return { line, area: `${line} L${w} ${h} L0 ${h} Z`, lastX: last[0], lastY: last[1] };
}

export function Spark({ values, label }: { values: number[]; label?: string }) {
  const { line, area, lastX, lastY } = sparkPaths(values.length ? values : [0, 0], 318, 48);
  return (
    <svg className="spark" viewBox="0 0 318 48" preserveAspectRatio="none" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={area} fill="color-mix(in srgb, var(--app) 14%, transparent)" />
      <path d={line} fill="none" stroke="var(--app)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="3.5" fill="var(--card)" stroke="var(--app)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function VizBlock({ viz }: { viz: Viz }) {
  if (viz.type === 'dots') {
    return (
      <div className="dots" aria-hidden="true" style={{ ['--app' as string]: viz.color } as CSSProperties}>
        {Array.from({ length: viz.n }, (_, i) => (
          <i key={i} />
        ))}
        <span>{viz.label}</span>
      </div>
    );
  }
  if (viz.type === 'bar') {
    const total = viz.parts.reduce((a, p) => a + p.n, 0) || 1;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="split-bar" role="img" aria-label={viz.parts.map((p) => p.label).join(', ')}>
          {viz.parts.map((p, i) => (
            <span key={i} style={{ flex: `${p.n / total} 1 0`, background: p.color, minWidth: p.n ? 4 : 0 }} />
          ))}
        </div>
        <div className="split-labels">
          {viz.parts.map((p, i) => (
            <span key={i}>{p.label}</span>
          ))}
        </div>
      </div>
    );
  }
  if (viz.type === 'bars') {
    const max = Math.max(1, ...viz.values);
    const bw = 318 / viz.values.length;
    return (
      <svg viewBox="0 0 318 64" style={{ width: '100%', height: 64, display: 'block' }} aria-hidden="true">
        {viz.values.map((v, i) => {
          const h = Math.max(3, (v / max) * 50);
          return <rect key={i} x={i * bw + 2} y={64 - h} width={bw - 4} height={h} rx="2" fill={i === viz.mark ? viz.color : 'var(--dim-bar)'} />;
        })}
        <text x={viz.mark * bw + bw / 2} y="11" textAnchor="middle" fontFamily="var(--display)" fontSize="11" fontWeight="700" fill={viz.color}>
          {viz.values[viz.mark]}
        </text>
      </svg>
    );
  }
  return (
    <div className="chips">
      {viz.items.map((x) => (
        <span key={x} className="chip dash">
          {x}
        </span>
      ))}
    </div>
  );
}

export function InsightCard({ i }: { i: Insight }) {
  const a = i.action;
  const linkClass = i.tone === 'setup' || i.tone === 'alert' ? 'act dark' : 'act';
  return (
    <article className={`card${i.tone === 'alert' ? ' alertcard' : ''}`}>
      <div className="ins-top">
        <span className={`mark ${i.tone}`} aria-hidden="true">
          {i.mark}
        </span>
        <span className="where">{i.where}</span>
        {i.isNew ? <span className="new">New</span> : null}
      </div>
      <h3>{i.title}</h3>
      <p>{i.body}</p>
      {i.viz ? <VizBlock viz={i.viz} /> : null}
      {a ? (
        a.external ? (
          <a className={linkClass} href={a.href} target="_blank" rel="noreferrer">
            {a.label}
            <span aria-hidden="true">→</span>
          </a>
        ) : (
          <Link className={linkClass} href={a.href}>
            {a.label}
            <span aria-hidden="true">→</span>
          </Link>
        )
      ) : null}
    </article>
  );
}

export function Pill({ tone, children }: { tone: 'up' | 'down' | 'flat' | 'y'; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
