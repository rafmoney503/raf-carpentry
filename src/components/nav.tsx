'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, Mark, appStyle } from './ui';

const LINKS = [
  { href: '/', label: 'Today', icon: 'today' },
  { href: '/review', label: 'Review', icon: 'review' },
  { href: '/apps', label: 'Apps', icon: 'apps' },
  { href: '/leads', label: 'Leads', icon: 'leads' },
  { href: '/messages', label: 'Messages', icon: 'messages' },
  { href: '/alerts', label: 'Alerts', icon: 'alerts' },
];

function current(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
}

export type SideSite = { key: string; name: string; color: string; light: string; ink: string; state: string; good: boolean };

/* `unread`: messages not read yet, shown on Messages. */
export function Sidebar({ sites, unread = 0 }: { sites: SideSite[]; unread?: number }) {
  const path = usePathname();
  return (
    <aside className="side">
      <Link href="/" className="brand">
        <Mark ink="#f7f6f2" />
        <span>
          <b>HQ</b>
          <small>Rafal Solutions</small>
        </span>
      </Link>
      <nav aria-label="HQ">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="side-link" aria-current={current(path, l.href) ? 'page' : undefined}>
            <span className="dot" aria-hidden="true" />
            {l.label}
            {l.href === '/messages' && unread > 0 ? <span className="count" aria-label={`${unread} new`}>{unread}</span> : null}
          </Link>
        ))}
      </nav>
      <section aria-label="Your sites" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="side-head">Your sites</span>
        {sites.map((s) => (
          <Link key={s.key} href={`/apps/${s.key}`} className="side-site appc" style={appStyle(s)} aria-current={path === `/apps/${s.key}` ? 'page' : undefined}>
            <span className="sq" aria-hidden="true" />
            <span>{s.name}</span>
            <em style={{ color: s.good ? 'var(--up)' : 'var(--muted)' }}>{s.state}</em>
          </Link>
        ))}
      </section>
      <p className="side-foot">Visits from Vercel Web Analytics. Taps and sign-ups from Supabase.</p>
    </aside>
  );
}

export function Tabs({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="HQ">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="tab" aria-current={current(path, l.href) ? 'page' : undefined}>
          <span className="tab-ic">
            <Icon name={l.icon} />
            {l.href === '/messages' && unread > 0 ? <span className="count" aria-label={`${unread} new`}>{unread}</span> : null}
          </span>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
