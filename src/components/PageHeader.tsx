import Link from 'next/link';
import type { MenuItem } from '@/lib/menu';
import { Drift, Rail } from './motion-pieces';

/* The top of every page: kicker, title, one line, a rail with the travelling ball, and the page's sections as # tags
   (the same tags as the menu). Faint shapes drift on the empty side. */

export default function PageHeader({ item, title, lead, children }: { item: MenuItem; title?: React.ReactNode; lead?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="page-head grid-paper" data-motion>
      <Drift />
      <div className="wrap page-head-in">
        <p className="kicker">{item.kicker}</p>
        <h1 className="h1 page-title">{title ?? item.title}</h1>
        <p className="lead" style={{ maxWidth: '48ch' }}>
          {lead ?? item.line}
        </p>
        <Rail />
        <nav className="tags" aria-label="On this page">
          {item.tags.map((t) => (
            <Link key={t.id} href={`#${t.id}`} className="tag">
              <span aria-hidden="true">#</span>
              {t.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </section>
  );
}
