import Image from 'next/image';
import Link from 'next/link';
import type { MenuPanel, MenuTag } from '@/lib/menu-panels';

/* What a main menu item shows when the mouse rests on it (computers): the page in a line, its sections as # tags
   that jump straight there, sometimes a short list, and a picture from the page. The data is built at deploy
   time in src/lib/menu-panels.ts. */

export function MenuTags({ tags, small = false, onPick }: { tags: MenuTag[]; small?: boolean; onPick?: () => void }) {
  return (
    <ul className={`flex flex-wrap ${small ? 'gap-1.5' : 'gap-2'}`}>
      {tags.map((t) => (
        <li key={t.href}>
          <Link
            href={t.href}
            onClick={onPick}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border border-line-strong bg-white text-ink transition-colors hover:border-ink ${small ? 'h-10 px-2.5 text-[14.5px]' : 'h-10 pl-2.5 pr-3.5 text-[15px]'}`}
          >
            <span aria-hidden="true" className="font-mono text-accent">
              #
            </span>
            {t.label}
            {t.count ? <span className="font-mono text-[12.5px] text-faint">{t.count}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The panel's linked picture as a row, for the phone menu (under the + of that item). */
export function MenuFeatureRow({ feature, onPick }: { feature: NonNullable<MenuPanel['feature']>; onPick?: () => void }) {
  return (
    <Link href={feature.href} onClick={onPick} className="group mb-3 grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3.5 rounded-sm border border-line-strong bg-mount p-1.5 pr-3">
      <span className="relative block aspect-square overflow-hidden rounded-[2px] bg-paper">
        <Image src={feature.square} alt="" fill sizes="88px" className="object-cover" />
        <span className="absolute left-1 top-1 rounded-[2px] bg-mount px-1 font-mono text-[10.5px] font-semibold text-ink">3D</span>
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[12px] text-accent">{feature.kicker}</span>
        <span className="mt-0.5 block text-[16px] font-[650] leading-snug text-ink">{feature.title}</span>
      </span>
    </Link>
  );
}

export default function MenuPanelView({ panel, onPick }: { panel: MenuPanel; onPick: () => void }) {
  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-[260px_minmax(0,1fr)_240px] gap-10 px-10 py-8 xl:grid-cols-[300px_minmax(0,1fr)_272px] xl:gap-11">
      <div>
        <p className="font-mono text-[13px] text-accent">{panel.kicker}</p>
        <p className="mt-2.5 font-display text-[30px] font-[680] leading-[1.05] tracking-[-0.02em]">{panel.title}</p>
        <p className="mt-3 text-[15.5px] leading-relaxed text-muted">{panel.blurb}</p>
        <Link href={panel.href} onClick={onPick} className="link-more mt-4">
          {panel.cta} <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div>
        <p className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">{panel.tagsTitle}</p>
        <div className="mt-3.5">
          <MenuTags tags={panel.tags} onPick={onPick} />
        </div>
        {panel.list?.length ? (
          <>
            <p className="mt-6 font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">{panel.listTitle}</p>
            <ul className="mt-2.5 grid gap-1.5">
              {panel.list.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={onPick} className="text-[15px] text-ink hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      {panel.feature ? (
        <Link href={panel.feature.href} onClick={onPick} className="group block">
          <div className="mount p-1.5">
            <div className="relative aspect-[4/3] overflow-hidden bg-white">
              <Image src={panel.feature.src} alt="" fill sizes="272px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              <span className="absolute left-2 top-2 rounded-[2px] bg-mount px-1.5 py-px font-mono text-[11px] font-semibold text-ink">3D</span>
            </div>
          </div>
          <p className="mt-2.5 font-mono text-[12.5px] text-accent">{panel.feature.kicker}</p>
          <p className="mt-0.5 text-[16px] font-[650] leading-snug transition-colors group-hover:text-accent">
            {panel.feature.title} <span aria-hidden="true">→</span>
          </p>
          <p className="mt-1 text-[13.5px] leading-snug text-muted">{panel.feature.line}</p>
        </Link>
      ) : panel.image ? (
        <figure>
          <div className="mount p-1.5">
            <div className="relative aspect-[4/3] overflow-hidden bg-white">
              <Image src={panel.image.src} alt={panel.image.alt} fill sizes="272px" className={panel.image.contain ? 'object-contain' : 'object-cover'} />
            </div>
          </div>
          <figcaption className="mt-2 text-[13px] leading-snug text-faint">{panel.image.caption}</figcaption>
        </figure>
      ) : (
        <div />
      )}
    </div>
  );
}
