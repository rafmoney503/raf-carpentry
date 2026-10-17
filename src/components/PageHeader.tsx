import Link from 'next/link';
import type { MenuItem } from '@/lib/menu';
import ShapeScene, { type SceneName } from './ShapeScene';

/* The top of every page: kicker, title, one line, the moving shapes, and the page's sections as # tags (the same tags
   as the menu). `scene` picks the shapes: 'loop' (rough shapes go through the big circle and come out finished) for
   pages about turning a problem into something done, 'cog' (shapes orbit the circle, which turns into a cog) for pages
   about things running together. Beside the title on a computer, a short strip under the line on a phone. */

export default function PageHeader({ item, title, lead, scene = 'cog', children }: { item: MenuItem; title?: React.ReactNode; lead?: React.ReactNode; scene?: SceneName; children?: React.ReactNode }) {
  return (
    <section className="page-head grid-paper">
      <div className="wrap page-head-in">
        <p className="kicker">{item.kicker}</p>
        <h1 className="h1 page-title">{title ?? item.title}</h1>
        <p className="lead" style={{ maxWidth: '48ch' }}>
          {lead ?? item.line}
        </p>
        <ShapeScene mode={scene} place="head" />
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
