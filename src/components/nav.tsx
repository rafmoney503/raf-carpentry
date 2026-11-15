'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, Mark, appStyle } from './ui';

/* The phone's tabs: six fit. The daily review is reached from Today and from the Day report agent; on a computer the
   sidebar lists it too. */
const LINKS = [
  { href: '/', label: 'Today', icon: 'today' },
  { href: '/agents', label: 'Agents', icon: 'agents' },
  { href: '/apps', label: 'Apps', icon: 'apps' },
  { href: '/leads', label: 'Leads', icon: 'leads' },
  { href: '/messages', label: 'Messages', icon: 'messages' },
  { href: '/alerts', label: 'Alerts', icon: 'alerts' },
];

function current(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
}

export type SideSite = { key: string; name: string; color: string; light: string; ink: string; state: string; good: boolean };

const SIDE_LINKS = [LINKS[0], LINKS[1], { href: '/review', label: 'Review', icon: 'review' }, ...LINKS.slice(2)];

function Badge({ href, unread, needs }: { href: string; unread: number; needs: number }) {
  if (href === '/messages' && unread > 0) return <span className="count" aria-label={`${unread} new`}>{unread}</span>;
  if (href === '/agents' && needs > 0) return <span className="count" aria-label={`${needs} need you`}>{needs}</span>;
  return null;
}

/* `unread`: messages not read yet, shown on Messages. `needs`: what the agents are waiting on Rafal for. */
export function Sidebar({ sites, unread = 0, needs = 0 }: { sites: SideSite[]; unread?: number; needs?: number }) {
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
        {SIDE_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="side-link" aria-current={current(path, l.href) ? 'page' : undefined}>
            <span className="dot" aria-hidden="true" />
            {l.label}
            <Badge href={l.href} unread={unread} needs={needs} />
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
      <section aria-label="On social media" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="side-head">On social media</span>
        <Link href="/facebook" className="side-site appc" style={appStyle({ color: '#1877f2', light: '#6ea8ff', ink: '#ffffff' })} aria-current={path === '/facebook' ? 'page' : undefined}>
          <span className="sq" aria-hidden="true" />
          <span>Cabinet OS</span>
          <em style={{ color: 'var(--muted)' }}>Facebook</em>
        </Link>
      </section>
      <p className="side-foot">Visits from Vercel Web Analytics. Taps and sign-ups from Supabase.</p>
    </aside>
  );
}

export function Tabs({ unread = 0, needs = 0 }: { unread?: number; needs?: number }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="HQ">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="tab" aria-current={current(path, l.href) ? 'page' : undefined}>
          <span className="tab-ic">
            <Icon name={l.icon} />
            <Badge href={l.href} unread={unread} needs={needs} />
          </span>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
